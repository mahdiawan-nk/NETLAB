import {
  NetworkDevice,
  DeviceInterface,
  UnifiedCatalogDevice,
} from '../types/network';
import { DEVICE_CATALOG } from '../data/deviceCatalog';
import {
  RouterOsDeviceConfig,
  RouterOsInterface,
  RouterOsBridge,
  RouterOsBridgePort,
  RouterOsVlan,
  RouterOsIpAddress,
  RouterOsRoute,
  RouterOsIpPool,
  RouterOsDhcpServer,
  RouterOsDhcpNetwork,
  RouterOsDnsConfig,
  RouterOsFirewallFilterRule,
  RouterOsFirewallNatRule,
  RouterOsSimpleQueue,
  RouterOsSystemResource,
  RouterOsBackupSnapshot,
  RouterOsIpAddressSchema,
  RouterOsRouteSchema,
  RouterOsBridgeSchema,
  RouterOsVlanSchema,
  RouterOsSimpleQueueSchema,
} from '../types/routerOs';
import { parseIPv4Cidr } from './validationEngine';

export interface MutationResult<T = RouterOsDeviceConfig> {
  success: boolean;
  message?: string;
  error?: string;
  config?: T;
  createdId?: string;
}

/**
 * Determines whether a network device runs or supports MikroTik RouterOS (CLI Terminal & Winbox GUI).
 * Returns false for non-RouterOS devices (e.g. Generic PCs, Laptops, Servers, CCTV, Printers, ISP ONT/Starlink, Generic non-RouterOS switches).
 */
export function hasRouterOsSupport(
  device?: NetworkDevice | null,
  customDevices?: UnifiedCatalogDevice[]
): boolean {
  if (!device) return false;

  // 1. Check built-in catalog definition first (authoritative even for older saved topologies)
  const builtInModel = DEVICE_CATALOG.find((m) => m.id === device.modelId);
  if (builtInModel) {
    return Boolean(builtInModel.routerOsVersion) && device.routerOsVersion !== 'none';
  }

  // 2. Check custom device catalog definition if available
  const customModel = customDevices?.find((c) => c.id === device.modelId);
  if (customModel) {
    const os = (customModel.hardware?.operatingSystem || '').toLowerCase();
    const brand = (customModel.brand || '').toLowerCase();
    const hasRosOs =
      os.includes('routeros') ||
      os.includes('mikrotik') ||
      os === 'v6' ||
      os === 'v7' ||
      os === 'v6/v7';
    const isMikrotikBrand = brand.includes('mikrotik') && !os.includes('swos');
    if (!hasRosOs && !isMikrotikBrand) {
      return false;
    }
    return device.routerOsVersion !== 'none' || hasRosOs || isMikrotikBrand;
  }

  // 3. Fallback for standalone/imported device snapshots
  if (!device.routerOsVersion || device.routerOsVersion === 'none') {
    return false;
  }

  const vendorLower = (device.vendor || '').toLowerCase();
  const modelLower = (device.modelName || '').toLowerCase();
  if (
    vendorLower.includes('mikrotik') ||
    modelLower.includes('mikrotik') ||
    modelLower.includes('routeros') ||
    modelLower.includes('chr') ||
    Boolean(device.routerOsConfig)
  ) {
    return true;
  }

  // Non-MikroTik endpoints, WAN modems, and generic servers without explicit RouterOS config do not run RouterOS
  if (
    device.category === 'endpoint' ||
    device.category === 'wan' ||
    device.category === 'server'
  ) {
    return false;
  }

  return device.routerOsVersion === 'v6' || device.routerOsVersion === 'v7';
}

export class RouterOsConfigService {
  static supportsRouterOs(
    device?: NetworkDevice | null,
    customDevices?: UnifiedCatalogDevice[]
  ): boolean {
    return hasRouterOsSupport(device, customDevices);
  }

  /**
   * Helper to ensure a NetworkDevice has a full, validated, and normalized RouterOsDeviceConfig.
   * If config doesn't exist, it bootstraps it from physical interfaces, existing IPs, and gateway.
   */
  static ensureConfig(device: NetworkDevice): RouterOsDeviceConfig {
    if (device.routerOsConfig) {
      // Normalize any potentially undefined arrays
      const cfg = device.routerOsConfig;
      if (!cfg.interfaces) cfg.interfaces = [];
      if (!cfg.bridges) cfg.bridges = [];
      if (!cfg.bridgePorts) cfg.bridgePorts = [];
      if (!cfg.vlans) cfg.vlans = [];
      if (!cfg.ipAddresses) cfg.ipAddresses = [];
      if (!cfg.routes) cfg.routes = [];
      if (!cfg.ipPools) cfg.ipPools = [];
      if (!cfg.dhcpServers) cfg.dhcpServers = [];
      if (!cfg.dhcpNetworks) cfg.dhcpNetworks = [];
      if (!cfg.dns) cfg.dns = { servers: ['8.8.8.8', '1.1.1.1'], allowRemoteRequests: true, cacheSizeKb: 2048, staticEntries: [] };
      if (!cfg.firewall) cfg.firewall = { filterRules: [], natRules: [] };
      if (!cfg.firewall.filterRules) cfg.firewall.filterRules = [];
      if (!cfg.firewall.natRules) cfg.firewall.natRules = [];
      if (!cfg.queues) cfg.queues = [];
      if (!cfg.backups) cfg.backups = [];
      if (!cfg.identity) cfg.identity = { name: device.name };
      if (!cfg.version) cfg.version = device.routerOsVersion === 'v7' ? 'v7' : 'v6';

      // Keep physical interface list synchronized with device.interfaces
      for (const iface of device.interfaces) {
        const existing = cfg.interfaces.find((i) => i.name === iface.name);
        if (!existing) {
          cfg.interfaces.push({
            id: iface.id,
            name: iface.name,
            type: iface.type as any,
            disabled: iface.adminState === 'down',
            running: iface.operationalState === 'RUN',
            mtu: iface.mtu || 1500,
            actualMtu: iface.mtu || 1500,
            macAddress: iface.macAddress,
            comment: iface.comment,
            linkSpeed: iface.speed,
          });
        }
      }

      return cfg;
    }

    // Bootstrap initial RouterOS configuration from physical interfaces
    const rosInterfaces: RouterOsInterface[] = device.interfaces.map((iface) => ({
      id: iface.id,
      name: iface.name,
      type: iface.type as any,
      disabled: iface.adminState === 'down',
      running: iface.operationalState === 'RUN',
      mtu: iface.mtu || 1500,
      actualMtu: iface.mtu || 1500,
      macAddress: iface.macAddress,
      comment: iface.comment,
      linkSpeed: iface.speed,
    }));

    const ipAddresses: RouterOsIpAddress[] = [];
    device.interfaces.forEach((iface, idx) => {
      if (iface.ipAddress) {
        const parsed = parseIPv4Cidr(iface.ipAddress);
        ipAddresses.push({
          id: `ip-${idx + 1}`,
          address: iface.ipAddress,
          network: parsed ? parsed.network : '0.0.0.0',
          interface: iface.name,
          disabled: false,
          comment: `Default IP for ${iface.name}`,
        });
      }
    });

    const routes: RouterOsRoute[] = [];
    if (device.defaultGateway) {
      routes.push({
        id: 'route-1',
        dstAddress: '0.0.0.0/0',
        gateway: device.defaultGateway,
        distance: 1,
        scope: 30,
        targetScope: 10,
        disabled: false,
        active: true,
        comment: 'Default gateway',
      });
    }

    // Default bridges for switch and router models
    const bridges: RouterOsBridge[] = [];
    const bridgePorts: RouterOsBridgePort[] = [];
    if (device.category === 'switch') {
      bridges.push({
        id: 'bridge-1',
        name: 'bridge1',
        disabled: false,
        vlanFiltering: true,
        mtu: 1500,
        macAddress: device.interfaces[0]?.macAddress || '48:8F:5A:01:00:01',
        comment: 'Main Switch Bridge',
      });

      device.interfaces.forEach((iface, idx) => {
        bridgePorts.push({
          id: `bp-${idx + 1}`,
          bridge: 'bridge1',
          interface: iface.name,
          pvid: iface.pvid || 1,
          disabled: false,
        });
      });
    }

    // Standard baseline firewall for routers
    const filterRules: RouterOsFirewallFilterRule[] = [];
    const natRules: RouterOsFirewallNatRule[] = [];
    if (device.category === 'router' || device.category === 'wan') {
      filterRules.push(
        {
          id: 'filter-1',
          chain: 'input',
          action: 'accept',
          connectionState: 'established,related',
          disabled: false,
          comment: 'defconf: accept established,related',
        },
        {
          id: 'filter-2',
          chain: 'input',
          action: 'accept',
          protocol: 'icmp',
          disabled: false,
          comment: 'defconf: accept ICMP',
        },
        {
          id: 'filter-3',
          chain: 'forward',
          action: 'accept',
          connectionState: 'established,related',
          disabled: false,
          comment: 'defconf: accept in forward',
        }
      );

      // Default WAN NAT masquerade
      natRules.push({
        id: 'nat-1',
        chain: 'srcnat',
        action: 'masquerade',
        outInterface: device.interfaces.find((i) => i.mode === 'wan')?.name || 'ether1',
        disabled: false,
        comment: 'defconf: masquerade WAN outbound',
      });
    }

    const newConfig: RouterOsDeviceConfig = {
      version: device.routerOsVersion === 'v7' ? 'v7' : 'v6',
      identity: { name: device.name },
      interfaces: rosInterfaces,
      bridges,
      bridgePorts,
      vlans: [],
      ipAddresses,
      routes,
      ipPools: [
        {
          id: 'pool-1',
          name: 'dhcp-pool-lan',
          ranges: '192.168.88.100-192.168.88.250',
        },
      ],
      dhcpServers: [],
      dhcpNetworks: [
        {
          id: 'dnet-1',
          address: '192.168.88.0/24',
          gateway: '192.168.88.1',
          dnsServers: ['8.8.8.8', '1.1.1.1'],
          comment: 'LAN Subnet DHCP Options',
        },
      ],
      dns: {
        servers: ['8.8.8.8', '1.1.1.1'],
        allowRemoteRequests: true,
        cacheSizeKb: 2048,
        staticEntries: [
          { id: 'dns-static-1', name: `${device.name.toLowerCase()}.lan`, address: '192.168.88.1' },
        ],
      },
      firewall: {
        filterRules,
        natRules,
      },
      queues: [],
      backups: [],
      lastModifiedAt: new Date().toISOString(),
    };

    return newConfig;
  }

  /**
   * Hardware Capability Guard: validates if an interface name exists on the physical device
   * or has been defined as a logical interface (bridge or vlan).
   */
  static isValidInterface(device: NetworkDevice, ifaceName: string, config?: RouterOsDeviceConfig): boolean {
    const cfg = config || this.ensureConfig(device);
    // Check physical ports from device interfaces
    const isPhysical = device.interfaces.some((i) => i.name.toLowerCase() === ifaceName.toLowerCase());
    if (isPhysical) return true;

    // Check virtual bridges
    const isBridge = cfg.bridges.some((b) => b.name.toLowerCase() === ifaceName.toLowerCase());
    if (isBridge) return true;

    // Check virtual VLAN interfaces
    const isVlan = cfg.vlans.some((v) => v.name.toLowerCase() === ifaceName.toLowerCase());
    if (isVlan) return true;

    return false;
  }

  /**
   * Synchronize changes from RouterOsDeviceConfig back to physical DeviceInterface[]
   * and top-level device properties (defaultGateway, name, routerOsVersion) to ensure 100% backward compatibility.
   */
  static syncToDeviceInterfaces(device: NetworkDevice, config: RouterOsDeviceConfig): NetworkDevice {
    const updatedDevice = { ...device };

    // 1. Sync device identity & RouterOS version
    if (config.identity?.name && config.identity.name.trim() !== '') {
      updatedDevice.name = config.identity.name.trim();
    }
    if (config.version === 'v6' || config.version === 'v7') {
      updatedDevice.routerOsVersion = config.version;
    }

    // 2. Sync default gateway from 0.0.0.0/0 route
    const defaultRoute = config.routes.find((r) => !r.disabled && r.dstAddress === '0.0.0.0/0');
    updatedDevice.defaultGateway = defaultRoute ? defaultRoute.gateway : undefined;

    // 3. Sync IP addresses back to interfaces
    const ipMap = new Map<string, string>();
    for (const ipEntry of config.ipAddresses) {
      if (!ipEntry.disabled && !ipMap.has(ipEntry.interface)) {
        ipMap.set(ipEntry.interface, ipEntry.address);
      }
    }

    // 4. Sync Bridge PVIDs back to interfaces
    const pvidMap = new Map<string, number>();
    for (const bp of config.bridgePorts) {
      if (!bp.disabled) {
        pvidMap.set(bp.interface, bp.pvid);
      }
    }

    // 5. Sync Admin State, MTU & Comment
    const rosIfaceMap = new Map<string, RouterOsInterface>();
    for (const iface of config.interfaces) {
      rosIfaceMap.set(iface.name, iface);
    }

    updatedDevice.interfaces = device.interfaces.map((iface) => {
      const assignedIp = ipMap.get(iface.name);
      const assignedPvid = pvidMap.get(iface.name);
      const rosIface = rosIfaceMap.get(iface.name);

      return {
        ...iface,
        ipAddress: assignedIp,
        pvid: assignedPvid !== undefined ? assignedPvid : iface.pvid,
        adminState: rosIface !== undefined ? (rosIface.disabled ? 'down' : 'up') : iface.adminState,
        mtu: rosIface?.mtu || iface.mtu,
        comment: rosIface?.comment !== undefined ? rosIface.comment : iface.comment,
      };
    });

    updatedDevice.routerOsConfig = config;
    updatedDevice.updatedAt = new Date().toISOString();

    return updatedDevice;
  }

  /**
   * Synchronize changes made from NETLAB's Topology DeviceInspector (device.name, defaultGateway,
   * routerOsVersion, interface ipAddress/adminState/pvid/mtu/comment) into device.routerOsConfig.
   */
  static syncFromDeviceToConfig(device: NetworkDevice): NetworkDevice {
    if (!device.routerOsConfig) return device;
    const cfg: RouterOsDeviceConfig = {
      ...device.routerOsConfig,
      version: device.routerOsVersion === 'v7' ? 'v7' : 'v6',
      identity: { name: device.name },
      interfaces: device.routerOsConfig.interfaces.map((ri) => {
        const phys = device.interfaces.find((p) => p.name === ri.name);
        if (!phys) return ri;
        return {
          ...ri,
          disabled: phys.adminState === 'down',
          running: phys.operationalState === 'RUN',
          mtu: phys.mtu || ri.mtu,
          actualMtu: phys.mtu || ri.actualMtu,
          comment: phys.comment !== undefined ? phys.comment : ri.comment,
        };
      }),
      lastModifiedAt: new Date().toISOString(),
    };

    // Sync interface primary IP addresses
    const nextIps = [...cfg.ipAddresses];
    for (const phys of device.interfaces) {
      const existingIdx = nextIps.findIndex((ip) => ip.interface === phys.name);
      if (phys.ipAddress && phys.ipAddress.trim() !== '') {
        const parsed = parseIPv4Cidr(phys.ipAddress);
        if (existingIdx >= 0) {
          nextIps[existingIdx] = {
            ...nextIps[existingIdx],
            address: phys.ipAddress,
            network: parsed ? parsed.network : nextIps[existingIdx].network,
          };
        } else {
          nextIps.push({
            id: `ip-${Date.now().toString(36)}-${phys.name}`,
            address: phys.ipAddress,
            network: parsed ? parsed.network : '0.0.0.0',
            interface: phys.name,
            disabled: false,
            comment: `Synced from Inspector (${phys.name})`,
          });
        }
      }
    }
    cfg.ipAddresses = nextIps;

    // Sync default gateway
    if (device.defaultGateway && device.defaultGateway.trim() !== '') {
      const defIdx = cfg.routes.findIndex((r) => r.dstAddress === '0.0.0.0/0');
      if (defIdx >= 0) {
        cfg.routes = cfg.routes.map((r, i) => (i === defIdx ? { ...r, gateway: device.defaultGateway! } : r));
      } else {
        cfg.routes = [
          ...cfg.routes,
          {
            id: `route-def-${Date.now().toString(36)}`,
            dstAddress: '0.0.0.0/0',
            gateway: device.defaultGateway,
            distance: 1,
            scope: 30,
            targetScope: 10,
            disabled: false,
            active: true,
            comment: 'Default gateway',
          },
        ];
      }
    }

    return {
      ...device,
      routerOsConfig: cfg,
    };
  }

  // ==========================================
  // /IP ADDRESS OPERATIONS
  // ==========================================

  static addIpAddress(
    device: NetworkDevice,
    entry: { address: string; interface: string; comment?: string; disabled?: boolean }
  ): MutationResult {
    const config = this.ensureConfig(device);

    // Validate with Zod
    const valResult = RouterOsIpAddressSchema.safeParse(entry);
    if (!valResult.success) {
      return { success: false, error: valResult.error.issues[0]?.message || 'Invalid IP address syntax' };
    }

    // Hardware capability check
    if (!this.isValidInterface(device, entry.interface, config)) {
      return {
        success: false,
        error: `failure: interface '${entry.interface}' does not exist on device model ${device.modelName}`,
      };
    }

    // Check for IP collision on the same interface
    const isDup = config.ipAddresses.some(
      (a) => a.interface.toLowerCase() === entry.interface.toLowerCase() && a.address === entry.address
    );
    if (isDup) {
      return { success: false, error: `failure: address ${entry.address} already assigned to ${entry.interface}` };
    }

    const parsed = parseIPv4Cidr(entry.address);
    const newId = `ip-${Date.now().toString(36)}-${Math.floor(Math.random() * 100)}`;
    const newIp: RouterOsIpAddress = {
      id: newId,
      address: entry.address,
      network: parsed ? parsed.network : '0.0.0.0',
      interface: entry.interface,
      disabled: entry.disabled || false,
      comment: entry.comment,
    };

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      ipAddresses: [...config.ipAddresses, newIp],
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig, createdId: newId };
  }

  static removeIpAddress(device: NetworkDevice, idOrIndex: string): MutationResult {
    const config = this.ensureConfig(device);
    const target = config.ipAddresses.find((a, idx) => a.id === idOrIndex || String(idx) === idOrIndex);
    if (!target) {
      return { success: false, error: `no such item (id: ${idOrIndex})` };
    }

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      ipAddresses: config.ipAddresses.filter((a) => a.id !== target.id),
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig };
  }

  static setIpAddress(
    device: NetworkDevice,
    idOrIndex: string,
    updates: Partial<RouterOsIpAddress>
  ): MutationResult {
    const config = this.ensureConfig(device);
    const target = config.ipAddresses.find((a, idx) => a.id === idOrIndex || String(idx) === idOrIndex);
    if (!target) {
      return { success: false, error: `no such item (id: ${idOrIndex})` };
    }

    if (updates.interface && !this.isValidInterface(device, updates.interface, config)) {
      return { success: false, error: `failure: interface '${updates.interface}' does not exist on this device` };
    }

    let network = target.network;
    if (updates.address) {
      const parsed = parseIPv4Cidr(updates.address);
      if (!parsed) return { success: false, error: 'Invalid IP/CIDR format' };
      network = parsed.network;
    }

    const updatedList = config.ipAddresses.map((a) => {
      if (a.id !== target.id) return a;
      return { ...a, ...updates, network };
    });

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      ipAddresses: updatedList,
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig };
  }

  // ==========================================
  // /INTERFACE BRIDGE OPERATIONS
  // ==========================================

  static addBridge(
    device: NetworkDevice,
    entry: { name: string; vlanFiltering?: boolean; comment?: string }
  ): MutationResult {
    const config = this.ensureConfig(device);

    const valResult = RouterOsBridgeSchema.safeParse(entry);
    if (!valResult.success) {
      return { success: false, error: valResult.error.issues[0]?.message || 'Invalid bridge parameters' };
    }

    if (config.bridges.some((b) => b.name.toLowerCase() === entry.name.toLowerCase())) {
      return { success: false, error: `failure: bridge with name '${entry.name}' already exists` };
    }

    const newId = `bridge-${Date.now().toString(36)}`;
    const newBridge: RouterOsBridge = {
      id: newId,
      name: entry.name,
      disabled: false,
      vlanFiltering: entry.vlanFiltering || false,
      mtu: 1500,
      macAddress: device.interfaces[0]?.macAddress || '48:8F:5A:00:00:01',
      comment: entry.comment,
    };

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      bridges: [...config.bridges, newBridge],
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig, createdId: newId };
  }

  static removeBridge(device: NetworkDevice, idOrName: string): MutationResult {
    const config = this.ensureConfig(device);
    const target = config.bridges.find((b, idx) => b.id === idOrName || b.name === idOrName || String(idx) === idOrName);
    if (!target) {
      return { success: false, error: `no such bridge (id: ${idOrName})` };
    }

    // Cascade remove ports associated with this bridge
    const nextPorts = config.bridgePorts.filter((bp) => bp.bridge !== target.name);
    const nextBridges = config.bridges.filter((b) => b.id !== target.id);

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      bridges: nextBridges,
      bridgePorts: nextPorts,
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig };
  }

  static addBridgePort(
    device: NetworkDevice,
    entry: { bridge: string; interface: string; pvid?: number }
  ): MutationResult {
    const config = this.ensureConfig(device);

    const bridgeExists = config.bridges.some((b) => b.name === entry.bridge);
    if (!bridgeExists) {
      return { success: false, error: `failure: bridge '${entry.bridge}' does not exist` };
    }

    if (!device.interfaces.some((i) => i.name === entry.interface)) {
      return { success: false, error: `failure: interface '${entry.interface}' does not exist on this hardware` };
    }

    if (config.bridgePorts.some((bp) => bp.interface === entry.interface)) {
      return { success: false, error: `failure: interface '${entry.interface}' is already a bridge port` };
    }

    const newId = `bp-${Date.now().toString(36)}`;
    const newPort: RouterOsBridgePort = {
      id: newId,
      bridge: entry.bridge,
      interface: entry.interface,
      pvid: entry.pvid || 1,
      disabled: false,
    };

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      bridgePorts: [...config.bridgePorts, newPort],
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig, createdId: newId };
  }

  static removeBridgePort(device: NetworkDevice, idOrIndex: string): MutationResult {
    const config = this.ensureConfig(device);
    const target = config.bridgePorts.find((bp, idx) => bp.id === idOrIndex || String(idx) === idOrIndex);
    if (!target) {
      return { success: false, error: `no such bridge port item (${idOrIndex})` };
    }

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      bridgePorts: config.bridgePorts.filter((bp) => bp.id !== target.id),
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig };
  }

  // ==========================================
  // /INTERFACE VLAN OPERATIONS
  // ==========================================

  static addVlan(
    device: NetworkDevice,
    entry: { name: string; vlanId: number; interface: string; comment?: string }
  ): MutationResult {
    const config = this.ensureConfig(device);

    const valResult = RouterOsVlanSchema.safeParse(entry);
    if (!valResult.success) {
      return { success: false, error: valResult.error.issues[0]?.message || 'Invalid VLAN parameters' };
    }

    if (!this.isValidInterface(device, entry.interface, config)) {
      return { success: false, error: `failure: parent interface '${entry.interface}' does not exist` };
    }

    if (config.vlans.some((v) => v.name.toLowerCase() === entry.name.toLowerCase())) {
      return { success: false, error: `failure: VLAN interface '${entry.name}' already exists` };
    }

    const newId = `vlan-${Date.now().toString(36)}`;
    const newVlan: RouterOsVlan = {
      id: newId,
      name: entry.name,
      vlanId: entry.vlanId,
      interface: entry.interface,
      disabled: false,
      comment: entry.comment,
    };

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      vlans: [...config.vlans, newVlan],
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig, createdId: newId };
  }

  static removeVlan(device: NetworkDevice, idOrName: string): MutationResult {
    const config = this.ensureConfig(device);
    const target = config.vlans.find((v, idx) => v.id === idOrName || v.name === idOrName || String(idx) === idOrName);
    if (!target) {
      return { success: false, error: `no such VLAN item (${idOrName})` };
    }

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      vlans: config.vlans.filter((v) => v.id !== target.id),
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig };
  }

  // ==========================================
  // /IP ROUTE OPERATIONS
  // ==========================================

  static addRoute(
    device: NetworkDevice,
    entry: {
      dstAddress: string;
      gateway: string;
      distance?: number;
      routingTable?: string;
      routingMark?: string;
      comment?: string;
    }
  ): MutationResult {
    const config = this.ensureConfig(device);

    // Version compatibility check
    if (entry.routingTable !== undefined && config.version === 'v6') {
      return {
        success: false,
        error: `syntax error: parameter 'routing-table' is only supported in RouterOS v7 (device runs RouterOS v6.49.13; use 'routing-mark=' instead)`,
      };
    }
    if (entry.routingMark !== undefined && config.version === 'v7') {
      return {
        success: false,
        error: `syntax error: parameter 'routing-mark' was removed in RouterOS v7 (device runs RouterOS v7.15.2; use 'routing-table=' instead)`,
      };
    }

    const valResult = RouterOsRouteSchema.safeParse(entry);
    if (!valResult.success) {
      return { success: false, error: valResult.error.issues[0]?.message || 'Invalid route parameters' };
    }

    const newId = `route-${Date.now().toString(36)}-${Math.floor(Math.random() * 100)}`;
    const newRoute: RouterOsRoute = {
      id: newId,
      dstAddress: entry.dstAddress,
      gateway: entry.gateway,
      distance: entry.distance || 1,
      scope: 30,
      targetScope: 10,
      disabled: false,
      active: true,
      routingTable: entry.routingTable || entry.routingMark,
      comment: entry.comment,
    };

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      routes: [...config.routes, newRoute],
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig, createdId: newId };
  }

  static removeRoute(device: NetworkDevice, idOrIndex: string): MutationResult {
    const config = this.ensureConfig(device);
    const target = config.routes.find((r, idx) => r.id === idOrIndex || String(idx) === idOrIndex);
    if (!target) {
      return { success: false, error: `no such route item (${idOrIndex})` };
    }

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      routes: config.routes.filter((r) => r.id !== target.id),
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig };
  }

  // ==========================================
  // /IP FIREWALL FILTER & NAT OPERATIONS
  // ==========================================

  static addFirewallRule(
    device: NetworkDevice,
    rule: Omit<RouterOsFirewallFilterRule, 'id'>
  ): MutationResult {
    const config = this.ensureConfig(device);

    const newId = `filter-${Date.now().toString(36)}`;
    const newRule: RouterOsFirewallFilterRule = {
      ...rule,
      id: newId,
      packetsCount: 0,
      bytesCount: 0,
    };

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      firewall: {
        ...config.firewall,
        filterRules: [...config.firewall.filterRules, newRule],
      },
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig, createdId: newId };
  }

  static removeFirewallRule(device: NetworkDevice, idOrIndex: string): MutationResult {
    const config = this.ensureConfig(device);
    const target = config.firewall.filterRules.find((r, idx) => r.id === idOrIndex || String(idx) === idOrIndex);
    if (!target) {
      return { success: false, error: `no such filter rule item (${idOrIndex})` };
    }

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      firewall: {
        ...config.firewall,
        filterRules: config.firewall.filterRules.filter((r) => r.id !== target.id),
      },
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig };
  }

  static addNatRule(
    device: NetworkDevice,
    rule: Omit<RouterOsFirewallNatRule, 'id'>
  ): MutationResult {
    const config = this.ensureConfig(device);

    const newId = `nat-${Date.now().toString(36)}`;
    const newRule: RouterOsFirewallNatRule = {
      ...rule,
      id: newId,
      packetsCount: 0,
      bytesCount: 0,
    };

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      firewall: {
        ...config.firewall,
        natRules: [...config.firewall.natRules, newRule],
      },
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig, createdId: newId };
  }

  static removeNatRule(device: NetworkDevice, idOrIndex: string): MutationResult {
    const config = this.ensureConfig(device);
    const target = config.firewall.natRules.find((r, idx) => r.id === idOrIndex || String(idx) === idOrIndex);
    if (!target) {
      return { success: false, error: `no such nat rule item (${idOrIndex})` };
    }

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      firewall: {
        ...config.firewall,
        natRules: config.firewall.natRules.filter((r) => r.id !== target.id),
      },
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig };
  }

  // ==========================================
  // /QUEUE SIMPLE OPERATIONS
  // ==========================================

  static addSimpleQueue(
    device: NetworkDevice,
    entry: { name: string; target: string; maxLimitUploadBps: number; maxLimitDownloadBps: number; comment?: string }
  ): MutationResult {
    const config = this.ensureConfig(device);

    const valResult = RouterOsSimpleQueueSchema.safeParse(entry);
    if (!valResult.success) {
      return { success: false, error: valResult.error.issues[0]?.message || 'Invalid simple queue syntax' };
    }

    if (config.queues.some((q) => q.name.toLowerCase() === entry.name.toLowerCase())) {
      return { success: false, error: `failure: simple queue '${entry.name}' already exists` };
    }

    const newId = `queue-${Date.now().toString(36)}`;
    const newQueue: RouterOsSimpleQueue = {
      id: newId,
      name: entry.name,
      target: entry.target,
      maxLimitUploadBps: entry.maxLimitUploadBps,
      maxLimitDownloadBps: entry.maxLimitDownloadBps,
      priority: 8,
      disabled: false,
      comment: entry.comment,
    };

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      queues: [...config.queues, newQueue],
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig, createdId: newId };
  }

  static removeSimpleQueue(device: NetworkDevice, idOrName: string): MutationResult {
    const config = this.ensureConfig(device);
    const target = config.queues.find((q, idx) => q.id === idOrName || q.name === idOrName || String(idx) === idOrName);
    if (!target) {
      return { success: false, error: `no such queue item (${idOrName})` };
    }

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      queues: config.queues.filter((q) => q.id !== target.id),
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig };
  }

  // ==========================================
  // /IP POOL & DHCP SERVER & DNS OPERATIONS
  // ==========================================

  static addIpPool(device: NetworkDevice, entry: { name: string; ranges: string }): MutationResult {
    const config = this.ensureConfig(device);
    if (!entry.name.trim() || !entry.ranges.trim()) {
      return { success: false, error: 'failure: pool name and IP ranges are required' };
    }
    if (config.ipPools.some((p) => p.name.toLowerCase() === entry.name.trim().toLowerCase())) {
      return { success: false, error: `failure: pool '${entry.name}' already exists` };
    }
    const newId = `pool-${Date.now().toString(36)}`;
    const newPool: RouterOsIpPool = {
      id: newId,
      name: entry.name.trim(),
      ranges: entry.ranges.trim(),
    };
    return {
      success: true,
      config: {
        ...config,
        ipPools: [...config.ipPools, newPool],
        lastModifiedAt: new Date().toISOString(),
      },
      createdId: newId,
    };
  }

  static removeIpPool(device: NetworkDevice, idOrName: string): MutationResult {
    const config = this.ensureConfig(device);
    const target = config.ipPools.find((p, idx) => p.id === idOrName || p.name === idOrName || String(idx) === idOrName);
    if (!target) return { success: false, error: `no such ip pool (${idOrName})` };
    return {
      success: true,
      config: {
        ...config,
        ipPools: config.ipPools.filter((p) => p.id !== target.id),
        lastModifiedAt: new Date().toISOString(),
      },
    };
  }

  static addDhcpServer(
    device: NetworkDevice,
    entry: { name: string; interface: string; addressPool: string; leaseTime?: string }
  ): MutationResult {
    const config = this.ensureConfig(device);
    if (!entry.name.trim() || !entry.interface.trim()) {
      return { success: false, error: 'failure: server name and interface are required' };
    }
    if (!this.isValidInterface(device, entry.interface, config)) {
      return { success: false, error: `failure: interface '${entry.interface}' does not exist on this device` };
    }
    if (config.dhcpServers.some((s) => s.name.toLowerCase() === entry.name.trim().toLowerCase())) {
      return { success: false, error: `failure: dhcp-server '${entry.name}' already exists` };
    }
    const newId = `dhcp-${Date.now().toString(36)}`;
    const newServer: RouterOsDhcpServer = {
      id: newId,
      name: entry.name.trim(),
      interface: entry.interface,
      addressPool: entry.addressPool || 'static-only',
      leaseTime: entry.leaseTime || '10m',
      disabled: false,
    };
    return {
      success: true,
      config: {
        ...config,
        dhcpServers: [...config.dhcpServers, newServer],
        lastModifiedAt: new Date().toISOString(),
      },
      createdId: newId,
    };
  }

  static removeDhcpServer(device: NetworkDevice, idOrName: string): MutationResult {
    const config = this.ensureConfig(device);
    const target = config.dhcpServers.find((s, idx) => s.id === idOrName || s.name === idOrName || String(idx) === idOrName);
    if (!target) return { success: false, error: `no such dhcp-server (${idOrName})` };
    return {
      success: true,
      config: {
        ...config,
        dhcpServers: config.dhcpServers.filter((s) => s.id !== target.id),
        lastModifiedAt: new Date().toISOString(),
      },
    };
  }

  static setDns(
    device: NetworkDevice,
    updates: { servers?: string[]; allowRemoteRequests?: boolean }
  ): MutationResult {
    const config = this.ensureConfig(device);
    return {
      success: true,
      config: {
        ...config,
        dns: {
          ...config.dns,
          servers: updates.servers !== undefined ? updates.servers : config.dns.servers,
          allowRemoteRequests:
            updates.allowRemoteRequests !== undefined
              ? updates.allowRemoteRequests
              : config.dns.allowRemoteRequests,
        },
        lastModifiedAt: new Date().toISOString(),
      },
    };
  }

  static addDnsStatic(
    device: NetworkDevice,
    entry: { name: string; address: string; ttl?: string }
  ): MutationResult {
    const config = this.ensureConfig(device);
    if (!entry.name.trim() || !entry.address.trim()) {
      return { success: false, error: 'failure: static DNS name and IP address are required' };
    }
    const newId = `dns-st-${Date.now().toString(36)}`;
    return {
      success: true,
      config: {
        ...config,
        dns: {
          ...config.dns,
          staticEntries: [
            ...config.dns.staticEntries,
            {
              id: newId,
              name: entry.name.trim(),
              address: entry.address.trim(),
              ttl: entry.ttl || '1d',
              disabled: false,
            },
          ],
        },
        lastModifiedAt: new Date().toISOString(),
      },
      createdId: newId,
    };
  }

  static removeDnsStatic(device: NetworkDevice, idOrName: string): MutationResult {
    const config = this.ensureConfig(device);
    const target = config.dns.staticEntries.find(
      (e, idx) => e.id === idOrName || e.name === idOrName || String(idx) === idOrName
    );
    if (!target) return { success: false, error: `no such static dns entry (${idOrName})` };
    return {
      success: true,
      config: {
        ...config,
        dns: {
          ...config.dns,
          staticEntries: config.dns.staticEntries.filter((e) => e.id !== target.id),
        },
        lastModifiedAt: new Date().toISOString(),
      },
    };
  }

  // ==========================================
  // /SYSTEM IDENTITY & RESOURCE
  // ==========================================

  static setIdentity(device: NetworkDevice, name: string): MutationResult {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, error: 'failure: system identity name cannot be empty' };
    }

    const config = this.ensureConfig(device);
    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      identity: { name: trimmed },
      lastModifiedAt: new Date().toISOString(),
    };

    return { success: true, config: nextConfig };
  }

  static getSystemResource(device: NetworkDevice, liveCpuLoadPercent: number = 8): RouterOsSystemResource {
    const isV7 = device.routerOsVersion === 'v7';
    const isCoreRouter = device.modelName.includes('CCR') || device.modelName.includes('2116');

    return {
      uptimeSeconds: 86400 * 3 + 14220,
      version: isV7 ? '7.15.2 (stable)' : '6.49.13 (long-term)',
      buildTime: isV7 ? 'May/15/2024 10:24:18' : 'Dec/20/2023 14:10:02',
      factorySoftware: isV7 ? '7.1' : '6.40',
      totalMemoryBytes: isCoreRouter ? 16 * 1024 * 1024 * 1024 : 1024 * 1024 * 1024,
      freeMemoryBytes: isCoreRouter ? 14.2 * 1024 * 1024 * 1024 : 780 * 1024 * 1024,
      cpuModel: isCoreRouter ? 'Amazon Annapurna Labs AL73400 (16 Cores)' : 'ARM 32bit / MIPSBE',
      cpuCount: isCoreRouter ? 16 : 4,
      cpuFrequencyMhz: isCoreRouter ? 2000 : 800,
      cpuLoadPercent: liveCpuLoadPercent,
      totalHddSpaceBytes: 128 * 1024 * 1024,
      freeHddSpaceBytes: 94 * 1024 * 1024,
      architecture: isCoreRouter ? 'arm64' : 'arm',
      boardName: device.modelName,
    };
  }

  // ==========================================
  // BACKUP, RESTORE, DIFF & .RSC EXPORT
  // ==========================================

  static createBackup(device: NetworkDevice, backupName: string): MutationResult {
    const config = this.ensureConfig(device);
    const cleanCopy: RouterOsDeviceConfig = {
      ...config,
      backups: [],
    };
    const serialized = JSON.stringify(cleanCopy, null, 2);

    const snapshot: RouterOsBackupSnapshot = {
      id: `backup-${Date.now().toString(36)}-${Math.floor(Math.random() * 100)}`,
      name: backupName.trim() || `${device.name}-${new Date().toISOString().slice(0, 10)}.backup`,
      createdAt: new Date().toISOString(),
      routerOsVersion: config.version,
      sizeBytes: new Blob([serialized]).size,
      serializedConfig: serialized,
    };

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      backups: [snapshot, ...config.backups],
      lastModifiedAt: new Date().toISOString(),
    };

    return {
      success: true,
      config: nextConfig,
      createdId: snapshot.id,
      message: `Backup snapshot '${snapshot.name}' saved (${snapshot.sizeBytes} bytes).`,
    };
  }

  static restoreBackup(device: NetworkDevice, backupId: string): MutationResult {
    const config = this.ensureConfig(device);
    const target = config.backups.find((b) => b.id === backupId || b.name === backupId);
    if (!target) {
      return { success: false, error: `Backup snapshot '${backupId}' not found.` };
    }

    try {
      const restored = JSON.parse(target.serializedConfig) as RouterOsDeviceConfig;
      // Preserve the backup list
      restored.backups = config.backups;
      restored.lastModifiedAt = new Date().toISOString();

      return {
        success: true,
        config: restored,
        message: `Configuration restored from snapshot '${target.name}'.`,
      };
    } catch {
      return { success: false, error: 'Corrupted backup file format.' };
    }
  }

  static deleteBackup(device: NetworkDevice, backupId: string): MutationResult {
    const config = this.ensureConfig(device);
    const target = config.backups.find((b) => b.id === backupId);
    if (!target) {
      return { success: false, error: `Backup snapshot '${backupId}' not found.` };
    }

    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      backups: config.backups.filter((b) => b.id !== backupId),
      lastModifiedAt: new Date().toISOString(),
    };

    return {
      success: true,
      config: nextConfig,
      message: `Deleted backup snapshot '${target.name}'.`,
    };
  }

  static resetToFactoryDefault(device: NetworkDevice): MutationResult {
    const currentBackups = device.routerOsConfig?.backups || [];
    const strippedDevice: NetworkDevice = {
      ...device,
      routerOsConfig: undefined,
      defaultGateway: undefined,
      interfaces: device.interfaces.map((iface) => ({
        ...iface,
        ipAddress: undefined,
        pvid: 1,
        adminState: 'up',
      })),
    };
    const factoryConfig = this.ensureConfig(strippedDevice);
    factoryConfig.backups = currentBackups;
    factoryConfig.lastModifiedAt = new Date().toISOString();

    return {
      success: true,
      config: factoryConfig,
      message: `Device '${device.name}' reset to RouterOS factory default configuration.`,
    };
  }

  static exportRscScript(device: NetworkDevice, includeHeaderTimestamp: boolean = true): string {
    const cfg = this.ensureConfig(device);
    return this.exportRscScriptFromConfig(cfg, device.modelName, includeHeaderTimestamp);
  }

  static exportRscScriptFromConfig(
    cfg: RouterOsDeviceConfig,
    modelName: string,
    includeHeaderTimestamp: boolean = true
  ): string {
    const dateStr = includeHeaderTimestamp ? new Date().toUTCString() : 'RouterOS Snapshot';
    let rsc = `# ${dateStr} by RouterOS ${cfg.version}\n`;
    rsc += `# software id = NETLAB-SIM-PRO\n`;
    rsc += `# model = ${modelName}\n\n`;

    // System Identity
    rsc += `/system identity\nset name=${cfg.identity.name}\n\n`;

    // Interfaces
    rsc += `/interface\n`;
    cfg.interfaces.forEach((i) => {
      if (i.disabled) rsc += `set [ find default-name=${i.name} ] disabled=yes\n`;
      if (i.mtu && i.mtu !== 1500) rsc += `set [ find default-name=${i.name} ] mtu=${i.mtu}\n`;
      if (i.comment) rsc += `set [ find default-name=${i.name} ] comment="${i.comment}"\n`;
    });
    rsc += `\n`;

    // Bridges
    if (cfg.bridges.length > 0) {
      rsc += `/interface bridge\n`;
      cfg.bridges.forEach((b) => {
        rsc += `add name=${b.name} vlan-filtering=${b.vlanFiltering ? 'yes' : 'no'} mtu=${b.mtu}${b.disabled ? ' disabled=yes' : ''}${b.comment ? ` comment="${b.comment}"` : ''}\n`;
      });
      rsc += `\n`;
    }

    // Bridge Ports
    if (cfg.bridgePorts.length > 0) {
      rsc += `/interface bridge port\n`;
      cfg.bridgePorts.forEach((bp) => {
        rsc += `add bridge=${bp.bridge} interface=${bp.interface} pvid=${bp.pvid}${bp.disabled ? ' disabled=yes' : ''}${bp.comment ? ` comment="${bp.comment}"` : ''}\n`;
      });
      rsc += `\n`;
    }

    // VLANs
    if (cfg.vlans.length > 0) {
      rsc += `/interface vlan\n`;
      cfg.vlans.forEach((v) => {
        rsc += `add name=${v.name} vlan-id=${v.vlanId} interface=${v.interface}${v.disabled ? ' disabled=yes' : ''}${v.comment ? ` comment="${v.comment}"` : ''}\n`;
      });
      rsc += `\n`;
    }

    // IP Pools
    if (cfg.ipPools.length > 0) {
      rsc += `/ip pool\n`;
      cfg.ipPools.forEach((p) => {
        rsc += `add name=${p.name} ranges=${p.ranges}\n`;
      });
      rsc += `\n`;
    }

    // IP DHCP Server
    if (cfg.dhcpServers.length > 0) {
      rsc += `/ip dhcp-server\n`;
      cfg.dhcpServers.forEach((ds) => {
        rsc += `add name=${ds.name} interface=${ds.interface} address-pool=${ds.addressPool} lease-time=${ds.leaseTime}${ds.disabled ? ' disabled=yes' : ''}\n`;
      });
      rsc += `\n`;
    }

    // IP Addresses
    if (cfg.ipAddresses.length > 0) {
      rsc += `/ip address\n`;
      cfg.ipAddresses.forEach((a) => {
        rsc += `add address=${a.address} interface=${a.interface} network=${a.network}${a.disabled ? ' disabled=yes' : ''}${a.comment ? ` comment="${a.comment}"` : ''}\n`;
      });
      rsc += `\n`;
    }

    // IP DNS
    if (cfg.dns.servers.length > 0 || (cfg.dns.staticEntries && cfg.dns.staticEntries.length > 0)) {
      rsc += `/ip dns\n`;
      rsc += `set servers=${cfg.dns.servers.join(',')} allow-remote-requests=${cfg.dns.allowRemoteRequests ? 'yes' : 'no'}\n`;
      if (cfg.dns.staticEntries && cfg.dns.staticEntries.length > 0) {
        rsc += `/ip dns static\n`;
        cfg.dns.staticEntries.forEach((st) => {
          rsc += `add name=${st.name} address=${st.address} ttl=${st.ttl || '1d'}${st.disabled ? ' disabled=yes' : ''}\n`;
        });
      }
      rsc += `\n`;
    }

    // IP Routes
    if (cfg.routes.length > 0) {
      rsc += `/ip route\n`;
      cfg.routes.forEach((r) => {
        const tableAttr = r.routingTable
          ? cfg.version === 'v7'
            ? ` routing-table=${r.routingTable}`
            : ` routing-mark=${r.routingTable}`
          : '';
        rsc += `add dst-address=${r.dstAddress} gateway=${r.gateway} distance=${r.distance}${tableAttr}${r.disabled ? ' disabled=yes' : ''}${r.comment ? ` comment="${r.comment}"` : ''}\n`;
      });
      rsc += `\n`;
    }

    // Firewall Filter
    if (cfg.firewall.filterRules.length > 0) {
      rsc += `/ip firewall filter\n`;
      cfg.firewall.filterRules.forEach((f) => {
        rsc += `add chain=${f.chain} action=${f.action}`;
        if (f.protocol) rsc += ` protocol=${f.protocol}`;
        if (f.srcAddress) rsc += ` src-address=${f.srcAddress}`;
        if (f.dstAddress) rsc += ` dst-address=${f.dstAddress}`;
        if (f.dstPort) rsc += ` dst-port=${f.dstPort}`;
        if (f.inInterface) rsc += ` in-interface=${f.inInterface}`;
        if (f.outInterface) rsc += ` out-interface=${f.outInterface}`;
        if (f.connectionState) rsc += ` connection-state=${f.connectionState}`;
        if (f.disabled) rsc += ` disabled=yes`;
        if (f.comment) rsc += ` comment="${f.comment}"`;
        rsc += `\n`;
      });
      rsc += `\n`;
    }

    // Firewall NAT
    if (cfg.firewall.natRules.length > 0) {
      rsc += `/ip firewall nat\n`;
      cfg.firewall.natRules.forEach((n) => {
        rsc += `add chain=${n.chain} action=${n.action}`;
        if (n.protocol) rsc += ` protocol=${n.protocol}`;
        if (n.srcAddress) rsc += ` src-address=${n.srcAddress}`;
        if (n.dstAddress) rsc += ` dst-address=${n.dstAddress}`;
        if (n.dstPort) rsc += ` dst-port=${n.dstPort}`;
        if (n.outInterface) rsc += ` out-interface=${n.outInterface}`;
        if (n.toAddresses) rsc += ` to-addresses=${n.toAddresses}`;
        if (n.toPorts) rsc += ` to-ports=${n.toPorts}`;
        if (n.disabled) rsc += ` disabled=yes`;
        if (n.comment) rsc += ` comment="${n.comment}"`;
        rsc += `\n`;
      });
      rsc += `\n`;
    }

    // Queues
    if (cfg.queues.length > 0) {
      rsc += `/queue simple\n`;
      cfg.queues.forEach((q) => {
        const upM = (q.maxLimitUploadBps / 1_000_000).toFixed(0);
        const downM = (q.maxLimitDownloadBps / 1_000_000).toFixed(0);
        rsc += `add name=${q.name} target=${q.target} max-limit=${upM}M/${downM}M priority=${q.priority || 8}${q.disabled ? ' disabled=yes' : ''}${q.comment ? ` comment="${q.comment}"` : ''}\n`;
      });
      rsc += `\n`;
    }

    return rsc;
  }

  /**
   * Computes a line-by-line configuration diff between a baseline .rsc script (e.g., backup snapshot)
   * and the current running .rsc script.
   */
  static computeConfigDiff(
    baseRsc: string,
    runningRsc: string
  ): Array<{ type: 'same' | 'added' | 'removed'; line: string }> {
    const baseLines = baseRsc
      .split('\n')
      .filter((l) => !l.startsWith('# ') && l.trim() !== '');
    const runningLines = runningRsc
      .split('\n')
      .filter((l) => !l.startsWith('# ') && l.trim() !== '');

    const result: Array<{ type: 'same' | 'added' | 'removed'; line: string }> = [];
    const baseSet = new Set(baseLines);
    const runningSet = new Set(runningLines);

    let i = 0;
    let j = 0;
    while (i < baseLines.length || j < runningLines.length) {
      const bLine = baseLines[i];
      const rLine = runningLines[j];

      if (bLine === rLine) {
        if (bLine !== undefined) {
          result.push({ type: 'same', line: bLine });
        }
        i++;
        j++;
      } else if (bLine !== undefined && !runningSet.has(bLine)) {
        result.push({ type: 'removed', line: bLine });
        i++;
      } else if (rLine !== undefined && !baseSet.has(rLine)) {
        result.push({ type: 'added', line: rLine });
        j++;
      } else {
        if (bLine !== undefined) {
          result.push({ type: 'removed', line: bLine });
          i++;
        }
        if (rLine !== undefined) {
          result.push({ type: 'added', line: rLine });
          j++;
        }
      }
    }

    return result;
  }

  // ==========================================
  // ROUTEROS 6 vs 7 VERSION COMPATIBILITY VALIDATOR
  // ==========================================

  static setRouterOsVersion(device: NetworkDevice, targetVersion: 'v6' | 'v7'): MutationResult {
    const config = this.ensureConfig(device);
    const nextConfig: RouterOsDeviceConfig = {
      ...config,
      version: targetVersion,
      lastModifiedAt: new Date().toISOString(),
    };
    return {
      success: true,
      config: nextConfig,
      message: `Switched ${device.name} RouterOS version profile to ${targetVersion === 'v7' ? 'v7 (7.15.2 stable)' : 'v6 (6.49.13 long-term)'}.`,
    };
  }

  static validateCommandVersionCompatibility(
    version: 'v6' | 'v7',
    contextPathStr: string,
    action: string,
    params: Record<string, string>,
    rawArgs: string[]
  ): { valid: boolean; error?: string } {
    const lowerArgs = rawArgs.map((a) => a.toLowerCase());
    const fullTokens = `${contextPathStr} ${action} ${lowerArgs.join(' ')}`.trim();

    // 1. Unsupported Subsystems Check (BGP, OSPF, MPLS, WireGuard, IPsec)
    if (fullTokens.includes('wireguard')) {
      if (version === 'v6') {
        return {
          valid: false,
          error: `syntax error: '/interface wireguard' is only supported in RouterOS v7+ (device is running RouterOS v6.49.13)`,
        };
      }
      return {
        valid: false,
        error: `unsupported feature: WireGuard crypto tunnel simulation is marked UNSUPPORTED in NETLAB engine`,
      };
    }

    if (
      fullTokens.includes('bgp') ||
      fullTokens.includes('ospf') ||
      fullTokens.includes('mpls') ||
      fullTokens.includes('ipsec')
    ) {
      return {
        valid: false,
        error: `unsupported feature: Dynamic routing (BGP/OSPF), MPLS, and IPsec are marked UNSUPPORTED in NETLAB simulation engine`,
      };
    }

    // 2. /ip route version-specific parameters: routing-table (v7) vs routing-mark (v6)
    if (contextPathStr === 'ip route' && (action === 'add' || action === 'set')) {
      if (params['routing-table'] !== undefined && version === 'v6') {
        return {
          valid: false,
          error: `syntax error: parameter 'routing-table' is only supported in RouterOS v7 (device runs RouterOS v6.49.13; use 'routing-mark=' instead)`,
        };
      }
      if (params['routing-mark'] !== undefined && version === 'v7') {
        return {
          valid: false,
          error: `syntax error: parameter 'routing-mark' was removed in RouterOS v7 (device runs RouterOS v7.15.2; use 'routing-table=' instead)`,
        };
      }
    }

    // 3. /export version-specific flags: show-sensitive (v7) vs hide-sensitive (v6)
    if (action === 'export') {
      if (lowerArgs.includes('show-sensitive') && version === 'v6') {
        return {
          valid: false,
          error: `syntax error: 'show-sensitive' is a RouterOS v7 parameter (RouterOS v6 exports sensitive fields by default unless 'hide-sensitive' is specified)`,
        };
      }
      if (lowerArgs.includes('hide-sensitive') && version === 'v7') {
        return {
          valid: false,
          error: `syntax error: 'hide-sensitive' is a RouterOS v6 parameter (RouterOS v7 hides sensitive fields by default; use 'show-sensitive' in v7)`,
        };
      }
    }

    return { valid: true };
  }
}

