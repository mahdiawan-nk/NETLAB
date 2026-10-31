import { NetworkDevice, NetworkProject } from '../types/network';
import { MangleAction, MangleChain, MangleRule, RouterOsDeviceConfig } from '../types/routerOs';
import { RouterOsConfigService, MutationResult } from './routerOsConfigService';
import { simulatePacketTrace } from './simulationEngine';

export interface CliCommandContext {
  path: string[]; // e.g. ['ip', 'address'] -> /ip address
}

export interface CliExecutionOutput {
  output: string;
  nextPath: string[];
  newConfig?: RouterOsDeviceConfig;
  error?: boolean;
}

export class RouterOsCliEngine {
  /**
   * Format prompt string: e.g. [admin@CORE-CCR2116] /ip address>
   */
  static getPrompt(identity: string, path: string[]): string {
    const pathStr = path.length === 0 ? '' : ' /' + path.join(' ');
    return `[admin@${identity || 'MikroTik'}]${pathStr}> `;
  }

  /**
   * Parse key=value parameters from token list, e.g. address=192.168.88.1/24 interface=ether1
   */
  static parseKeyValueParams(tokens: string[]): Record<string, string> {
    const params: Record<string, string> = {};
    for (const token of tokens) {
      if (token.includes('=')) {
        const eqIdx = token.indexOf('=');
        const key = token.slice(0, eqIdx).toLowerCase();
        let val = token.slice(eqIdx + 1);
        // Strip quotes if wrapped
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        params[key] = val;
      }
    }
    return params;
  }

  private static parseMangleRuleParams(
    params: Record<string, string>,
    isUpdate = false
  ): Partial<MangleRule> & { placeBefore?: number } {
    const out: Partial<MangleRule> & { placeBefore?: number } = {};

    if (params['chain'] !== undefined) out.chain = params['chain'] as MangleChain;
    else if (!isUpdate) out.chain = 'prerouting';

    if (params['action'] !== undefined) out.action = params['action'] as MangleAction;
    else if (!isUpdate) out.action = 'accept';

    if (params['src-address'] !== undefined) out.srcAddress = params['src-address'];
    if (params['dst-address'] !== undefined) out.dstAddress = params['dst-address'];
    if (params['protocol'] !== undefined) out.protocol = params['protocol'] as any;
    if (params['src-port'] !== undefined) out.srcPort = params['src-port'];
    if (params['dst-port'] !== undefined) out.dstPort = params['dst-port'];
    if (params['in-interface'] !== undefined) out.inInterface = params['in-interface'];
    if (params['out-interface'] !== undefined) out.outInterface = params['out-interface'];
    if (params['in-interface-list'] !== undefined) out.inInterfaceList = params['in-interface-list'];
    if (params['out-interface-list'] !== undefined) out.outInterfaceList = params['out-interface-list'];

    if (params['src-address-list'] !== undefined) out.srcAddressList = params['src-address-list'];
    if (params['dst-address-list'] !== undefined) out.dstAddressList = params['dst-address-list'];
    if (params['connection-state'] !== undefined) out.connectionState = params['connection-state'];
    if (params['connection-mark'] !== undefined) out.connectionMark = params['connection-mark'];
    if (params['packet-mark'] !== undefined) out.packetMark = params['packet-mark'];
    if (params['routing-mark'] !== undefined) out.routingMark = params['routing-mark'];

    const pktLen = params['packet-length'] ?? params['packet-size'];
    if (pktLen !== undefined) out.packetLength = pktLen;

    if (params['dscp'] !== undefined) {
      const parsedDscp = parseInt(params['dscp'], 10);
      if (!isNaN(parsedDscp)) out.dscp = parsedDscp;
    }

    const prio = params['priority'] ?? params['ingress-priority'];
    if (prio !== undefined) {
      const parsedPrio = parseInt(prio, 10);
      if (!isNaN(parsedPrio)) out.priority = parsedPrio;
    }

    const pcc = params['per-connection-classifier'] ?? params['pcc'];
    if (pcc !== undefined) out.pcc = pcc;

    if (params['limit'] !== undefined) out.limit = params['limit'];
    if (params['time'] !== undefined) out.time = params['time'];
    if (params['layer7-protocol'] !== undefined) out.layer7Protocol = params['layer7-protocol'];
    if (params['connection-bytes'] !== undefined) out.connectionBytes = params['connection-bytes'];
    if (params['connection-rate'] !== undefined) out.connectionRate = params['connection-rate'];

    if (params['new-connection-mark'] !== undefined) out.newConnectionMark = params['new-connection-mark'];
    if (params['new-packet-mark'] !== undefined) out.newPacketMark = params['new-packet-mark'];
    if (params['new-routing-mark'] !== undefined) out.newRoutingMark = params['new-routing-mark'];
    if (params['address-list'] !== undefined) out.addressList = params['address-list'];
    if (params['address-list-timeout'] !== undefined) out.addressListTimeout = params['address-list-timeout'];

    if (params['new-dscp'] !== undefined) {
      const parsedNewDscp = parseInt(params['new-dscp'], 10);
      if (!isNaN(parsedNewDscp)) out.newDscp = parsedNewDscp;
    }
    if (params['new-mss'] !== undefined) {
      const parsedNewMss = parseInt(params['new-mss'], 10);
      if (!isNaN(parsedNewMss)) out.newMss = parsedNewMss;
    }
    if (params['new-ttl'] !== undefined) out.newTtl = params['new-ttl'];
    if (params['log-prefix'] !== undefined) out.logPrefix = params['log-prefix'];

    if (params['passthrough'] !== undefined) {
      out.passthrough = params['passthrough'].toLowerCase() !== 'no' && params['passthrough'].toLowerCase() !== 'false';
    }
    if (params['comment'] !== undefined) out.comment = params['comment'];
    if (params['disabled'] !== undefined) {
      out.disabled = params['disabled'].toLowerCase() === 'yes' || params['disabled'].toLowerCase() === 'true';
    }
    if (params['place-before'] !== undefined) {
      const pb = parseInt(params['place-before'], 10);
      if (!isNaN(pb)) out.placeBefore = pb;
    }

    return out;
  }

  /**
   * Main CLI command executor
   */
  static execute(
    rawCommand: string,
    currentPath: string[],
    device: NetworkDevice,
    project: NetworkProject,
    mutateConfig: (
      actionName: string,
      mutationFn: (dev: NetworkDevice, cfg: RouterOsDeviceConfig) => MutationResult
    ) => MutationResult
  ): CliExecutionOutput {
    const trimmed = rawCommand.trim();
    if (!trimmed) {
      return { output: '', nextPath: currentPath };
    }

    // Comments in RouterOS
    if (trimmed.startsWith('#')) {
      return { output: '', nextPath: currentPath };
    }

    // 1. Root / Navigation handling
    if (trimmed === '/') {
      return { output: '', nextPath: [] };
    }
    if (trimmed === '..' || trimmed === 'cd ..') {
      return { output: '', nextPath: currentPath.slice(0, -1) };
    }

    // Tokenize
    const tokens = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    if (tokens.length === 0) return { output: '', nextPath: currentPath };

    let effectivePath = [...currentPath];
    let commandTokens = [...tokens];

    // If command starts with '/', it resets path from root
    if (commandTokens[0].startsWith('/')) {
      const firstToken = commandTokens[0].slice(1);
      effectivePath = [];
      if (firstToken) {
        commandTokens[0] = firstToken;
      } else {
        commandTokens.shift();
      }
    }

    // Check if tokens navigate deeper into context menu
    // Known top-level menus
    const knownMenus = [
      'interface',
      'interface ethernet',
      'interface bridge',
      'interface bridge port',
      'interface vlan',
      'interface list',
      'interface list member',
      'ip',
      'ip address',
      'ip route',
      'ip dns',
      'ip dns static',
      'ip pool',
      'ip dhcp-server',
      'ip dhcp-server network',
      'ip firewall',
      'ip firewall filter',
      'ip firewall nat',
      'ip firewall mangle',
      'ip firewall address-list',
      'ip firewall connection',
      'routing',
      'routing table',
      'queue',
      'queue simple',
      'queue tree',
      'system',
      'system identity',
      'system resource',
      'system backup',
      'tool',
    ];

    // Try to match leading tokens to a menu path
    let matchedMenuPath: string[] = [];
    for (let len = Math.min(3, commandTokens.length); len >= 1; len--) {
      const candidate = [...effectivePath, ...commandTokens.slice(0, len)].join(' ').toLowerCase();
      if (knownMenus.includes(candidate)) {
        matchedMenuPath = candidate.split(' ');
        commandTokens = commandTokens.slice(len);
        effectivePath = matchedMenuPath;
        break;
      }
    }

    // If no action tokens remain, we simply changed directory
    if (commandTokens.length === 0) {
      return { output: '', nextPath: effectivePath };
    }

    const action = commandTokens[0].toLowerCase();
    const actionArgs = commandTokens.slice(1);
    const contextPathStr = effectivePath.join(' ');
    const params = this.parseKeyValueParams(actionArgs);
    const config = RouterOsConfigService.ensureConfig(device);

    // ==========================================
    // ROUTEROS 6 vs 7 VERSION COMPATIBILITY CHECK
    // ==========================================
    const compatCheck = RouterOsConfigService.validateCommandVersionCompatibility(
      config.version,
      contextPathStr,
      action,
      params,
      actionArgs
    );
    if (!compatCheck.valid) {
      return {
        output: compatCheck.error || 'Command not compatible with current RouterOS version.',
        nextPath: effectivePath,
        error: true,
      };
    }

    // ==========================================
    // GLOBAL ACTIONS (clear, ping, traceroute, export, help)
    // ==========================================

    if (action === 'clear' || action === 'cls') {
      return { output: '__CLEAR__', nextPath: effectivePath };
    }

    if (action === 'export') {
      const rsc = RouterOsConfigService.exportRscScript(device);
      return { output: rsc, nextPath: effectivePath };
    }

    if (action === 'help' || action === '?') {
      return {
        output: this.getHelpText(contextPathStr),
        nextPath: effectivePath,
      };
    }

    if (action === 'ping') {
      const targetIp = actionArgs[0];
      if (!targetIp) {
        return { output: 'syntax error: expected IP address to ping', nextPath: effectivePath, error: true };
      }
      return {
        output: this.executePing(device, targetIp, project),
        nextPath: effectivePath,
      };
    }

    if (action === 'traceroute' || (contextPathStr === 'tool' && action === 'traceroute')) {
      const targetIp = actionArgs[0];
      if (!targetIp) {
        return { output: 'syntax error: expected target IP for traceroute', nextPath: effectivePath, error: true };
      }
      return {
        output: this.executeTraceroute(device, targetIp, project),
        nextPath: effectivePath,
      };
    }

    // ==========================================
    // MENU-SPECIFIC HANDLERS
    // ==========================================

    // 1. /IP ADDRESS
    if (contextPathStr === 'ip address') {
      if (action === 'print' || action === 'pr') {
        return { output: this.printIpAddresses(config), nextPath: effectivePath };
      }
      if (action === 'add') {
        const address = params['address'];
        const iface = params['interface'];
        const comment = params['comment'];
        const disabled = params['disabled'] === 'yes';

        if (!address || !iface) {
          return { output: 'failure: both address and interface are required', nextPath: effectivePath, error: true };
        }

        const res = mutateConfig('Add IP Address', (dev) =>
          RouterOsConfigService.addIpAddress(dev, { address, interface: iface, comment, disabled })
        );

        if (!res.success) {
          return { output: res.error || 'Failed to add address', nextPath: effectivePath, error: true };
        }
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'remove' || action === 'rm') {
        const id = actionArgs[0] || params['numbers'];
        if (!id) return { output: 'syntax error: expected item number or id to remove', nextPath: effectivePath, error: true };
        const res = mutateConfig('Remove IP Address', (dev) =>
          RouterOsConfigService.removeIpAddress(dev, id)
        );
        if (!res.success) return { output: res.error || 'Failed to remove', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'set') {
        const id = (actionArgs[0] && !actionArgs[0].includes('=') ? actionArgs[0] : undefined) || params['numbers'];
        if (!id) return { output: 'syntax error: expected item number or id to set', nextPath: effectivePath, error: true };
        const res = mutateConfig('Set IP Address', (dev) =>
          RouterOsConfigService.setIpAddress(dev, id, {
            address: params['address'],
            interface: params['interface'],
            comment: params['comment'],
            disabled: params['disabled'] ? params['disabled'] === 'yes' : undefined,
          })
        );
        if (!res.success) return { output: res.error || 'Failed to set item', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'disable' || action === 'enable') {
        const id = actionArgs[0] || params['numbers'];
        if (!id) return { output: `syntax error: expected item number to ${action}`, nextPath: effectivePath, error: true };
        const res = mutateConfig(`${action.toUpperCase()} IP Address`, (dev) =>
          RouterOsConfigService.setIpAddress(dev, id, { disabled: action === 'disable' })
        );
        if (!res.success) return { output: res.error || 'Failed', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 2. /INTERFACE
    if (contextPathStr === 'interface' || contextPathStr === 'interface ethernet') {
      if (action === 'print' || action === 'pr') {
        return { output: this.printInterfaces(config), nextPath: effectivePath };
      }
      if (action === 'enable' || action === 'disable') {
        const id = actionArgs[0];
        const target = config.interfaces.find((i, idx) => i.name === id || String(idx) === id);
        if (!target) return { output: `no such interface (${id})`, nextPath: effectivePath, error: true };
        const res = mutateConfig(`${action.toUpperCase()} Interface`, (_, cfg) => {
          const updated = cfg.interfaces.map((i) => (i.name === target.name ? { ...i, disabled: action === 'disable' } : i));
          return { success: true, config: { ...cfg, interfaces: updated } };
        });
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'set') {
        const id = actionArgs[0];
        const target = config.interfaces.find((i, idx) => i.name === id || String(idx) === id);
        if (!target) return { output: `no such interface (${id})`, nextPath: effectivePath, error: true };
        const res = mutateConfig('Set Interface', (_, cfg) => {
          const updated = cfg.interfaces.map((i) => {
            if (i.name !== target.name) return i;
            return {
              ...i,
              comment: params['comment'] !== undefined ? params['comment'] : i.comment,
              mtu: params['mtu'] ? parseInt(params['mtu'], 10) : i.mtu,
              disabled: params['disabled'] ? params['disabled'] === 'yes' : i.disabled,
            };
          });
          return { success: true, config: { ...cfg, interfaces: updated } };
        });
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 3. /INTERFACE BRIDGE
    if (contextPathStr === 'interface bridge') {
      if (action === 'print' || action === 'pr') {
        return { output: this.printBridges(config), nextPath: effectivePath };
      }
      if (action === 'add') {
        const name = params['name'] || `bridge${config.bridges.length + 1}`;
        const vlanFiltering = params['vlan-filtering'] === 'yes';
        const comment = params['comment'];
        const res = mutateConfig('Add Bridge', (dev) =>
          RouterOsConfigService.addBridge(dev, { name, vlanFiltering, comment })
        );
        if (!res.success) return { output: res.error || 'Failed to add bridge', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'remove' || action === 'rm') {
        const id = actionArgs[0];
        if (!id) return { output: 'syntax error: expected bridge name or index', nextPath: effectivePath, error: true };
        const res = mutateConfig('Remove Bridge', (dev) => RouterOsConfigService.removeBridge(dev, id));
        if (!res.success) return { output: res.error || 'Failed to remove', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 4. /INTERFACE BRIDGE PORT
    if (contextPathStr === 'interface bridge port') {
      if (action === 'print' || action === 'pr') {
        return { output: this.printBridgePorts(config), nextPath: effectivePath };
      }
      if (action === 'add') {
        const bridge = params['bridge'] || config.bridges[0]?.name;
        const iface = params['interface'];
        const pvid = params['pvid'] ? parseInt(params['pvid'], 10) : 1;
        if (!bridge || !iface) {
          return { output: 'failure: bridge and interface parameters required', nextPath: effectivePath, error: true };
        }
        const res = mutateConfig('Add Bridge Port', (dev) =>
          RouterOsConfigService.addBridgePort(dev, { bridge, interface: iface, pvid })
        );
        if (!res.success) return { output: res.error || 'Failed to add bridge port', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'remove' || action === 'rm') {
        const id = actionArgs[0];
        if (!id) return { output: 'syntax error: expected bridge port index', nextPath: effectivePath, error: true };
        const res = mutateConfig('Remove Bridge Port', (dev) => RouterOsConfigService.removeBridgePort(dev, id));
        if (!res.success) return { output: res.error || 'Failed to remove', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 5. /INTERFACE VLAN
    if (contextPathStr === 'interface vlan') {
      if (action === 'print' || action === 'pr') {
        return { output: this.printVlans(config), nextPath: effectivePath };
      }
      if (action === 'add') {
        const name = params['name'];
        const vlanId = params['vlan-id'] ? parseInt(params['vlan-id'], 10) : undefined;
        const iface = params['interface'];
        const comment = params['comment'];
        if (!name || !vlanId || !iface) {
          return { output: 'failure: name, vlan-id, and interface parameters required', nextPath: effectivePath, error: true };
        }
        const res = mutateConfig('Add VLAN Interface', (dev) =>
          RouterOsConfigService.addVlan(dev, { name, vlanId, interface: iface, comment })
        );
        if (!res.success) return { output: res.error || 'Failed to add VLAN', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'remove' || action === 'rm') {
        const id = actionArgs[0];
        if (!id) return { output: 'syntax error: expected vlan name or index', nextPath: effectivePath, error: true };
        const res = mutateConfig('Remove VLAN', (dev) => RouterOsConfigService.removeVlan(dev, id));
        if (!res.success) return { output: res.error || 'Failed to remove', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 5B. /INTERFACE LIST & /INTERFACE LIST MEMBER
    if (contextPathStr === 'interface list') {
      if (action === 'print' || action === 'pr') {
        let out = `Flags: * - builtin\n #   NAME            COMMENT\n`;
        (config.interfaceLists || []).forEach((l, idx) => {
          out += ` ${String(idx).padEnd(3)} ${l.name.padEnd(15)} ${l.comment || ''}\n`;
        });
        return { output: out, nextPath: effectivePath };
      }
    }
    if (contextPathStr === 'interface list member') {
      if (action === 'print' || action === 'pr') {
        let out = `Flags: X - disabled\n #   LIST            INTERFACE\n`;
        (config.interfaceListMembers || []).forEach((m, idx) => {
          const flag = m.disabled ? 'X ' : '  ';
          out += `${flag}${String(idx).padEnd(3)} ${m.list.padEnd(15)} ${m.interface}\n`;
        });
        return { output: out, nextPath: effectivePath };
      }
    }

    // 6. /IP ROUTE
    if (contextPathStr === 'ip route') {
      if (action === 'print' || action === 'pr') {
        return { output: this.printRoutes(config), nextPath: effectivePath };
      }
      if (action === 'add') {
        const dstAddress = params['dst-address'] || '0.0.0.0/0';
        const gateway = params['gateway'];
        const distance = params['distance'] ? parseInt(params['distance'], 10) : 1;
        const routingTable = params['routing-table'];
        const routingMark = params['routing-mark'];
        const comment = params['comment'];
        if (!gateway) {
          return { output: 'failure: gateway parameter required', nextPath: effectivePath, error: true };
        }
        const res = mutateConfig('Add IP Route', (dev) =>
          RouterOsConfigService.addRoute(dev, {
            dstAddress,
            gateway,
            distance,
            routingTable,
            routingMark,
            comment,
          })
        );
        if (!res.success) return { output: res.error || 'Failed to add route', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'remove' || action === 'rm') {
        const id = actionArgs[0] || params['numbers'];
        if (!id) return { output: 'syntax error: expected route index', nextPath: effectivePath, error: true };
        const res = mutateConfig('Remove Route', (dev) => RouterOsConfigService.removeRoute(dev, id));
        if (!res.success) return { output: res.error || 'Failed to remove', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 6B. /ROUTING TABLE
    if (contextPathStr === 'routing table') {
      if (action === 'print' || action === 'pr') {
        return { output: this.printRoutingTables(config), nextPath: effectivePath };
      }
      if (action === 'add') {
        const name = params['name'];
        const fib = params['fib'] !== 'no';
        const comment = params['comment'];
        const disabled = params['disabled'] === 'yes';
        if (!name) {
          return { output: 'failure: name parameter required (e.g. /routing table add name=ke-isp2 fib)', nextPath: effectivePath, error: true };
        }
        const res = mutateConfig(`Add Routing Table (${name})`, (dev) =>
          RouterOsConfigService.addRoutingTable(dev, { name, fib, comment, disabled })
        );
        if (!res.success) return { output: res.error || 'Failed to add routing table', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'remove' || action === 'rm') {
        const id = actionArgs[0] || params['numbers'];
        if (!id) return { output: 'syntax error: expected routing table index or name', nextPath: effectivePath, error: true };
        const res = mutateConfig('Remove Routing Table', (dev) => RouterOsConfigService.removeRoutingTable(dev, id));
        if (!res.success) return { output: res.error || 'Failed to remove routing table', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 7. /IP FIREWALL FILTER
    if (contextPathStr === 'ip firewall filter') {
      if (action === 'print' || action === 'pr') {
        return { output: this.printFirewallFilter(config), nextPath: effectivePath };
      }
      if (action === 'add') {
        const chain = (params['chain'] || 'forward') as any;
        const act = (params['action'] || 'accept') as any;
        const protocol = params['protocol'] as any;
        const srcAddress = params['src-address'];
        const dstAddress = params['dst-address'];
        const inInterface = params['in-interface'];
        const outInterface = params['out-interface'];
        const connectionMark = params['connection-mark'];
        const packetMark = params['packet-mark'];
        const routingMark = params['routing-mark'];
        const srcAddressList = params['src-address-list'];
        const dstAddressList = params['dst-address-list'];
        const comment = params['comment'];

        const res = mutateConfig('Add Firewall Filter Rule', (dev) =>
          RouterOsConfigService.addFirewallRule(dev, {
            chain,
            action: act,
            protocol,
            srcAddress,
            dstAddress,
            inInterface,
            outInterface,
            connectionMark,
            packetMark,
            routingMark,
            srcAddressList,
            dstAddressList,
            disabled: params['disabled'] === 'yes',
            comment,
          })
        );
        if (!res.success) return { output: res.error || 'Failed to add rule', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'remove' || action === 'rm') {
        const id = actionArgs[0] || params['numbers'];
        if (!id) return { output: 'syntax error: expected rule index', nextPath: effectivePath, error: true };
        const res = mutateConfig('Remove Firewall Rule', (dev) => RouterOsConfigService.removeFirewallRule(dev, id));
        if (!res.success) return { output: res.error || 'Failed to remove', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 8. /IP FIREWALL NAT
    if (contextPathStr === 'ip firewall nat') {
      if (action === 'print' || action === 'pr') {
        return { output: this.printFirewallNat(config), nextPath: effectivePath };
      }
      if (action === 'add') {
        const chain = (params['chain'] || 'srcnat') as any;
        const act = (params['action'] || 'masquerade') as any;
        const outInterface = params['out-interface'];
        const toAddresses = params['to-addresses'];
        const connectionMark = params['connection-mark'];
        const packetMark = params['packet-mark'];
        const routingMark = params['routing-mark'];
        const srcAddressList = params['src-address-list'];
        const dstAddressList = params['dst-address-list'];
        const comment = params['comment'];

        const res = mutateConfig('Add NAT Rule', (dev) =>
          RouterOsConfigService.addNatRule(dev, {
            chain,
            action: act,
            outInterface,
            toAddresses,
            connectionMark,
            packetMark,
            routingMark,
            srcAddressList,
            dstAddressList,
            disabled: params['disabled'] === 'yes',
            comment,
          })
        );
        if (!res.success) return { output: res.error || 'Failed to add NAT rule', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'remove' || action === 'rm') {
        const id = actionArgs[0] || params['numbers'];
        if (!id) return { output: 'syntax error: expected nat rule index', nextPath: effectivePath, error: true };
        const res = mutateConfig('Remove NAT Rule', (dev) => RouterOsConfigService.removeNatRule(dev, id));
        if (!res.success) return { output: res.error || 'Failed to remove', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 8B. /IP FIREWALL MANGLE
    if (contextPathStr === 'ip firewall mangle') {
      if (action === 'print' || action === 'pr') {
        const subArg = (actionArgs[0] || '').toLowerCase();
        if (subArg === 'detail' || subArg === 'det') {
          return { output: this.printFirewallMangleDetail(config), nextPath: effectivePath };
        }
        if (subArg === 'stats' || subArg === 'st') {
          return { output: this.printFirewallMangleStats(config), nextPath: effectivePath };
        }
        return { output: this.printFirewallMangle(config), nextPath: effectivePath };
      }

      if (action === 'add') {
        const ruleParams = this.parseMangleRuleParams(params, false);
        const res = mutateConfig(`Add Mangle Rule (${ruleParams.chain} -> ${ruleParams.action})`, (dev) =>
          RouterOsConfigService.addMangleRule(dev, ruleParams as any)
        );
        if (!res.success) {
          return { output: res.error || 'Failed to add mangle rule', nextPath: effectivePath, error: true };
        }
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }

      if (action === 'set') {
        const id = (actionArgs[0] && !actionArgs[0].includes('=') ? actionArgs[0] : undefined) || params['numbers'];
        if (!id) {
          return { output: 'syntax error: expected mangle rule number or id to set', nextPath: effectivePath, error: true };
        }
        const updates = this.parseMangleRuleParams(params, true);
        const res = mutateConfig(`Update Mangle Rule #${id}`, (dev) =>
          RouterOsConfigService.updateMangleRule(dev, id, updates)
        );
        if (!res.success) {
          return { output: res.error || 'Failed to update mangle rule', nextPath: effectivePath, error: true };
        }
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }

      if (action === 'remove' || action === 'rm') {
        const id = (actionArgs[0] && !actionArgs[0].includes('=') ? actionArgs[0] : undefined) || params['numbers'];
        if (!id) {
          return { output: 'syntax error: expected mangle rule number or id to remove', nextPath: effectivePath, error: true };
        }
        const res = mutateConfig(`Remove Mangle Rule #${id}`, (dev) =>
          RouterOsConfigService.removeMangleRule(dev, id)
        );
        if (!res.success) {
          return { output: res.error || 'Failed to remove mangle rule', nextPath: effectivePath, error: true };
        }
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }

      if (action === 'enable' || action === 'disable') {
        const id = (actionArgs[0] && !actionArgs[0].includes('=') ? actionArgs[0] : undefined) || params['numbers'];
        if (!id) {
          return { output: `syntax error: expected mangle rule number or id to ${action}`, nextPath: effectivePath, error: true };
        }
        const res = mutateConfig(`${action.toUpperCase()} Mangle Rule #${id}`, (dev) =>
          RouterOsConfigService.setMangleRuleDisabled(dev, id, action === 'disable')
        );
        if (!res.success) {
          return { output: res.error || `Failed to ${action} mangle rule`, nextPath: effectivePath, error: true };
        }
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }

      if (action === 'move') {
        const nonKvArgs = actionArgs.filter((a) => !a.includes('='));
        const idOrIdx = nonKvArgs[0] || params['numbers'];
        const destStr = nonKvArgs[1] ?? params['destination'];
        if (!idOrIdx || destStr === undefined) {
          return {
            output: 'syntax error: expected rule index and destination index (e.g. move 2 0)',
            nextPath: effectivePath,
            error: true,
          };
        }
        const destIdx = parseInt(destStr, 10);
        if (isNaN(destIdx)) {
          return { output: 'failure: invalid destination index', nextPath: effectivePath, error: true };
        }
        const res = mutateConfig(`Move Mangle Rule #${idOrIdx} to ${destIdx}`, (dev) =>
          RouterOsConfigService.moveMangleRule(dev, idOrIdx, destIdx)
        );
        if (!res.success) {
          return { output: res.error || 'Failed to move mangle rule', nextPath: effectivePath, error: true };
        }
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }

      if (action === 'reset-counters') {
        const id = (actionArgs[0] && !actionArgs[0].includes('=') ? actionArgs[0] : undefined) || params['numbers'];
        const res = mutateConfig(id ? `Reset Mangle Rule #${id} Counters` : 'Reset All Mangle Counters', (dev) =>
          RouterOsConfigService.resetMangleCounters(dev, id)
        );
        if (!res.success) {
          return { output: res.error || 'Failed to reset counters', nextPath: effectivePath, error: true };
        }
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }

      if (action === 'reset-counters-all') {
        const res = mutateConfig('Reset All Mangle Counters', (dev) =>
          RouterOsConfigService.resetMangleCounters(dev)
        );
        if (!res.success) {
          return { output: res.error || 'Failed to reset all counters', nextPath: effectivePath, error: true };
        }
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 8C. /IP FIREWALL ADDRESS-LIST
    if (contextPathStr === 'ip firewall address-list') {
      if (action === 'print' || action === 'pr') {
        return { output: this.printAddressLists(config), nextPath: effectivePath };
      }
      if (action === 'add') {
        const list = params['list'];
        const address = params['address'];
        const timeout = params['timeout'];
        const comment = params['comment'];
        const disabled = params['disabled'] === 'yes';
        if (!list || !address) {
          return { output: 'failure: list and address parameters are required', nextPath: effectivePath, error: true };
        }
        const res = mutateConfig(`Add Address List (${list}: ${address})`, (dev) =>
          RouterOsConfigService.addAddressListEntry(dev, { list, address, timeout, comment, disabled })
        );
        if (!res.success) return { output: res.error || 'Failed to add address-list entry', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'remove' || action === 'rm') {
        const id = actionArgs[0] || params['numbers'];
        if (!id) return { output: 'syntax error: expected address-list entry index', nextPath: effectivePath, error: true };
        const res = mutateConfig('Remove Address List Entry', (dev) =>
          RouterOsConfigService.removeAddressListEntry(dev, id)
        );
        if (!res.success) return { output: res.error || 'Failed to remove entry', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 8D. /IP FIREWALL CONNECTION
    if (contextPathStr === 'ip firewall connection') {
      if (action === 'print' || action === 'pr') {
        return { output: this.printConnections(config), nextPath: effectivePath };
      }
    }

    // 9. /QUEUE SIMPLE
    if (contextPathStr === 'queue simple') {
      if (action === 'print' || action === 'pr') {
        return { output: this.printQueues(config), nextPath: effectivePath };
      }
      if (action === 'add') {
        const name = params['name'];
        const target = params['target'] || '0.0.0.0/0';
        const maxLimit = params['max-limit']; // e.g. 5M/10M (upload/download)
        const packetMarks = params['packet-marks'] || params['packet-mark'];
        const priorityStr = params['priority'];
        const priority = priorityStr ? parseInt(priorityStr.split('/')[0], 10) : 8;
        const comment = params['comment'];

        if (!name || !maxLimit) {
          return { output: 'failure: name and max-limit (e.g. 5M/10M) are required', nextPath: effectivePath, error: true };
        }

        const [upStr, downStr] = maxLimit.split('/');
        const upBps = this.parseSpeedStringToBps(upStr || '10M');
        const downBps = this.parseSpeedStringToBps(downStr || upStr || '10M');

        const res = mutateConfig('Add Simple Queue', (dev) =>
          RouterOsConfigService.addSimpleQueue(dev, {
            name,
            target,
            maxLimitUploadBps: upBps,
            maxLimitDownloadBps: downBps,
            packetMarks,
            priority: isNaN(priority) ? 8 : priority,
            comment,
          })
        );
        if (!res.success) return { output: res.error || 'Failed to add queue', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'remove' || action === 'rm') {
        const id = actionArgs[0] || params['numbers'];
        if (!id) return { output: 'syntax error: expected queue name or index', nextPath: effectivePath, error: true };
        const res = mutateConfig('Remove Queue', (dev) => RouterOsConfigService.removeSimpleQueue(dev, id));
        if (!res.success) return { output: res.error || 'Failed to remove', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 9B. /QUEUE TREE
    if (contextPathStr === 'queue tree') {
      if (action === 'print' || action === 'pr') {
        return { output: this.printQueueTree(config), nextPath: effectivePath };
      }
      if (action === 'add') {
        const name = params['name'];
        const parent = params['parent'] || 'global';
        const packetMark = params['packet-mark'] || params['packet-marks'];
        const maxLimitStr = params['max-limit'] || '100M';
        const priority = params['priority'] ? parseInt(params['priority'], 10) : 8;
        const comment = params['comment'];
        const disabled = params['disabled'] === 'yes';

        if (!name) {
          return { output: 'failure: name parameter is required', nextPath: effectivePath, error: true };
        }

        const maxLimitBps = this.parseSpeedStringToBps(maxLimitStr);
        const res = mutateConfig(`Add Queue Tree (${name})`, (dev) =>
          RouterOsConfigService.addQueueTree(dev, {
            name,
            parent,
            packetMark,
            maxLimitBps,
            priority: isNaN(priority) ? 8 : priority,
            disabled,
            comment,
          })
        );
        if (!res.success) return { output: res.error || 'Failed to add queue tree', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'remove' || action === 'rm') {
        const id = actionArgs[0] || params['numbers'];
        if (!id) return { output: 'syntax error: expected queue tree name or index', nextPath: effectivePath, error: true };
        const res = mutateConfig('Remove Queue Tree', (dev) => RouterOsConfigService.removeQueueTree(dev, id));
        if (!res.success) return { output: res.error || 'Failed to remove queue tree', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 10. /SYSTEM IDENTITY
    if (contextPathStr === 'system identity') {
      if (action === 'print' || action === 'pr') {
        return { output: `name: ${config.identity.name}`, nextPath: effectivePath };
      }
      if (action === 'set') {
        const name = params['name'] || actionArgs[0];
        if (!name) return { output: 'failure: name parameter required', nextPath: effectivePath, error: true };
        const res = mutateConfig('Set System Identity', (dev) => RouterOsConfigService.setIdentity(dev, name));
        if (!res.success) return { output: res.error || 'Failed to set identity', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 11. /SYSTEM RESOURCE
    if (contextPathStr === 'system resource') {
      if (action === 'print' || action === 'pr') {
        const res = RouterOsConfigService.getSystemResource(device);
        const formatMb = (b: number) => (b / (1024 * 1024)).toFixed(1) + 'MiB';
        return {
          output: `                   uptime: 3d14h22m
                  version: ${res.version}
               build-time: ${res.buildTime}
              free-memory: ${formatMb(res.freeMemoryBytes)}
             total-memory: ${formatMb(res.totalMemoryBytes)}
                      cpu: ${res.cpuModel}
                cpu-count: ${res.cpuCount}
            cpu-frequency: ${res.cpuFrequencyMhz}MHz
                 cpu-load: ${res.cpuLoadPercent}%
           free-hdd-space: ${formatMb(res.freeHddSpaceBytes)}
          total-hdd-space: ${formatMb(res.totalHddSpaceBytes)}
             architecture: ${res.architecture}
               board-name: ${res.boardName}`,
          nextPath: effectivePath,
        };
      }
    }

    // 12. /IP POOL
    if (contextPathStr === 'ip pool') {
      if (action === 'print' || action === 'pr') {
        if (config.ipPools.length === 0) return { output: 'No IP pools configured.', nextPath: effectivePath };
        let out = ` # NAME                 RANGES\n`;
        config.ipPools.forEach((p, idx) => {
          out += ` ${String(idx).padEnd(2)} ${p.name.padEnd(20)} ${p.ranges}\n`;
        });
        return { output: out, nextPath: effectivePath };
      }
      if (action === 'add') {
        const name = params['name'];
        const ranges = params['ranges'];
        if (!name || !ranges) {
          return { output: 'failure: name and ranges parameters required', nextPath: effectivePath, error: true };
        }
        const res = mutateConfig('Add IP Pool', (dev) => RouterOsConfigService.addIpPool(dev, { name, ranges }));
        if (!res.success) return { output: res.error || 'Failed to add pool', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'remove' || action === 'rm') {
        const id = actionArgs[0];
        if (!id) return { output: 'syntax error: expected pool index or name', nextPath: effectivePath, error: true };
        const res = mutateConfig('Remove IP Pool', (dev) => RouterOsConfigService.removeIpPool(dev, id));
        if (!res.success) return { output: res.error || 'Failed to remove', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 13. /IP DHCP-SERVER
    if (contextPathStr === 'ip dhcp-server') {
      if (action === 'print' || action === 'pr') {
        if (config.dhcpServers.length === 0) return { output: 'No DHCP servers configured.', nextPath: effectivePath };
        let out = `Flags: X - disabled\n #   NAME            INTERFACE       ADDRESS-POOL      LEASE-TIME\n`;
        config.dhcpServers.forEach((s, idx) => {
          const flag = s.disabled ? 'X ' : '  ';
          out += `${flag}${String(idx).padEnd(3)} ${s.name.padEnd(15)} ${s.interface.padEnd(15)} ${s.addressPool.padEnd(17)} ${s.leaseTime}\n`;
        });
        return { output: out, nextPath: effectivePath };
      }
      if (action === 'add') {
        const name = params['name'];
        const iface = params['interface'];
        const addressPool = params['address-pool'] || 'static-only';
        const leaseTime = params['lease-time'] || '10m';
        if (!name || !iface) {
          return { output: 'failure: name and interface parameters required', nextPath: effectivePath, error: true };
        }
        const res = mutateConfig('Add DHCP Server', (dev) =>
          RouterOsConfigService.addDhcpServer(dev, { name, interface: iface, addressPool, leaseTime })
        );
        if (!res.success) return { output: res.error || 'Failed to add DHCP server', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'remove' || action === 'rm') {
        const id = actionArgs[0];
        if (!id) return { output: 'syntax error: expected dhcp-server index or name', nextPath: effectivePath, error: true };
        const res = mutateConfig('Remove DHCP Server', (dev) => RouterOsConfigService.removeDhcpServer(dev, id));
        if (!res.success) return { output: res.error || 'Failed to remove', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 14. /IP DNS
    if (contextPathStr === 'ip dns') {
      if (action === 'print' || action === 'pr') {
        return {
          output: `                      servers: ${config.dns.servers.join(',')}
        allow-remote-requests: ${config.dns.allowRemoteRequests ? 'yes' : 'no'}
                   cache-size: ${config.dns.cacheSizeKb}KiB`,
          nextPath: effectivePath,
        };
      }
      if (action === 'set') {
        const serversStr = params['servers'];
        const allowRemote = params['allow-remote-requests'];
        const servers = serversStr ? serversStr.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
        const allowRemoteRequests = allowRemote !== undefined ? allowRemote === 'yes' : undefined;
        const res = mutateConfig('Update DNS Settings', (dev) =>
          RouterOsConfigService.setDns(dev, { servers, allowRemoteRequests })
        );
        if (!res.success) return { output: res.error || 'Failed to set DNS', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 15. /IP DNS STATIC
    if (contextPathStr === 'ip dns static') {
      if (action === 'print' || action === 'pr') {
        if (!config.dns.staticEntries || config.dns.staticEntries.length === 0) {
          return { output: 'No static DNS entries configured.', nextPath: effectivePath };
        }
        let out = `Flags: X - disabled\n #   NAME                      ADDRESS            TTL\n`;
        config.dns.staticEntries.forEach((st, idx) => {
          const flag = st.disabled ? 'X ' : '  ';
          out += `${flag}${String(idx).padEnd(3)} ${st.name.padEnd(25)} ${st.address.padEnd(18)} ${st.ttl || '1d'}\n`;
        });
        return { output: out, nextPath: effectivePath };
      }
      if (action === 'add') {
        const name = params['name'];
        const address = params['address'];
        const ttl = params['ttl'] || '1d';
        if (!name || !address) {
          return { output: 'failure: name and address parameters required', nextPath: effectivePath, error: true };
        }
        const res = mutateConfig('Add Static DNS Entry', (dev) =>
          RouterOsConfigService.addDnsStatic(dev, { name, address, ttl })
        );
        if (!res.success) return { output: res.error || 'Failed to add static DNS', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
      if (action === 'remove' || action === 'rm') {
        const id = actionArgs[0];
        if (!id) return { output: 'syntax error: expected static dns index or name', nextPath: effectivePath, error: true };
        const res = mutateConfig('Remove Static DNS Entry', (dev) => RouterOsConfigService.removeDnsStatic(dev, id));
        if (!res.success) return { output: res.error || 'Failed to remove', nextPath: effectivePath, error: true };
        return { output: '', nextPath: effectivePath, newConfig: res.config };
      }
    }

    // 16. /SYSTEM BACKUP
    if (contextPathStr === 'system backup') {
      if (action === 'print' || action === 'pr') {
        if (config.backups.length === 0) {
          return { output: 'No configuration backup snapshots saved.', nextPath: effectivePath };
        }
        let out = ` #   NAME                             VERSION  SIZE       CREATED-AT\n`;
        config.backups.forEach((b, idx) => {
          out += ` ${String(idx).padEnd(3)} ${b.name.padEnd(32)} ${b.routerOsVersion.padEnd(8)} ${(b.sizeBytes + 'B').padEnd(10)} ${new Date(b.createdAt).toLocaleString()}\n`;
        });
        return { output: out, nextPath: effectivePath };
      }
      if (action === 'save') {
        const name = params['name'] || actionArgs[0] || `${device.name}-${new Date().toISOString().slice(0, 10)}.backup`;
        const res = mutateConfig(`Backup: Save (${name})`, (dev) => RouterOsConfigService.createBackup(dev, name));
        if (!res.success) return { output: res.error || 'Failed to save backup', nextPath: effectivePath, error: true };
        return {
          output: `Saving system configuration\nConfiguration backup saved as '${name}'`,
          nextPath: effectivePath,
          newConfig: res.config,
        };
      }
      if (action === 'load') {
        const nameOrId = params['name'] || actionArgs[0];
        if (!nameOrId) {
          return { output: 'failure: name parameter required (e.g. /system backup load name=my.backup)', nextPath: effectivePath, error: true };
        }
        const res = mutateConfig(`Restore: Load (${nameOrId})`, (dev) =>
          RouterOsConfigService.restoreBackup(dev, nameOrId)
        );
        if (!res.success) return { output: res.error || 'Failed to load backup', nextPath: effectivePath, error: true };
        return {
          output: `Restoring system configuration...\nSystem configuration restored from '${nameOrId}'.`,
          nextPath: effectivePath,
          newConfig: res.config,
        };
      }
    }

    // Default: unrecognized command
    return {
      output: `bad command name ${action} (line 1 column 1)`,
      nextPath: effectivePath,
      error: true,
    };
  }

  // ==========================================
  // SIMULATED TOOLS: PING & TRACEROUTE
  // ==========================================

  private static executePing(device: NetworkDevice, targetIp: string, project: NetworkProject): string {
    const trace = simulatePacketTrace(device.id, targetIp, 'ICMP', project);
    const sent = 4;
    const received = trace.success ? 4 : 0;
    const loss = trace.success ? 0 : 100;

    let out = `  SEQ HOST                                     SIZE TTL TIME  STATUS\n`;
    if (trace.success) {
      const avgLat = trace.totalLatencyMs || 1.2;
      for (let i = 0; i < 4; i++) {
        const lat = (avgLat + (Math.random() * 0.4 - 0.2)).toFixed(1);
        out += `    ${i} ${targetIp.padEnd(40)} 56  64 ${lat}ms\n`;
      }
    } else {
      out += `    0 ${targetIp.padEnd(40)} timeout (Host unreachable: ${trace.summary})\n`;
    }
    out += `    sent=${sent} received=${received} packet-loss=${loss}%\n`;
    return out;
  }

  private static executeTraceroute(device: NetworkDevice, targetIp: string, project: NetworkProject): string {
    const trace = simulatePacketTrace(device.id, targetIp, 'ICMP', project);
    let out = `# ADDRESS                          STATUS      LOSS% TIMEOUT\n`;
    trace.hops.forEach((hop, i) => {
      const devName = `${hop.deviceName} (${hop.action})`;
      const lat = `${hop.latencyMs.toFixed(1)}ms`;
      out += `${String(i + 1).padStart(2)} ${devName.padEnd(32)} ${hop.status.padEnd(11)} 0%    ${lat}\n`;
    });
    return out;
  }

  // ==========================================
  // TABLE FORMATTERS (Real RouterOS style)
  // ==========================================

  private static printIpAddresses(config: RouterOsDeviceConfig): string {
    if (config.ipAddresses.length === 0) return 'No IP addresses configured.';
    let out = `Flags: X - disabled, I - invalid, D - dynamic\n`;
    out += ` #   ADDRESS            NETWORK         INTERFACE\n`;
    config.ipAddresses.forEach((a, idx) => {
      const flag = a.disabled ? 'X ' : '  ';
      const comment = a.comment ? `;;; ${a.comment}\n` : '';
      out += `${comment}${flag}${String(idx).padEnd(3)} ${a.address.padEnd(18)} ${a.network.padEnd(15)} ${a.interface}\n`;
    });
    return out;
  }

  private static printInterfaces(config: RouterOsDeviceConfig): string {
    let out = `Flags: X - disabled, R - running\n`;
    out += ` #   NAME            TYPE       ACTUAL-MTU  MAC-ADDRESS\n`;
    config.interfaces.forEach((i, idx) => {
      const flag = `${i.disabled ? 'X' : ' '}${i.running ? 'R' : ' '}`;
      const comment = i.comment ? `;;; ${i.comment}\n` : '';
      out += `${comment}${flag} ${String(idx).padEnd(3)} ${i.name.padEnd(15)} ${i.type.padEnd(10)} ${String(i.actualMtu).padEnd(11)} ${i.macAddress}\n`;
    });
    return out;
  }

  private static printBridges(config: RouterOsDeviceConfig): string {
    if (config.bridges.length === 0) return 'No bridges configured.';
    let out = `Flags: X - disabled, R - running\n`;
    out += ` #   NAME            VLAN-FILTERING  MTU   MAC-ADDRESS\n`;
    config.bridges.forEach((b, idx) => {
      const flag = b.disabled ? 'X ' : ' R';
      const comment = b.comment ? `;;; ${b.comment}\n` : '';
      out += `${comment}${flag} ${String(idx).padEnd(3)} ${b.name.padEnd(15)} ${String(b.vlanFiltering).padEnd(15)} ${String(b.mtu).padEnd(5)} ${b.macAddress}\n`;
    });
    return out;
  }

  private static printBridgePorts(config: RouterOsDeviceConfig): string {
    if (config.bridgePorts.length === 0) return 'No bridge ports configured.';
    let out = `Flags: X - disabled, I - inactive\n`;
    out += ` #   INTERFACE       BRIDGE          PVID\n`;
    config.bridgePorts.forEach((bp, idx) => {
      const flag = bp.disabled ? 'X ' : '  ';
      out += `${flag}${String(idx).padEnd(3)} ${bp.interface.padEnd(15)} ${bp.bridge.padEnd(15)} ${bp.pvid}\n`;
    });
    return out;
  }

  private static printVlans(config: RouterOsDeviceConfig): string {
    if (config.vlans.length === 0) return 'No VLAN interfaces configured.';
    let out = `Flags: X - disabled, R - running\n`;
    out += ` #   NAME            VLAN-ID  INTERFACE\n`;
    config.vlans.forEach((v, idx) => {
      const flag = v.disabled ? 'X ' : ' R';
      out += `${flag} ${String(idx).padEnd(3)} ${v.name.padEnd(15)} ${String(v.vlanId).padEnd(8)} ${v.interface}\n`;
    });
    return out;
  }

  private static printRoutes(config: RouterOsDeviceConfig): string {
    if (config.routes.length === 0) return 'No static routes configured.';
    const tableHeader = config.version === 'v7' ? 'ROUTING-TABLE' : 'ROUTING-MARK';
    let out = `Flags: X - disabled, A - active, S - static\n`;
    out += ` #      DST-ADDRESS        GATEWAY         DISTANCE  ${tableHeader}\n`;
    config.routes.forEach((r, idx) => {
      const flag = `${r.disabled ? 'X' : ' '}${r.active ? 'A' : ' '}S`;
      const tbl = r.routingTable || r.routingMark || 'main';
      out += `${flag} ${String(idx).padEnd(4)} ${r.dstAddress.padEnd(18)} ${r.gateway.padEnd(15)} ${String(r.distance).padEnd(9)} ${tbl}\n`;
    });
    return out;
  }

  private static printRoutingTables(config: RouterOsDeviceConfig): string {
    const tables = config.routingTables || [];
    if (tables.length === 0) return 'No routing tables configured.';
    let out = `Flags: D - dynamic, X - disabled, I - invalid\n`;
    out += ` #   NAME                 FIB\n`;
    tables.forEach((t, idx) => {
      const flag = `${t.dynamic ? 'D' : ' '}${t.disabled ? 'X' : ' '}`;
      const comment = t.comment ? `;;; ${t.comment}\n` : '';
      out += `${comment}${flag} ${String(idx).padEnd(3)} ${t.name.padEnd(20)} ${t.fib ? 'yes' : 'no'}\n`;
    });
    return out;
  }

  private static printFirewallFilter(config: RouterOsDeviceConfig): string {
    if (config.firewall.filterRules.length === 0) return 'No filter rules configured.';
    let out = `Flags: X - disabled, I - invalid\n`;
    out += ` #   CHAIN       ACTION    PROTOCOL  SRC-ADDRESS       DST-ADDRESS\n`;
    config.firewall.filterRules.forEach((f, idx) => {
      const flag = f.disabled ? 'X ' : '  ';
      const comment = f.comment ? `;;; ${f.comment}\n` : '';
      out += `${comment}${flag}${String(idx).padEnd(3)} ${f.chain.padEnd(11)} ${f.action.padEnd(9)} ${(f.protocol || 'all').padEnd(9)} ${(f.srcAddress || '*').padEnd(17)} ${f.dstAddress || '*'}\n`;
    });
    return out;
  }

  private static printFirewallNat(config: RouterOsDeviceConfig): string {
    if (config.firewall.natRules.length === 0) return 'No NAT rules configured.';
    let out = `Flags: X - disabled, I - invalid\n`;
    out += ` #   CHAIN       ACTION       OUT-INTERFACE   TO-ADDRESSES\n`;
    config.firewall.natRules.forEach((n, idx) => {
      const flag = n.disabled ? 'X ' : '  ';
      const comment = n.comment ? `;;; ${n.comment}\n` : '';
      out += `${comment}${flag}${String(idx).padEnd(3)} ${n.chain.padEnd(11)} ${n.action.padEnd(12)} ${(n.outInterface || '*').padEnd(15)} ${n.toAddresses || '*'}\n`;
    });
    return out;
  }

  private static printFirewallMangle(config: RouterOsDeviceConfig): string {
    const rules = config.firewall.mangleRules || [];
    if (rules.length === 0) return 'Flags: X - disabled, I - invalid; D - dynamic\n(0 rules)';
    let out = `Flags: X - disabled, I - invalid; D - dynamic\n`;
    out += ` #    CHAIN        ACTION                   SRC-ADDRESS       DST-ADDRESS       IN-INTERFACE   MARK/TARGET\n`;
    rules.forEach((m, idx) => {
      const flag = `${m.disabled ? 'X' : ' '}${m.invalid ? 'I' : ' '}${m.dynamic ? 'D' : ' '}`;
      const comment = m.comment ? ` ${String(idx).padStart(2)}  ;;; ${m.comment}\n` : '';
      const markTarget =
        m.newConnectionMark ||
        m.newPacketMark ||
        m.newRoutingMark ||
        m.addressList ||
        (m.newDscp !== undefined ? `dscp:${m.newDscp}` : '') ||
        (m.newMss !== undefined ? `mss:${m.newMss}` : '') ||
        m.newTtl ||
        m.logPrefix ||
        (m.passthrough === false ? 'passthrough=no' : 'passthrough=yes');
      if (comment) {
        out += comment;
        out += `    ${flag} ${m.chain.padEnd(12)} ${m.action.padEnd(24)} ${(m.srcAddress || m.srcAddressList || '*').padEnd(17)} ${(m.dstAddress || m.dstAddressList || '*').padEnd(17)} ${(m.inInterface || m.inInterfaceList || '*').padEnd(14)} ${markTarget}\n`;
      } else {
        out += ` ${String(idx).padStart(2)} ${flag} ${m.chain.padEnd(12)} ${m.action.padEnd(24)} ${(m.srcAddress || m.srcAddressList || '*').padEnd(17)} ${(m.dstAddress || m.dstAddressList || '*').padEnd(17)} ${(m.inInterface || m.inInterfaceList || '*').padEnd(14)} ${markTarget}\n`;
      }
    });
    return out;
  }

  private static printFirewallMangleDetail(config: RouterOsDeviceConfig): string {
    const rules = config.firewall.mangleRules || [];
    if (rules.length === 0) return 'Flags: X - disabled, I - invalid; D - dynamic\n';
    let out = `Flags: X - disabled, I - invalid; D - dynamic\n`;
    rules.forEach((m, idx) => {
      const flag = `${m.disabled ? 'X' : ' '}${m.invalid ? 'I' : ' '}${m.dynamic ? 'D' : ' '}`.trim();
      if (m.comment) {
        out += ` ${idx} ${flag ? flag + ' ' : ''};;; ${m.comment}\n     `;
      } else {
        out += ` ${idx} ${flag ? flag + ' ' : ''}  `;
      }
      const kv: string[] = [`chain=${m.chain}`, `action=${m.action}`];
      if (m.srcAddress) kv.push(`src-address=${m.srcAddress}`);
      if (m.dstAddress) kv.push(`dst-address=${m.dstAddress}`);
      if (m.protocol) kv.push(`protocol=${m.protocol}`);
      if (m.srcPort) kv.push(`src-port=${m.srcPort}`);
      if (m.dstPort) kv.push(`dst-port=${m.dstPort}`);
      if (m.inInterface) kv.push(`in-interface=${m.inInterface}`);
      if (m.outInterface) kv.push(`out-interface=${m.outInterface}`);
      if (m.inInterfaceList) kv.push(`in-interface-list=${m.inInterfaceList}`);
      if (m.outInterfaceList) kv.push(`out-interface-list=${m.outInterfaceList}`);
      if (m.srcAddressList) kv.push(`src-address-list=${m.srcAddressList}`);
      if (m.dstAddressList) kv.push(`dst-address-list=${m.dstAddressList}`);
      if (m.connectionState) kv.push(`connection-state=${m.connectionState}`);
      if (m.connectionMark) kv.push(`connection-mark=${m.connectionMark}`);
      if (m.packetMark) kv.push(`packet-mark=${m.packetMark}`);
      if (m.routingMark) kv.push(`routing-mark=${m.routingMark}`);
      if (m.packetLength) kv.push(`packet-length=${m.packetLength}`);
      if (m.dscp !== undefined) kv.push(`dscp=${m.dscp}`);
      if (m.priority !== undefined) kv.push(`priority=${m.priority}`);
      if (m.pcc) kv.push(`per-connection-classifier=${m.pcc}`);
      if (m.limit) kv.push(`limit=${m.limit}`);
      if (m.time) kv.push(`time=${m.time}`);
      if (m.layer7Protocol) kv.push(`layer7-protocol=${m.layer7Protocol}`);
      if (m.connectionBytes) kv.push(`connection-bytes=${m.connectionBytes}`);
      if (m.connectionRate) kv.push(`connection-rate=${m.connectionRate}`);
      if (m.newConnectionMark) kv.push(`new-connection-mark=${m.newConnectionMark}`);
      if (m.newPacketMark) kv.push(`new-packet-mark=${m.newPacketMark}`);
      if (m.newRoutingMark) kv.push(`new-routing-mark=${m.newRoutingMark}`);
      if (m.addressList) kv.push(`address-list=${m.addressList}`);
      if (m.addressListTimeout) kv.push(`address-list-timeout=${m.addressListTimeout}`);
      if (m.newDscp !== undefined) kv.push(`new-dscp=${m.newDscp}`);
      if (m.newMss !== undefined) kv.push(`new-mss=${m.newMss}`);
      if (m.newTtl) kv.push(`new-ttl=${m.newTtl}`);
      if (m.logPrefix) kv.push(`log-prefix="${m.logPrefix}"`);
      if (m.passthrough !== undefined) kv.push(`passthrough=${m.passthrough ? 'yes' : 'no'}`);
      out += kv.join(' ') + '\n\n';
    });
    return out.trimEnd() + '\n';
  }

  private static printFirewallMangleStats(config: RouterOsDeviceConfig): string {
    const rules = config.firewall.mangleRules || [];
    if (rules.length === 0) return 'Flags: X - disabled, I - invalid; D - dynamic\n';
    let out = `Flags: X - disabled, I - invalid; D - dynamic\n`;
    out += ` #    CHAIN          ACTION                            BYTES         PACKETS\n`;
    rules.forEach((m, idx) => {
      const flag = `${m.disabled ? 'X' : ' '}${m.invalid ? 'I' : ' '}${m.dynamic ? 'D' : ' '}`;
      const comment = m.comment ? `;;; ${m.comment}\n` : '';
      if (comment) out += ` ${String(idx).padStart(2)}  ${comment}`;
      out += ` ${String(idx).padStart(2)} ${flag} ${m.chain.padEnd(14)} ${m.action.padEnd(28)} ${String(m.bytes || 0).padStart(10)} ${String(m.packets || 0).padStart(15)}\n`;
    });
    return out;
  }

  private static printAddressLists(config: RouterOsDeviceConfig): string {
    const lists = config.firewall.addressLists || [];
    if (lists.length === 0) return 'No address list entries configured.';
    let out = `Flags: X - disabled, D - dynamic\n`;
    out += ` #   LIST                 ADDRESS                   CREATION-TIME        TIMEOUT\n`;
    lists.forEach((a, idx) => {
      const flag = `${a.disabled ? 'X' : ' '}${a.dynamic ? 'D' : ' '}`;
      const comment = a.comment ? `;;; ${a.comment}\n` : '';
      out += `${comment}${flag} ${String(idx).padEnd(3)} ${a.list.padEnd(20)} ${a.address.padEnd(25)} ${(a.creationTime || '-').slice(0, 19).padEnd(20)} ${a.timeout || 'none'}\n`;
    });
    return out;
  }

  private static printConnections(config: RouterOsDeviceConfig): string {
    const conns = config.connectionTracking || [];
    if (conns.length === 0) return 'No active tracked connections.';
    let out = `Flags: E - expected, S - seen-reply, A - assured, C - confirmed\n`;
    out += ` #    PROTOCOL SRC-ADDRESS           DST-ADDRESS           TCP-STATE   CONNECTION-MARK   ROUTING-MARK\n`;
    conns.forEach((c, idx) => {
      const src = c.srcPort ? `${c.srcAddress}:${c.srcPort}` : c.srcAddress;
      const dst = c.dstPort ? `${c.dstAddress}:${c.dstPort}` : c.dstAddress;
      out += ` ${String(idx).padEnd(4)} ${c.protocol.padEnd(8)} ${src.padEnd(21)} ${dst.padEnd(21)} ${c.connectionState.padEnd(11)} ${(c.connectionMark || 'no-mark').padEnd(17)} ${c.routingMark || 'main'}\n`;
    });
    return out;
  }

  private static printQueues(config: RouterOsDeviceConfig): string {
    if (config.queues.length === 0) return 'No simple queues configured.';
    let out = `Flags: X - disabled\n`;
    out += ` #   NAME            TARGET             MAX-LIMIT    PACKET-MARKS\n`;
    config.queues.forEach((q, idx) => {
      const flag = q.disabled ? 'X ' : '  ';
      const up = (q.maxLimitUploadBps / 1_000_000).toFixed(0) + 'M';
      const down = (q.maxLimitDownloadBps / 1_000_000).toFixed(0) + 'M';
      out += `${flag}${String(idx).padEnd(3)} ${q.name.padEnd(15)} ${q.target.padEnd(18)} ${(up + '/' + down).padEnd(12)} ${q.packetMarks || ''}\n`;
    });
    return out;
  }

  private static printQueueTree(config: RouterOsDeviceConfig): string {
    const qts = config.queueTree || [];
    if (qts.length === 0) return 'No queue tree entries configured.';
    let out = `Flags: X - disabled, I - invalid\n`;
    out += ` #   NAME                PARENT          PACKET-MARK         MAX-LIMIT   PRIORITY\n`;
    qts.forEach((q, idx) => {
      const flag = q.disabled ? 'X ' : '  ';
      const limitStr = (q.maxLimitBps / 1_000_000).toFixed(0) + 'M';
      out += `${flag}${String(idx).padEnd(3)} ${q.name.padEnd(19)} ${q.parent.padEnd(15)} ${(q.packetMark || '').padEnd(19)} ${limitStr.padEnd(11)} ${q.priority}\n`;
    });
    return out;
  }

  private static parseSpeedStringToBps(speedStr: string): number {
    const s = speedStr.trim().toUpperCase();
    if (s.endsWith('G')) return parseFloat(s) * 1_000_000_000;
    if (s.endsWith('M')) return parseFloat(s) * 1_000_000;
    if (s.endsWith('K')) return parseFloat(s) * 1_000;
    return parseFloat(s) || 10_000_000;
  }

  private static getHelpText(context: string): string {
    return `RouterOS Command Reference [/${context || 'root'}]:
  Navigation:
    ..          Go up one context level
    /           Go to root menu
    <menu>      Navigate to submenu (e.g. interface, ip address, ip firewall mangle, routing table)

  Commands:
    print              Print current table entries (short: pr)
    print detail       Print detailed rules (in /ip firewall mangle)
    print stats        Print packet & byte counters (in /ip firewall mangle)
    add                Add a new entry with key=val parameters
    set                Update an existing entry by number (e.g. set 0 disabled=yes)
    remove             Remove an existing entry by number (short: rm)
    enable             Enable entry (e.g. enable 0)
    disable            Disable entry (e.g. disable 0)
    move               Reorder rule (e.g. move 2 0)
    reset-counters     Reset counters for rule (e.g. reset-counters 0)
    reset-counters-all Reset counters for all rules
    export             Export full configuration in .rsc script format
    clear              Clear screen output

  Diagnostic Tools:
    ping <ip>            Simulate ICMP ping packets
    traceroute <ip>      Simulate traceroute hops through topology
    /system resource pr  Display CPU, RAM, Uptime and architecture`;
  }

  /**
   * Tab autocompletion suggestions
   */
  static getCompletions(currentLine: string, path: string[], device: NetworkDevice): string[] {
    const trimmed = currentLine.trimStart();
    const tokens = trimmed.split(/\s+/);
    const lastToken = tokens[tokens.length - 1] || '';

    const rootKeywords = [
      'interface',
      'ip',
      'routing',
      'queue',
      'system',
      'tool',
      'ping',
      'traceroute',
      'export',
      'print',
      'add',
      'set',
      'remove',
      'enable',
      'disable',
      'move',
      'reset-counters',
      'reset-counters-all',
      'clear',
      'help',
    ];

    if (tokens.length <= 1) {
      return rootKeywords.filter((k) => k.startsWith(lastToken.toLowerCase()));
    }

    // Parameter suggestions
    const contextStr = path.join(' ');
    if (contextStr === 'ip address' && tokens.includes('add')) {
      const candidates = ['address=', 'interface=', 'comment=', 'disabled='];
      return candidates.filter((c) => c.startsWith(lastToken.toLowerCase()));
    }

    if (contextStr === 'ip route' && tokens.includes('add')) {
      const candidates = ['dst-address=', 'gateway=', 'distance=', 'routing-table=', 'routing-mark=', 'comment='];
      return candidates.filter((c) => c.startsWith(lastToken.toLowerCase()));
    }

    if (contextStr === 'ip firewall mangle' && (tokens.includes('add') || tokens.includes('set'))) {
      const candidates = [
        'chain=',
        'action=',
        'src-address=',
        'dst-address=',
        'protocol=',
        'src-port=',
        'dst-port=',
        'in-interface=',
        'out-interface=',
        'in-interface-list=',
        'out-interface-list=',
        'src-address-list=',
        'dst-address-list=',
        'connection-state=',
        'connection-mark=',
        'packet-mark=',
        'routing-mark=',
        'per-connection-classifier=',
        'new-connection-mark=',
        'new-packet-mark=',
        'new-routing-mark=',
        'address-list=',
        'address-list-timeout=',
        'new-dscp=',
        'new-mss=',
        'new-ttl=',
        'passthrough=',
        'comment=',
        'disabled=',
      ];
      return candidates.filter((c) => c.startsWith(lastToken.toLowerCase()));
    }

    // Interface names autocompletion
    if (lastToken.startsWith('interface=') || lastToken.startsWith('in-interface=') || lastToken.startsWith('out-interface=')) {
      const eqIdx = lastToken.indexOf('=');
      const keyPrefix = lastToken.slice(0, eqIdx + 1);
      const valPrefix = lastToken.slice(eqIdx + 1);
      return device.interfaces
        .filter((i) => i.name.toLowerCase().startsWith(valPrefix.toLowerCase()))
        .map((i) => `${keyPrefix}${i.name}`);
    }

    return [];
  }
}
