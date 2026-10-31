import {
  NetworkProject,
  NetworkDevice,
  SimulationResult,
  PacketTraceHop,
} from '../types/network';
import { parseIPv4Cidr } from './validationEngine';
import { RouterOsConfigService } from './routerOsConfigService';
import {
  MangleChain,
  MangleRule,
  RouterOsDeviceConfig,
  RouterOsRoute,
} from '../types/routerOs';

// Check if IP matches a subnet CIDR (or exact IP)
export function isIpInSubnet(ip: string, subnetOrIp: string): boolean {
  const cleanTarget = subnetOrIp.trim();
  if (!cleanTarget || cleanTarget === '0.0.0.0/0') return true;
  if (!cleanTarget.includes('/')) {
    return ip.trim() === cleanTarget;
  }
  const parsedSubnet = parseIPv4Cidr(cleanTarget);
  if (!parsedSubnet) return false;
  if (parsedSubnet.prefix === 0) return true; // 0.0.0.0/0 matches all IPv4
  const parsedIp = parseIPv4Cidr(`${ip.trim()}/${parsedSubnet.prefix}`);
  if (!parsedIp) return false;
  return parsedSubnet.network === parsedIp.network;
}

// Check if an IP is RFC1918 private
function isPrivateIp(ip: string): boolean {
  return (
    isIpInSubnet(ip, '10.0.0.0/8') ||
    isIpInSubnet(ip, '172.16.0.0/12') ||
    isIpInSubnet(ip, '192.168.0.0/16')
  );
}

export interface PacketSimulationContext {
  srcIp: string;
  dstIp: string;
  protocol: string;
  srcPort: number;
  dstPort: number;
  packetLength: number;
  ttl: number;
  mss: number;
  dscp: number;
  priority: number;
  connectionState: 'new' | 'established' | 'related' | 'invalid';
  connectionMark?: string;
  packetMark?: string;
  routingMark?: string;
  matchedMangleSummary: string[];
}

function matchPortSpec(port: number, spec: string): boolean {
  const parts = spec.split(',').map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [minStr, maxStr] = part.split('-');
      const min = parseInt(minStr, 10);
      const max = parseInt(maxStr, 10);
      if (!isNaN(min) && !isNaN(max) && port >= min && port <= max) return true;
    } else {
      const exact = parseInt(part, 10);
      if (!isNaN(exact) && port === exact) return true;
    }
  }
  return false;
}

function matchRangeSpec(val: number, spec: string): boolean {
  const clean = spec.trim();
  if (clean.includes('-')) {
    const [minStr, maxStr] = clean.split('-');
    const min = parseInt(minStr, 10);
    const max = parseInt(maxStr, 10);
    if (!isNaN(min) && !isNaN(max)) return val >= min && val <= max;
  }
  const exact = parseInt(clean, 10);
  return !isNaN(exact) ? val === exact : true;
}

function isInterfaceInList(cfg: RouterOsDeviceConfig, ifaceName: string, listName: string): boolean {
  const members = cfg.interfaceListMembers || [];
  return members.some(
    (m) =>
      !m.disabled &&
      m.list.toLowerCase() === listName.toLowerCase() &&
      m.interface.toLowerCase() === ifaceName.toLowerCase()
  );
}

export function isIpInAddressList(cfg: RouterOsDeviceConfig, ip: string, listName: string): boolean {
  const entries = cfg.firewall.addressLists || [];
  return entries.some(
    (e) =>
      !e.disabled &&
      e.list.toLowerCase() === listName.toLowerCase() &&
      isIpInSubnet(ip, e.address)
  );
}

function evaluatePccMatcher(ctx: PacketSimulationContext, pccSpec: string): boolean {
  // e.g. "both-addresses:2/0", "src-address:2/1", "both-addresses-and-ports:2/0"
  const parts = pccSpec.trim().toLowerCase().split(':');
  if (parts.length !== 2) return true;
  const classifier = parts[0];
  const [denomStr, remStr] = parts[1].split('/');
  const denom = parseInt(denomStr, 10);
  const rem = parseInt(remStr, 10);
  if (isNaN(denom) || denom <= 0 || isNaN(rem)) return true;

  let key = '';
  if (classifier === 'src-address') key = ctx.srcIp;
  else if (classifier === 'dst-address') key = ctx.dstIp;
  else if (classifier === 'both-addresses') key = `${ctx.srcIp}-${ctx.dstIp}`;
  else key = `${ctx.srcIp}:${ctx.srcPort}-${ctx.dstIp}:${ctx.dstPort}`;

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % denom === rem;
}

export function evaluateMangleChain(
  cfg: RouterOsDeviceConfig,
  chain: MangleChain,
  ctx: PacketSimulationContext,
  inIfaceName?: string,
  outIfaceName?: string
): { matchedRules: MangleRule[]; actionsApplied: string[] } {
  const rules = cfg.firewall.mangleRules || [];
  const matchedRules: MangleRule[] = [];
  const actionsApplied: string[] = [];

  if (!cfg.connectionTracking) {
    cfg.connectionTracking = [];
  }

  // Synchronize connection tracking state on initial chains
  let trackedConn = cfg.connectionTracking.find(
    (c) =>
      c.srcAddress === ctx.srcIp &&
      c.dstAddress === ctx.dstIp &&
      c.protocol.toLowerCase() === ctx.protocol.toLowerCase()
  );

  if (chain === 'prerouting' || chain === 'output') {
    if (trackedConn) {
      ctx.connectionState = 'established';
      if (trackedConn.connectionMark && !ctx.connectionMark) {
        ctx.connectionMark = trackedConn.connectionMark;
      }
    } else {
      ctx.connectionState = 'new';
      const newConn = {
        id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        protocol: ctx.protocol.toLowerCase(),
        srcAddress: ctx.srcIp,
        dstAddress: ctx.dstIp,
        srcPort: String(ctx.srcPort),
        dstPort: String(ctx.dstPort),
        connectionState: 'new' as const,
        connectionMark: ctx.connectionMark,
        routingMark: ctx.routingMark,
        bytes: ctx.packetLength,
        packets: 1,
        timeout: '10m',
        updatedAt: new Date().toISOString(),
      };
      trackedConn = newConn;
      cfg.connectionTracking.push(newConn);
      if (cfg.connectionTracking.length > 100) {
        cfg.connectionTracking.shift();
      }
    }
  }

  for (const rule of rules) {
    if (rule.disabled || rule.invalid) continue;
    if (rule.chain !== chain) continue;

    // 1. General Matchers
    if (rule.srcAddress && !isIpInSubnet(ctx.srcIp, rule.srcAddress)) continue;
    if (rule.dstAddress && !isIpInSubnet(ctx.dstIp, rule.dstAddress)) continue;
    if (
      rule.protocol &&
      rule.protocol.toLowerCase() !== 'all' &&
      rule.protocol.toLowerCase() !== ctx.protocol.toLowerCase()
    ) {
      continue;
    }
    if (rule.srcPort && !matchPortSpec(ctx.srcPort, rule.srcPort)) continue;
    if (rule.dstPort && !matchPortSpec(ctx.dstPort, rule.dstPort)) continue;
    if (rule.inInterface) {
      if (!inIfaceName || rule.inInterface.toLowerCase() !== inIfaceName.toLowerCase()) continue;
    }
    if (rule.outInterface) {
      if (!outIfaceName || rule.outInterface.toLowerCase() !== outIfaceName.toLowerCase()) continue;
    }
    if (rule.inInterfaceList) {
      if (!inIfaceName || !isInterfaceInList(cfg, inIfaceName, rule.inInterfaceList)) continue;
    }
    if (rule.outInterfaceList) {
      if (!outIfaceName || !isInterfaceInList(cfg, outIfaceName, rule.outInterfaceList)) continue;
    }

    // 2. Advanced Matchers
    if (rule.srcAddressList && !isIpInAddressList(cfg, ctx.srcIp, rule.srcAddressList)) continue;
    if (rule.dstAddressList && !isIpInAddressList(cfg, ctx.dstIp, rule.dstAddressList)) continue;
    if (rule.connectionState) {
      const allowedStates = rule.connectionState
        .toLowerCase()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (allowedStates.length > 0 && !allowedStates.includes(ctx.connectionState)) continue;
    }
    if (rule.connectionMark) {
      if (rule.connectionMark === 'no-mark') {
        if (ctx.connectionMark) continue;
      } else if (ctx.connectionMark !== rule.connectionMark) {
        continue;
      }
    }
    if (rule.packetMark) {
      if (rule.packetMark === 'no-mark') {
        if (ctx.packetMark) continue;
      } else if (ctx.packetMark !== rule.packetMark) {
        continue;
      }
    }
    if (rule.routingMark) {
      if (rule.routingMark === 'no-mark' || rule.routingMark === 'main') {
        if (ctx.routingMark && ctx.routingMark !== 'main') continue;
      } else if (ctx.routingMark !== rule.routingMark) {
        continue;
      }
    }
    if (rule.packetLength && !matchRangeSpec(ctx.packetLength, rule.packetLength)) continue;
    if (rule.dscp !== undefined && rule.dscp !== '' && ctx.dscp !== Number(rule.dscp)) continue;
    if (rule.priority !== undefined && rule.priority !== '' && ctx.priority !== Number(rule.priority)) continue;
    if (rule.pcc && !evaluatePccMatcher(ctx, rule.pcc)) continue;

    // Rule matched! Increment counters
    rule.packets = (rule.packets || 0) + 1;
    rule.bytes = (rule.bytes || 0) + ctx.packetLength;
    matchedRules.push(rule);

    // 3. Execute Action
    switch (rule.action) {
      case 'mark-connection': {
        ctx.connectionMark = rule.newConnectionMark;
        if (trackedConn) {
          trackedConn.connectionMark = rule.newConnectionMark;
        }
        const desc = `mark-connection=${rule.newConnectionMark} (passthrough=${rule.passthrough !== false ? 'yes' : 'no'})`;
        actionsApplied.push(desc);
        ctx.matchedMangleSummary.push(`[${chain}] ${desc}`);
        break;
      }
      case 'mark-packet': {
        ctx.packetMark = rule.newPacketMark;
        const desc = `mark-packet=${rule.newPacketMark} (passthrough=${rule.passthrough !== false ? 'yes' : 'no'})`;
        actionsApplied.push(desc);
        ctx.matchedMangleSummary.push(`[${chain}] ${desc}`);
        break;
      }
      case 'mark-routing': {
        ctx.routingMark = rule.newRoutingMark;
        if (trackedConn) {
          trackedConn.routingMark = rule.newRoutingMark;
        }
        const desc = `mark-routing=${rule.newRoutingMark} (passthrough=${rule.passthrough !== false ? 'yes' : 'no'})`;
        actionsApplied.push(desc);
        ctx.matchedMangleSummary.push(`[${chain}] ${desc}`);
        break;
      }
      case 'add-src-to-address-list': {
        if (rule.addressList) {
          if (!cfg.firewall.addressLists) cfg.firewall.addressLists = [];
          const exists = cfg.firewall.addressLists.some(
            (e) => e.list === rule.addressList && e.address === ctx.srcIp
          );
          if (!exists) {
            cfg.firewall.addressLists.push({
              id: `addrlist-dyn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              list: rule.addressList,
              address: ctx.srcIp,
              timeout: rule.addressListTimeout,
              dynamic: true,
              disabled: false,
              creationTime: new Date().toISOString(),
            });
          }
          const desc = `add-src-to-address-list=${rule.addressList} (${ctx.srcIp})`;
          actionsApplied.push(desc);
          ctx.matchedMangleSummary.push(`[${chain}] ${desc}`);
        }
        break;
      }
      case 'add-dst-to-address-list': {
        if (rule.addressList) {
          if (!cfg.firewall.addressLists) cfg.firewall.addressLists = [];
          const exists = cfg.firewall.addressLists.some(
            (e) => e.list === rule.addressList && e.address === ctx.dstIp
          );
          if (!exists) {
            cfg.firewall.addressLists.push({
              id: `addrlist-dyn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              list: rule.addressList,
              address: ctx.dstIp,
              timeout: rule.addressListTimeout,
              dynamic: true,
              disabled: false,
              creationTime: new Date().toISOString(),
            });
          }
          const desc = `add-dst-to-address-list=${rule.addressList} (${ctx.dstIp})`;
          actionsApplied.push(desc);
          ctx.matchedMangleSummary.push(`[${chain}] ${desc}`);
        }
        break;
      }
      case 'change-dscp': {
        if (rule.newDscp !== undefined && rule.newDscp !== '') {
          ctx.dscp = Number(rule.newDscp);
          const desc = `change-dscp=${rule.newDscp}`;
          actionsApplied.push(desc);
          ctx.matchedMangleSummary.push(`[${chain}] ${desc}`);
        }
        break;
      }
      case 'change-mss': {
        if (rule.newMss !== undefined && rule.newMss !== '') {
          const parsedMss = Number(rule.newMss);
          ctx.mss = isNaN(parsedMss) ? 1440 : parsedMss;
          const desc = `change-mss=${rule.newMss}`;
          actionsApplied.push(desc);
          ctx.matchedMangleSummary.push(`[${chain}] ${desc}`);
        }
        break;
      }
      case 'change-ttl': {
        if (rule.newTtl !== undefined && rule.newTtl !== '') {
          const parsedTtl = parseInt(String(rule.newTtl).replace(/^(set|increment|decrement):/i, ''), 10);
          if (!isNaN(parsedTtl)) ctx.ttl = parsedTtl;
          const desc = `change-ttl=${rule.newTtl}`;
          actionsApplied.push(desc);
          ctx.matchedMangleSummary.push(`[${chain}] ${desc}`);
        }
        break;
      }
      case 'log': {
        const desc = `log (${rule.logPrefix || 'mangle'})`;
        actionsApplied.push(desc);
        ctx.matchedMangleSummary.push(`[${chain}] ${desc}`);
        break;
      }
      case 'passthrough': {
        actionsApplied.push('passthrough');
        break;
      }
      case 'accept':
      case 'return': {
        const desc = `${rule.action}`;
        actionsApplied.push(desc);
        ctx.matchedMangleSummary.push(`[${chain}] ${desc}`);
        return { matchedRules, actionsApplied };
      }
    }

    // Respect passthrough=no for mark/change actions
    if (
      (rule.action === 'mark-connection' ||
        rule.action === 'mark-packet' ||
        rule.action === 'mark-routing' ||
        rule.action === 'change-dscp' ||
        rule.action === 'change-mss' ||
        rule.action === 'change-ttl') &&
      rule.passthrough === false
    ) {
      break;
    }
  }

  return { matchedRules, actionsApplied };
}

// Find Longest Prefix Match route in RouterOS routing table, supporting Policy Based Routing (routingMark / routingTable)
export function findBestRoute(
  routes: RouterOsRoute[],
  targetIp: string,
  routingMark?: string
): RouterOsRoute | null {
  const activeRoutes = routes.filter((r) => !r.disabled && r.active !== false);

  // 1. If packet has a specific routingMark (other than 'main'), search routes in that routing table first
  if (routingMark && routingMark !== 'main') {
    const markedRoutes = activeRoutes.filter(
      (r) =>
        (r.routingTable && r.routingTable.toLowerCase() === routingMark.toLowerCase()) ||
        (r.routingMark && r.routingMark.toLowerCase() === routingMark.toLowerCase())
    );
    let bestMarked: RouterOsRoute | null = null;
    let bestMarkedPrefix = -1;
    let bestMarkedDist = 999;

    for (const r of markedRoutes) {
      if (isIpInSubnet(targetIp, r.dstAddress)) {
        const parsed = parseIPv4Cidr(r.dstAddress);
        const prefix = parsed ? parsed.prefix : r.dstAddress === '0.0.0.0/0' ? 0 : 32;
        const dist = r.distance ?? 1;
        if (prefix > bestMarkedPrefix || (prefix === bestMarkedPrefix && dist < bestMarkedDist)) {
          bestMarked = r;
          bestMarkedPrefix = prefix;
          bestMarkedDist = dist;
        }
      }
    }
    if (bestMarked) return bestMarked;
  }

  // 2. Standard lookup in 'main' routing table
  const mainRoutes = activeRoutes.filter(
    (r) => (!r.routingTable || r.routingTable === 'main') && (!r.routingMark || r.routingMark === 'main')
  );
  let bestRoute: RouterOsRoute | null = null;
  let bestPrefix = -1;
  let bestDistance = 999;

  for (const r of mainRoutes) {
    if (isIpInSubnet(targetIp, r.dstAddress)) {
      const parsed = parseIPv4Cidr(r.dstAddress);
      const prefix = parsed ? parsed.prefix : r.dstAddress === '0.0.0.0/0' ? 0 : 32;
      const dist = r.distance ?? 1;
      if (prefix > bestPrefix || (prefix === bestPrefix && dist < bestDistance)) {
        bestRoute = r;
        bestPrefix = prefix;
        bestDistance = dist;
      }
    }
  }

  return bestRoute;
}

export function simulatePacketTrace(
  sourceDeviceId: string,
  targetIpInput: string,
  protocol: 'ICMP' | 'TCP' | 'UDP' | 'DNS' | 'DHCP' = 'ICMP',
  project: NetworkProject,
  options?: { srcPort?: number; dstPort?: number; packetLength?: number }
): SimulationResult {
  const timestamp = new Date().toISOString();
  const hops: PacketTraceHop[] = [];
  let hopCounter = 1;
  let totalLatency = 0.2; // base NIC delay
  let targetIp = targetIpInput.trim();

  const sourceDev = project.devices.find((d) => d.id === sourceDeviceId);
  if (!sourceDev) {
    return {
      id: `sim-${Date.now()}`,
      timestamp,
      sourceDeviceId,
      sourceDeviceName: 'Unknown',
      sourceIp: '0.0.0.0',
      targetIp,
      protocol,
      success: false,
      totalLatencyMs: 0,
      packetLossPercent: 100,
      hops: [],
      summary: `Source device '${sourceDeviceId}' not found in topology.`,
    };
  }

  const sourceRosConfig = RouterOsConfigService.ensureConfig(sourceDev);

  // 1. Find source active interface with IP (check both RouterOS ipAddresses and physical interfaces)
  const activeRosIp = sourceRosConfig.ipAddresses.find((a) => !a.disabled);
  const sourceIface =
    sourceDev.interfaces.find((i) => i.ipAddress && i.adminState === 'up') ||
    (activeRosIp ? sourceDev.interfaces.find((i) => i.name === activeRosIp.interface) : undefined) ||
    sourceDev.interfaces.find((i) => i.adminState === 'up');

  const sourceIpOnly =
    sourceIface?.ipAddress?.split('/')[0] ||
    activeRosIp?.address.split('/')[0] ||
    '10.20.0.45';

  // Optional DNS resolution if targetIp is a hostname (contains letters)
  const isHostname = /[a-zA-Z]/.test(targetIp);
  if (isHostname) {
    // Search static DNS entries across source device and routers in topology
    let resolvedIp: string | null = null;
    let dnsResolverName = sourceDev.name;

    for (const dev of [sourceDev, ...project.devices.filter((d) => d.category === 'router')]) {
      const cfg = RouterOsConfigService.ensureConfig(dev);
      const staticMatch = cfg.dns.staticEntries.find(
        (st) => !st.disabled && st.name.toLowerCase() === targetIp.toLowerCase()
      );
      if (staticMatch) {
        resolvedIp = staticMatch.address;
        dnsResolverName = dev.name;
        break;
      }
    }

    if (resolvedIp) {
      hops.push({
        hopNumber: hopCounter++,
        deviceId: sourceDev.id,
        deviceName: sourceDev.name,
        action: 'INGRESS',
        details: `[RouterOS DNS] Resolved static hostname '${targetIp}' -> ${resolvedIp} via ${dnsResolverName} (/ip dns static)`,
        latencyMs: 0.3,
        status: 'OK',
      });
      targetIp = resolvedIp;
      totalLatency += 0.3;
    } else {
      // Check if any router or source has upstream DNS servers configured
      const routerCfg = sourceRosConfig.dns.servers.length > 0
        ? sourceRosConfig
        : project.devices
            .filter((d) => d.category === 'router')
            .map((d) => RouterOsConfigService.ensureConfig(d))
            .find((c) => c.dns.servers.length > 0);

      if (!routerCfg || routerCfg.dns.servers.length === 0) {
        hops.push({
          hopNumber: hopCounter++,
          deviceId: sourceDev.id,
          deviceName: sourceDev.name,
          action: 'DROP',
          details: `[RouterOS DNS] Failed to resolve hostname '${targetIp}': No DNS servers configured in /ip dns`,
          latencyMs: 0,
          status: 'DROPPED',
          dropReason: `DNS_FAILURE: No DNS servers or static entry found for '${targetIp}'`,
        });
        return {
          id: `sim-${Date.now()}`,
          timestamp,
          sourceDeviceId: sourceDev.id,
          sourceDeviceName: sourceDev.name,
          sourceIp: sourceIpOnly,
          targetIp,
          protocol,
          success: false,
          totalLatencyMs: totalLatency,
          packetLossPercent: 100,
          hops,
          summary: `DNS resolution failed for '${targetIp}': No DNS resolver configured in RouterOS (/ip dns).`,
        };
      }
      // Resolve common public hostnames to simulated public IP
      resolvedIp = targetIp.toLowerCase().includes('google')
        ? '8.8.8.8'
        : targetIp.toLowerCase().includes('cloudflare')
        ? '1.1.1.1'
        : '93.184.216.34';
      hops.push({
        hopNumber: hopCounter++,
        deviceId: sourceDev.id,
        deviceName: sourceDev.name,
        action: 'INGRESS',
        details: `[RouterOS DNS] Resolved '${targetIp}' -> ${resolvedIp} via resolver [${routerCfg.dns.servers.join(', ')}]`,
        latencyMs: 1.5,
        status: 'OK',
      });
      targetIp = resolvedIp;
      totalLatency += 1.5;
    }
  }

  // Initialize Packet Simulation Context for Mangle, Firewall, Routing & QoS
  const pktCtx: PacketSimulationContext = {
    srcIp: sourceIpOnly,
    dstIp: targetIp,
    protocol: protocol.toLowerCase(),
    srcPort: options?.srcPort ?? (protocol === 'ICMP' ? 0 : 52410),
    dstPort: options?.dstPort ?? (protocol === 'DNS' ? 53 : protocol === 'DHCP' ? 67 : protocol === 'TCP' ? 443 : 80),
    packetLength: options?.packetLength ?? (protocol === 'ICMP' ? 64 : 512),
    ttl: 64,
    mss: 1460,
    dscp: 0,
    priority: 0,
    connectionState: 'new',
    matchedMangleSummary: [],
  };

  // Check if sourceIface is disabled in RouterOS config
  const srcRosIface = sourceRosConfig.interfaces.find((i) => i.name === sourceIface?.name);
  if (!sourceIface || sourceIface.adminState === 'down' || srcRosIface?.disabled) {
    hops.push({
      hopNumber: hopCounter++,
      deviceId: sourceDev.id,
      deviceName: sourceDev.name,
      ingressInterfaceId: sourceIface?.id,
      ingressInterfaceName: sourceIface?.name,
      action: 'DROP',
      details: `Source interface ${sourceIface?.name || 'none'} is administratively disabled in RouterOS (/interface disable)`,
      latencyMs: 0,
      status: 'DROPPED',
      dropReason: 'INTERFACE_DISABLED: Egress interface is administratively disabled',
    });
    return {
      id: `sim-${Date.now()}`,
      timestamp,
      sourceDeviceId: sourceDev.id,
      sourceDeviceName: sourceDev.name,
      sourceIp: sourceIpOnly,
      targetIp,
      protocol,
      success: false,
      totalLatencyMs: totalLatency,
      packetLossPercent: 100,
      hops,
      summary: `Transmission failed: Source interface on ${sourceDev.name} is disabled.`,
    };
  }

  // If sourceDev is a router, evaluate Mangle chain=output & chain=postrouting on local packet generation
  if (sourceDev.category === 'router') {
    const outMangle = evaluateMangleChain(sourceRosConfig, 'output', pktCtx, undefined, sourceIface.name);
    const postMangle = evaluateMangleChain(sourceRosConfig, 'postrouting', pktCtx, undefined, sourceIface.name);
    const allSrcActions = [...outMangle.actionsApplied, ...postMangle.actionsApplied];
    const mangleSuffix = allSrcActions.length > 0 ? ` [Mangle: ${allSrcActions.join(', ')}]` : '';
    hops.push({
      hopNumber: hopCounter++,
      deviceId: sourceDev.id,
      deviceName: sourceDev.name,
      egressInterfaceId: sourceIface?.id,
      egressInterfaceName: sourceIface?.name,
      action: 'INGRESS',
      vlanId: sourceIface?.pvid || 1,
      details: `Packet generated on ${sourceDev.name} (${sourceIpOnly}) targeting ${targetIp} [${protocol}]${mangleSuffix}`,
      latencyMs: 0.2,
      status: 'OK',
    });
  } else {
    hops.push({
      hopNumber: hopCounter++,
      deviceId: sourceDev.id,
      deviceName: sourceDev.name,
      egressInterfaceId: sourceIface?.id,
      egressInterfaceName: sourceIface?.name,
      action: 'INGRESS',
      vlanId: sourceIface?.pvid || 1,
      details: `Packet generated on ${sourceDev.name} (${sourceIpOnly}) targeting ${targetIp} [${protocol}]`,
      latencyMs: 0.2,
      status: 'OK',
    });
  }

  // Check if targetIp is on sourceDev itself (loopback / local interface ping)
  const isSelfTarget =
    sourceDev.interfaces.some((i) => i.adminState === 'up' && i.ipAddress?.split('/')[0] === targetIp) ||
    sourceRosConfig.ipAddresses.some((a) => !a.disabled && a.address.split('/')[0] === targetIp);

  if (isSelfTarget) {
    hops.push({
      hopNumber: hopCounter++,
      deviceId: sourceDev.id,
      deviceName: sourceDev.name,
      ingressInterfaceId: sourceIface.id,
      ingressInterfaceName: sourceIface.name,
      action: 'DELIVER',
      vlanId: sourceIface.pvid || 1,
      details: `Local loopback delivery on ${sourceDev.name} (${targetIp})`,
      latencyMs: 0.1,
      status: 'OK',
    });
    return {
      id: `sim-${Date.now()}`,
      timestamp,
      sourceDeviceId: sourceDev.id,
      sourceDeviceName: sourceDev.name,
      sourceIp: sourceIpOnly,
      targetIp,
      targetDeviceId: sourceDev.id,
      targetDeviceName: sourceDev.name,
      protocol,
      success: true,
      totalLatencyMs: 0.3,
      packetLossPercent: 0,
      hops,
      summary: `Success: Local interface ${targetIp} on ${sourceDev.name} responded in 0.30ms.`,
    };
  }

  // Check if source interface is physically connected
  const initialLink = project.links.find(
    (l) => l.sourceInterfaceId === sourceIface?.id || l.targetInterfaceId === sourceIface?.id
  );

  if (!initialLink) {
    hops.push({
      hopNumber: hopCounter++,
      deviceId: sourceDev.id,
      deviceName: sourceDev.name,
      ingressInterfaceId: sourceIface?.id,
      ingressInterfaceName: sourceIface?.name,
      action: 'DROP',
      details: `Physical link missing or unplugged on ${sourceDev.name}:${sourceIface?.name}`,
      latencyMs: 0,
      status: 'DROPPED',
      dropReason: 'LINK_ENDPOINT_MISSING: Interface cable is disconnected (NO CARRIER)',
    });

    return {
      id: `sim-${Date.now()}`,
      timestamp,
      sourceDeviceId: sourceDev.id,
      sourceDeviceName: sourceDev.name,
      sourceIp: sourceIpOnly,
      targetIp,
      protocol,
      success: false,
      totalLatencyMs: totalLatency,
      packetLossPercent: 100,
      hops,
      summary: `Transmission failed: ${sourceDev.name} interface has no physical link attached.`,
    };
  }

  if (initialLink.status === 'DIE' || initialLink.status === 'DISABLED') {
    hops.push({
      hopNumber: hopCounter++,
      deviceId: sourceDev.id,
      deviceName: sourceDev.name,
      action: 'DROP',
      details: `Physical link carrier down (Status: ${initialLink.status})`,
      latencyMs: 0,
      status: 'DROPPED',
      dropReason: initialLink.statusReason || 'Physical link broken or disabled',
    });

    return {
      id: `sim-${Date.now()}`,
      timestamp,
      sourceDeviceId: sourceDev.id,
      sourceDeviceName: sourceDev.name,
      sourceIp: sourceIpOnly,
      targetIp,
      protocol,
      success: false,
      totalLatencyMs: totalLatency,
      packetLossPercent: 100,
      hops,
      summary: `Transmission failed: Physical link carrier failure.`,
    };
  }

  // Determine peer node of initial link
  let currentDeviceId = initialLink.sourceDeviceId === sourceDev.id ? initialLink.targetDeviceId : initialLink.sourceDeviceId;
  let currentIngressPortId = initialLink.sourceDeviceId === sourceDev.id ? initialLink.targetInterfaceId : initialLink.sourceInterfaceId;
  let lastLinkId = initialLink.id;

  const visitedDevices = new Set<string>([sourceDev.id]);
  let currentVlan = sourceIface?.pvid || 1;

  // Helper to check RouterOS firewall rules on a device (now also aware of Mangle marks and address lists)
  const evaluateFirewallChain = (
    dev: NetworkDevice,
    chain: 'input' | 'forward',
    inIfaceName?: string,
    outIfaceName?: string
  ): { allowed: boolean; matchedRuleComment?: string; action?: string } => {
    const cfg = RouterOsConfigService.ensureConfig(dev);
    for (const rule of cfg.firewall.filterRules) {
      if (rule.disabled) continue;
      if (rule.chain !== chain) continue;

      if (rule.protocol && rule.protocol.toLowerCase() !== protocol.toLowerCase()) {
        continue;
      }
      if (rule.srcAddress && !isIpInSubnet(pktCtx.srcIp, rule.srcAddress)) {
        continue;
      }
      if (rule.dstAddress && !isIpInSubnet(pktCtx.dstIp, rule.dstAddress)) {
        continue;
      }
      if (rule.srcAddressList && !isIpInAddressList(cfg, pktCtx.srcIp, rule.srcAddressList)) {
        continue;
      }
      if (rule.dstAddressList && !isIpInAddressList(cfg, pktCtx.dstIp, rule.dstAddressList)) {
        continue;
      }
      if (rule.inInterface && inIfaceName && rule.inInterface.toLowerCase() !== inIfaceName.toLowerCase()) {
        continue;
      }
      if (rule.outInterface && outIfaceName && rule.outInterface.toLowerCase() !== outIfaceName.toLowerCase()) {
        continue;
      }
      if (rule.connectionMark && pktCtx.connectionMark !== rule.connectionMark) {
        continue;
      }
      if (rule.packetMark && pktCtx.packetMark !== rule.packetMark) {
        continue;
      }
      if (rule.routingMark && pktCtx.routingMark !== rule.routingMark) {
        continue;
      }

      if (rule.action === 'drop' || rule.action === 'reject') {
        return {
          allowed: false,
          matchedRuleComment: rule.comment || `${rule.chain} ${rule.action}`,
          action: rule.action,
        };
      }
      if (rule.action === 'accept') {
        return {
          allowed: true,
          matchedRuleComment: rule.comment,
          action: 'accept',
        };
      }
    }
    return { allowed: true };
  };

  // Hop loop across devices (up to 15 max hops)
  while (currentDeviceId && !visitedDevices.has(currentDeviceId) && visitedDevices.size < 15) {
    visitedDevices.add(currentDeviceId);
    const currentDev = project.devices.find((d) => d.id === currentDeviceId);
    if (!currentDev) break;

    const currentRosConfig = RouterOsConfigService.ensureConfig(currentDev);
    const ingressPort = currentDev.interfaces.find((i) => i.id === currentIngressPortId);
    const ingressRosIface = currentRosConfig.interfaces.find((i) => i.name === ingressPort?.name);

    const linkPropagation = initialLink.isFiber ? 0.4 : 0.8;
    totalLatency += linkPropagation;

    // Check if ingress interface is disabled in RouterOS
    if (ingressPort?.adminState === 'down' || ingressRosIface?.disabled) {
      hops.push({
        hopNumber: hopCounter++,
        deviceId: currentDev.id,
        deviceName: currentDev.name,
        ingressInterfaceId: ingressPort?.id,
        ingressInterfaceName: ingressPort?.name,
        action: 'DROP',
        details: `Ingress interface ${ingressPort?.name} on ${currentDev.name} is administratively disabled in RouterOS`,
        latencyMs: 0,
        status: 'DROPPED',
        dropReason: `INTERFACE_DISABLED: ${currentDev.name}:${ingressPort?.name} is disabled`,
      });
      break;
    }

    // Check if packet reached final destination device (check both physical interfaces and RouterOS IP table)
    const destIface = currentDev.interfaces.find((i) => {
      const devIp = i.ipAddress?.split('/')[0];
      return devIp === targetIp;
    });
    const destRosIp = currentRosConfig.ipAddresses.find(
      (a) => !a.disabled && a.address.split('/')[0] === targetIp
    );

    if (destIface || destRosIp) {
      // Evaluate Mangle prerouting & input on destination router/device if it runs RouterOS
      if (currentDev.category === 'router') {
        evaluateMangleChain(currentRosConfig, 'prerouting', pktCtx, ingressPort?.name);
        evaluateMangleChain(currentRosConfig, 'input', pktCtx, ingressPort?.name);
      }

      // Evaluate RouterOS /ip firewall filter chain=input before delivering!
      const fwInput = evaluateFirewallChain(currentDev, 'input', ingressPort?.name);
      if (!fwInput.allowed) {
        hops.push({
          hopNumber: hopCounter++,
          deviceId: currentDev.id,
          deviceName: currentDev.name,
          ingressInterfaceId: ingressPort?.id,
          ingressInterfaceName: ingressPort?.name,
          action: 'DROP',
          vlanId: currentVlan,
          details: `[RouterOS Firewall] Packet dropped by /ip firewall filter chain=input action=${fwInput.action} (${fwInput.matchedRuleComment})`,
          latencyMs: 0.2,
          status: 'DROPPED',
          dropReason: `FIREWALL_DROP: Dropped by RouterOS input filter rule (${fwInput.matchedRuleComment})`,
        });
        break;
      }

      const mangleNote =
        pktCtx.matchedMangleSummary.length > 0
          ? ` [Mangle: ${pktCtx.matchedMangleSummary.join(' -> ')}]`
          : '';

      hops.push({
        hopNumber: hopCounter++,
        deviceId: currentDev.id,
        deviceName: currentDev.name,
        ingressInterfaceId: ingressPort?.id,
        ingressInterfaceName: ingressPort?.name,
        action: 'DELIVER',
        vlanId: currentVlan,
        details: `Packet successfully arrived at destination host ${currentDev.name} (${targetIp} on ${destRosIp?.interface || destIface?.name})${mangleNote}`,
        latencyMs: totalLatency,
        status: 'OK',
      });

      return {
        id: `sim-${Date.now()}`,
        timestamp,
        sourceDeviceId: sourceDev.id,
        sourceDeviceName: sourceDev.name,
        sourceIp: sourceIpOnly,
        targetIp,
        targetDeviceId: currentDev.id,
        targetDeviceName: currentDev.name,
        protocol,
        success: true,
        totalLatencyMs: parseFloat(totalLatency.toFixed(2)),
        packetLossPercent: 0,
        hops,
        summary: `Success: ${protocol} reply received from ${currentDev.name} (${targetIp}) in ${totalLatency.toFixed(2)}ms across ${hops.length} hops.${mangleNote}`,
      };
    }

    // A. Switch Processing (Layer 2 Forwarding & RouterOS Bridge / VLAN Filtering)
    if (currentDev.category === 'switch') {
      // Check RouterOS Bridge Port membership & PVID
      const bridgePort = currentRosConfig.bridgePorts.find(
        (bp) => bp.interface.toLowerCase() === (ingressPort?.name || '').toLowerCase()
      );
      if (bridgePort && bridgePort.disabled) {
        hops.push({
          hopNumber: hopCounter++,
          deviceId: currentDev.id,
          deviceName: currentDev.name,
          ingressInterfaceId: ingressPort?.id,
          ingressInterfaceName: ingressPort?.name,
          action: 'DROP',
          vlanId: currentVlan,
          details: `[RouterOS Bridge] Port ${ingressPort?.name} is disabled in /interface bridge port on ${currentDev.name}`,
          latencyMs: 0,
          status: 'DROPPED',
          dropReason: `INTERFACE_DISABLED: Bridge port ${ingressPort?.name} is disabled in RouterOS`,
        });
        break;
      }

      const parentBridge = bridgePort
        ? currentRosConfig.bridges.find((b) => b.name === bridgePort.bridge)
        : currentRosConfig.bridges[0];

      if (parentBridge && parentBridge.disabled) {
        hops.push({
          hopNumber: hopCounter++,
          deviceId: currentDev.id,
          deviceName: currentDev.name,
          ingressInterfaceId: ingressPort?.id,
          ingressInterfaceName: ingressPort?.name,
          action: 'DROP',
          vlanId: currentVlan,
          details: `[RouterOS Bridge] Bridge '${parentBridge.name}' is administratively disabled on ${currentDev.name}`,
          latencyMs: 0,
          status: 'DROPPED',
          dropReason: `INTERFACE_DISABLED: Bridge ${parentBridge.name} is disabled`,
        });
        break;
      }

      // Ingress VLAN check from Bridge Port PVID or access port
      if (bridgePort && (!parentBridge || parentBridge.vlanFiltering)) {
        if (ingressPort?.mode === 'access') {
          currentVlan = bridgePort.pvid || ingressPort.pvid || 1;
        }
      } else if (ingressPort?.mode === 'access') {
        currentVlan = ingressPort.pvid || 1;
      }

      hops.push({
        hopNumber: hopCounter++,
        deviceId: currentDev.id,
        deviceName: currentDev.name,
        ingressInterfaceId: ingressPort?.id,
        ingressInterfaceName: ingressPort?.name,
        action: 'SWITCH_VLAN',
        vlanId: currentVlan,
        details: `L2 Switch forwarding frame on VLAN ${currentVlan} via RouterOS bridge '${parentBridge?.name || 'bridge1'}' (vlan-filtering=${parentBridge?.vlanFiltering ?? true ? 'yes' : 'no'})`,
        latencyMs: 0.1,
        status: 'OK',
      });

      // Find egress link on switch (Uplink towards router or downstream towards destination)
      const nextLink = project.links.find((l) => {
        if (l.id === lastLinkId) return false;
        return l.sourceDeviceId === currentDev.id || l.targetDeviceId === currentDev.id;
      });

      if (!nextLink) {
        hops.push({
          hopNumber: hopCounter++,
          deviceId: currentDev.id,
          deviceName: currentDev.name,
          action: 'DROP',
          details: `No forwarding port or active uplink found on switch ${currentDev.name}`,
          latencyMs: 0,
          status: 'DROPPED',
          dropReason: 'ROUTE_NOT_FOUND: Broadcast domain boundary with no L3 gateway',
        });
        break;
      }

      const egressPortId = nextLink.sourceDeviceId === currentDev.id ? nextLink.sourceInterfaceId : nextLink.targetInterfaceId;
      const egressPort = currentDev.interfaces.find((i) => i.id === egressPortId);

      // Verify trunk allowed VLANs
      if (egressPort?.mode === 'trunk' && egressPort.taggedVlans && egressPort.taggedVlans.length > 0) {
        if (!egressPort.taggedVlans.includes(currentVlan)) {
          hops.push({
            hopNumber: hopCounter++,
            deviceId: currentDev.id,
            deviceName: currentDev.name,
            egressInterfaceId: egressPort.id,
            egressInterfaceName: egressPort.name,
            action: 'DROP',
            details: `Trunk port ${egressPort.name} pruned VLAN ${currentVlan}. Allowed: [${egressPort.taggedVlans.join(', ')}]`,
            latencyMs: 0,
            status: 'DROPPED',
            dropReason: 'VLAN_NOT_ALLOWED: Frame dropped by 802.1Q egress filter',
          });
          break;
        }
      }

      lastLinkId = nextLink.id;
      currentDeviceId = nextLink.sourceDeviceId === currentDev.id ? nextLink.targetDeviceId : nextLink.sourceDeviceId;
      currentIngressPortId = nextLink.sourceDeviceId === currentDev.id ? nextLink.targetInterfaceId : nextLink.sourceInterfaceId;
      continue;
    }

    // B. Router Processing (Mangle Prerouting -> Routing/PBR -> Mangle Forward -> Firewall Filter -> Mangle Postrouting -> Queue/QoS -> NAT)
    if (currentDev.category === 'router') {
      totalLatency += 0.5; // routing lookup overhead

      // Also check if ingress VLAN sub-interface matches currentVlan for Mangle in-interface matching
      const matchingIngressVlanIface = currentRosConfig.vlans.find(
        (v) => !v.disabled && v.vlanId === currentVlan
      );
      const effectiveInIfaceName = matchingIngressVlanIface?.name || ingressPort?.name;

      // 1. Evaluate RouterOS /ip firewall mangle chain=prerouting
      const preMangle = evaluateMangleChain(
        currentRosConfig,
        'prerouting',
        pktCtx,
        effectiveInIfaceName
      );
      if (preMangle.matchedRules.length === 0 && effectiveInIfaceName !== ingressPort?.name) {
        // Also try matching physical ingress port name if rule matched physical port instead of VLAN sub-interface
        evaluateMangleChain(currentRosConfig, 'prerouting', pktCtx, ingressPort?.name);
      }

      // 2. Evaluate RouterOS /ip route (Connected Subnets + Policy Based Routing / Static Routes Longest Prefix Match)
      const connectedSubnetIp = currentRosConfig.ipAddresses.find(
        (a) => !a.disabled && isIpInSubnet(targetIp, a.address)
      );
      const bestStaticRoute = findBestRoute(currentRosConfig.routes, targetIp, pktCtx.routingMark);
      const matchingVlanSubnet = project.vlans.find((v) => isIpInSubnet(targetIp, v.subnet));

      // Resolve outgoing interface early for Mangle forward/postrouting chains (supports direct gateway, recursive route nexthop, ECMP, and Multi-WAN interfaces)
      let wanPort = currentDev.interfaces.find(
        (i) => i.mode === 'wan' || i.name.includes('wan') || i.name === 'ether1'
      );
      let resolvedGatewayIp = bestStaticRoute?.gateway?.trim() || '';
      if (resolvedGatewayIp.includes(',')) {
        // ECMP route: pick gateway based on src/dst hash
        const ecmpCandidates = resolvedGatewayIp.split(',').map((s) => s.trim()).filter(Boolean);
        const hashIdx = (sourceIpOnly.length + targetIp.length + pktCtx.srcPort + pktCtx.dstPort) % ecmpCandidates.length;
        resolvedGatewayIp = ecmpCandidates[hashIdx] || ecmpCandidates[0];
      }

      // If route uses recursive gateway (e.g. gateway=8.8.8.8), resolve via scope=10 host route
      const recursiveHostRoute = currentRosConfig.routes.find(
        (r) =>
          !r.disabled &&
          r.active !== false &&
          (r.dstAddress === `${resolvedGatewayIp}/32` || r.dstAddress === resolvedGatewayIp) &&
          r.gateway !== resolvedGatewayIp
      );
      if (recursiveHostRoute) {
        resolvedGatewayIp = recursiveHostRoute.gateway.trim();
      }

      const matchedMultiWanEntry = currentRosConfig.multiWanConfig?.wans.find(
        (w) =>
          w.gateway === resolvedGatewayIp ||
          w.healthCheckTarget === bestStaticRoute?.gateway?.trim() ||
          (`to-${w.name}`).toLowerCase() === (bestStaticRoute?.routingTable || bestStaticRoute?.routingMark || '').toLowerCase()
      );

      if (matchedMultiWanEntry) {
        const mwanIface = currentDev.interfaces.find(
          (i) => i.name.toLowerCase() === matchedMultiWanEntry.physicalInterface.toLowerCase()
        );
        if (mwanIface) wanPort = mwanIface;
      } else if (resolvedGatewayIp) {
        const gw = resolvedGatewayIp;
        // Check if gateway matches an interface name directly or an IP in one of the router's interfaces or peer ISP devices
        const byName = currentDev.interfaces.find((i) => i.name.toLowerCase() === gw.toLowerCase());
        const bySubnet = currentDev.interfaces.find(
          (i) => i.ipAddress && isIpInSubnet(gw, i.ipAddress)
        );
        const byRosSubnet = currentRosConfig.ipAddresses.find(
          (a) => !a.disabled && isIpInSubnet(gw, a.address)
        );
        const byPeerIsp = currentDev.interfaces.find((iface) => {
          const link = project.links.find(
            (l) => l.sourceInterfaceId === iface.id || l.targetInterfaceId === iface.id
          );
          if (!link) return false;
          const peerId = link.sourceDeviceId === currentDev.id ? link.targetDeviceId : link.sourceDeviceId;
          const peerDev = project.devices.find((d) => d.id === peerId);
          return peerDev?.interfaces.some((pi) => pi.ipAddress?.split('/')[0] === gw);
        });

        if (byName) wanPort = byName;
        else if (bySubnet) wanPort = bySubnet;
        else if (byRosSubnet) {
          wanPort = currentDev.interfaces.find((i) => i.name === byRosSubnet.interface) || wanPort;
        } else if (byPeerIsp) {
          wanPort = byPeerIsp;
        }
      }

      const effectiveOutIfaceName = connectedSubnetIp?.interface || wanPort?.name;

      // 3. Evaluate RouterOS /ip firewall mangle chain=forward
      evaluateMangleChain(
        currentRosConfig,
        'forward',
        pktCtx,
        effectiveInIfaceName,
        effectiveOutIfaceName
      );

      // 4. Evaluate RouterOS /ip firewall filter chain=forward
      const fwForward = evaluateFirewallChain(
        currentDev,
        'forward',
        effectiveInIfaceName,
        effectiveOutIfaceName
      );
      if (!fwForward.allowed) {
        hops.push({
          hopNumber: hopCounter++,
          deviceId: currentDev.id,
          deviceName: currentDev.name,
          ingressInterfaceId: ingressPort?.id,
          ingressInterfaceName: ingressPort?.name,
          action: 'DROP',
          vlanId: currentVlan,
          details: `[RouterOS Firewall] Transit packet dropped by /ip firewall filter chain=forward action=${fwForward.action} (${fwForward.matchedRuleComment})`,
          latencyMs: 0.3,
          status: 'DROPPED',
          dropReason: `FIREWALL_DROP: Blocked by RouterOS forward filter rule (${fwForward.matchedRuleComment})`,
        });
        break;
      }

      // 5. Evaluate RouterOS /ip firewall mangle chain=postrouting
      evaluateMangleChain(
        currentRosConfig,
        'postrouting',
        pktCtx,
        undefined,
        effectiveOutIfaceName
      );

      // 6. Evaluate RouterOS Simple Queues (/queue simple) & Queue Tree (/queue tree) matching packet-mark or IP
      const matchingQueue = currentRosConfig.queues.find(
        (q) =>
          !q.disabled &&
          ((q.packetMarks && pktCtx.packetMark && q.packetMarks === pktCtx.packetMark) ||
            (!q.packetMarks && (isIpInSubnet(sourceIpOnly, q.target) || isIpInSubnet(targetIp, q.target))))
      );
      const matchingQueueTree = (currentRosConfig.queueTree || []).find(
        (qt) => !qt.disabled && qt.packetMark && pktCtx.packetMark === qt.packetMark
      );

      let queueAnnotation = '';
      if (matchingQueueTree) {
        const limitM = (matchingQueueTree.maxLimitBps / 1_000_000).toFixed(0);
        queueAnnotation = ` [QoS Queue Tree '${matchingQueueTree.name}' (mark=${matchingQueueTree.packetMark}, prio=${matchingQueueTree.priority}): ${limitM}M]`;
        totalLatency += matchingQueueTree.priority <= 2 ? 0.1 : 0.4;
      } else if (matchingQueue) {
        const upM = (matchingQueue.maxLimitUploadBps / 1_000_000).toFixed(0);
        const downM = (matchingQueue.maxLimitDownloadBps / 1_000_000).toFixed(0);
        queueAnnotation = ` [QoS Queue '${matchingQueue.name}'${matchingQueue.packetMarks ? ` (mark=${matchingQueue.packetMarks})` : ''}: ${upM}M/${downM}M]`;
        if (matchingQueue.maxLimitDownloadBps <= 15_000_000) {
          totalLatency += 1.2; // shaping queue delay
        } else {
          totalLatency += 0.2;
        }
      }

      const mangleAnnotation =
        pktCtx.matchedMangleSummary.length > 0
          ? ` [Mangle: ${pktCtx.matchedMangleSummary.join(' | ')}]`
          : '';

      const pbrTableLabel =
        pktCtx.routingMark && pktCtx.routingMark !== 'main'
          ? ` [Routing Table: ${pktCtx.routingMark}]`
          : '';

      const routeDetail = connectedSubnetIp && (!pktCtx.routingMark || pktCtx.routingMark === 'main')
        ? `Connected route via ${connectedSubnetIp.interface} (${connectedSubnetIp.network})`
        : bestStaticRoute
        ? `Matched static route dst-address=${bestStaticRoute.dstAddress} gateway=${bestStaticRoute.gateway} (table=${bestStaticRoute.routingTable || bestStaticRoute.routingMark || 'main'}, distance=${bestStaticRoute.distance})`
        : matchingVlanSubnet
        ? `Connected VLAN ${matchingVlanSubnet.id} (${matchingVlanSubnet.subnet})`
        : `No matching entry in /ip route`;

      hops.push({
        hopNumber: hopCounter++,
        deviceId: currentDev.id,
        deviceName: currentDev.name,
        ingressInterfaceId: ingressPort?.id,
        ingressInterfaceName: ingressPort?.name,
        action: 'ROUTE_LOOKUP',
        vlanId: currentVlan,
        details: `MikroTik RouterOS (${currentRosConfig.version}) FIB lookup for ${targetIp}${pbrTableLabel}: ${routeDetail}${mangleAnnotation}${queueAnnotation}`,
        latencyMs: 0.5,
        status: 'OK',
      });

      if (matchingVlanSubnet) {
        // Check if router has a disabled VLAN interface for this VLAN
        const rosVlanIface = currentRosConfig.vlans.find((v) => v.vlanId === matchingVlanSubnet.id);
        if (rosVlanIface && rosVlanIface.disabled) {
          hops.push({
            hopNumber: hopCounter++,
            deviceId: currentDev.id,
            deviceName: currentDev.name,
            action: 'DROP',
            vlanId: matchingVlanSubnet.id,
            details: `[RouterOS VLAN] Sub-interface '${rosVlanIface.name}' (vlan-id=${rosVlanIface.vlanId}) is disabled in /interface vlan`,
            latencyMs: 0,
            status: 'DROPPED',
            dropReason: `INTERFACE_DISABLED: RouterOS VLAN interface ${rosVlanIface.name} is disabled`,
          });
          break;
        }

        // Inter-VLAN routing
        hops.push({
          hopNumber: hopCounter++,
          deviceId: currentDev.id,
          deviceName: currentDev.name,
          action: 'FORWARD',
          vlanId: matchingVlanSubnet.id,
          details: `Inter-VLAN routed: Swapped from VLAN ${currentVlan} to VLAN ${matchingVlanSubnet.id} (${matchingVlanSubnet.name})`,
          latencyMs: 0.3,
          status: 'OK',
        });
        currentVlan = matchingVlanSubnet.id;
      }

      // Check if another device in the local topology owns the target IP
      const targetDev = project.devices.find((d) => {
        if (d.interfaces.some((i) => i.adminState === 'up' && i.ipAddress?.split('/')[0] === targetIp)) {
          return true;
        }
        const dCfg = RouterOsConfigService.ensureConfig(d);
        return dCfg.ipAddresses.some((a) => !a.disabled && a.address.split('/')[0] === targetIp);
      });

      if (targetDev && (connectedSubnetIp || bestStaticRoute || matchingVlanSubnet)) {
        // Evaluate target device input firewall before delivering
        const targetFwInput = evaluateFirewallChain(targetDev, 'input');
        if (!targetFwInput.allowed) {
          hops.push({
            hopNumber: hopCounter++,
            deviceId: targetDev.id,
            deviceName: targetDev.name,
            action: 'DROP',
            vlanId: currentVlan,
            details: `[RouterOS Firewall] Dropped by destination ${targetDev.name} /ip firewall filter chain=input (${targetFwInput.matchedRuleComment})`,
            latencyMs: 0.2,
            status: 'DROPPED',
            dropReason: `FIREWALL_DROP: Destination ${targetDev.name} blocked packet in input chain`,
          });
          break;
        }

        hops.push({
          hopNumber: hopCounter++,
          deviceId: targetDev.id,
          deviceName: targetDev.name,
          action: 'DELIVER',
          vlanId: currentVlan,
          details: `Direct ARP resolution and frame delivery to target ${targetDev.name} (${targetIp})`,
          latencyMs: totalLatency,
          status: 'OK',
        });

        return {
          id: `sim-${Date.now()}`,
          timestamp,
          sourceDeviceId: sourceDev.id,
          sourceDeviceName: sourceDev.name,
          sourceIp: sourceIpOnly,
          targetIp,
          targetDeviceId: targetDev.id,
          targetDeviceName: targetDev.name,
          protocol,
          success: true,
          totalLatencyMs: parseFloat(totalLatency.toFixed(2)),
          packetLossPercent: 0,
          hops,
          summary: `Success: ${protocol} reply received from ${targetDev.name} (${targetIp}) in ${totalLatency.toFixed(2)}ms.${mangleAnnotation}${queueAnnotation}`,
        };
      }

      // 7. Check for WAN Egress / Public Destination Routing & NAT Masquerade
      if (wanPort && !matchingVlanSubnet) {
        // Must have an active route (e.g., 0.0.0.0/0 or specific prefix) in RouterOS /ip route!
        if (!bestStaticRoute && !connectedSubnetIp) {
          hops.push({
            hopNumber: hopCounter++,
            deviceId: currentDev.id,
            deviceName: currentDev.name,
            action: 'DROP',
            details: `[RouterOS Routing] Router ${currentDev.name} has no active route (0.0.0.0/0 or prefix) for ${targetIp} in /ip route`,
            latencyMs: 0,
            status: 'DROPPED',
            dropReason: `ROUTE_NOT_FOUND: Missing active default route (0.0.0.0/0) or static route in RouterOS /ip route`,
          });
          break;
        }

        // Verify RouterOS /ip firewall nat has an active srcnat (masquerade or src-nat) rule if source IP is private
        const activeNatRule = currentRosConfig.firewall.natRules.find(
          (n) =>
            !n.disabled &&
            n.chain === 'srcnat' &&
            (n.action === 'masquerade' || n.action === 'src-nat') &&
            (!n.srcAddress || isIpInSubnet(sourceIpOnly, n.srcAddress)) &&
            (!n.outInterface || n.outInterface.toLowerCase() === wanPort!.name.toLowerCase()) &&
            (!n.connectionMark || n.connectionMark === pktCtx.connectionMark) &&
            (!n.packetMark || n.packetMark === pktCtx.packetMark) &&
            (!n.routingMark || n.routingMark === pktCtx.routingMark)
        ) || currentRosConfig.firewall.natRules.find(
          (n) =>
            !n.disabled &&
            n.chain === 'srcnat' &&
            (n.action === 'masquerade' || n.action === 'src-nat') &&
            (!n.srcAddress || isIpInSubnet(sourceIpOnly, n.srcAddress))
        );

        if (isPrivateIp(sourceIpOnly) && !activeNatRule) {
          hops.push({
            hopNumber: hopCounter++,
            deviceId: currentDev.id,
            deviceName: currentDev.name,
            egressInterfaceId: wanPort.id,
            egressInterfaceName: wanPort.name,
            action: 'DROP',
            details: `[RouterOS NAT] Outbound private IP ${sourceIpOnly} on ${wanPort.name} has no active srcnat masquerade/src-nat rule in /ip firewall nat`,
            latencyMs: 0,
            status: 'DROPPED',
            dropReason: `NAT_MISCONFIGURED: No active /ip firewall nat srcnat masquerade rule on ${currentDev.name}`,
          });
          break;
        }

        const translatedIp =
          activeNatRule?.action === 'src-nat' && activeNatRule.toAddresses
            ? activeNatRule.toAddresses
            : matchedMultiWanEntry?.ipAddress?.split('/')[0] ||
              wanPort.ipAddress?.split('/')[0] ||
              '103.144.20.2';

        hops.push({
          hopNumber: hopCounter++,
          deviceId: currentDev.id,
          deviceName: currentDev.name,
          egressInterfaceId: wanPort.id,
          egressInterfaceName: wanPort.name,
          action: 'NAT_MASQUERADE',
          details: `[RouterOS NAT] Applied /ip firewall nat (${activeNatRule?.action || 'masquerade'}): Rewrote src ${sourceIpOnly} -> ${translatedIp} on ${wanPort.name}`,
          latencyMs: 0.4,
          status: 'OK',
        });

        // If routed via Multi-WAN Manager entry, evaluate Link / Gateway / Upstream Internet state
        if (matchedMultiWanEntry) {
          if (matchedMultiWanEntry.linkState === 'DOWN' || matchedMultiWanEntry.gatewayState === 'UNREACHABLE') {
            hops.push({
              hopNumber: hopCounter++,
              deviceId: currentDev.id,
              deviceName: `${matchedMultiWanEntry.name} (${matchedMultiWanEntry.ispProviderName})`,
              action: 'DROP',
              details: `[Multi-WAN] ${matchedMultiWanEntry.name} (${wanPort.name}) link/gateway ${matchedMultiWanEntry.gateway} is unreachable`,
              latencyMs: 0,
              status: 'DROPPED',
              dropReason: `WAN_DOWN: ${matchedMultiWanEntry.name} physical link or gateway is down`,
            });
            break;
          }

          if (matchedMultiWanEntry.internetState === 'OFFLINE') {
            hops.push({
              hopNumber: hopCounter++,
              deviceId: `isp-${matchedMultiWanEntry.id}`,
              deviceName: `${matchedMultiWanEntry.name} Gateway (${matchedMultiWanEntry.gateway})`,
              action: 'DROP',
              details: `[Multi-WAN Blackhole] Local ISP Gateway ${matchedMultiWanEntry.gateway} is reachable, but upstream internet (${targetIp}) is OFFLINE on ${matchedMultiWanEntry.ispProviderName}! Enable Recursive Route to auto-failover.`,
              latencyMs: matchedMultiWanEntry.latencyMs || 4,
              status: 'DROPPED',
              dropReason: `ISP_UPSTREAM_OFFLINE: Gateway ${matchedMultiWanEntry.gateway} reachable but upstream internet is down`,
            });
            break;
          }

          const wanLat = matchedMultiWanEntry.latencyMs || 4.5;
          totalLatency += wanLat;

          hops.push({
            hopNumber: hopCounter++,
            deviceId: `isp-${matchedMultiWanEntry.id}`,
            deviceName: `${matchedMultiWanEntry.name} • ${matchedMultiWanEntry.ispProviderName}`,
            action: 'FORWARD',
            details: `Transit via ${matchedMultiWanEntry.name} (${wanPort.name}, gw=${matchedMultiWanEntry.gateway}, ${matchedMultiWanEntry.downloadMbps}M/${matchedMultiWanEntry.uploadMbps}M)`,
            latencyMs: wanLat,
            status: 'OK',
          });

          hops.push({
            hopNumber: hopCounter++,
            deviceId: 'internet-cloud',
            deviceName: 'Global Internet Cloud',
            action: 'DELIVER',
            details: `Target IP ${targetIp} reached via ${matchedMultiWanEntry.name} (${matchedMultiWanEntry.ispProviderName})`,
            latencyMs: totalLatency,
            status: 'OK',
          });

          return {
            id: `sim-${Date.now()}`,
            timestamp,
            sourceDeviceId: sourceDev.id,
            sourceDeviceName: sourceDev.name,
            sourceIp: sourceIpOnly,
            targetIp,
            targetDeviceId: `isp-${matchedMultiWanEntry.id}`,
            targetDeviceName: `${matchedMultiWanEntry.name} (${matchedMultiWanEntry.ispProviderName})`,
            protocol,
            success: true,
            totalLatencyMs: parseFloat(totalLatency.toFixed(2)),
            packetLossPercent: matchedMultiWanEntry.packetLossPercent || 0,
            hops,
            summary: `Success: Public destination ${targetIp} reached via ${matchedMultiWanEntry.name} (${matchedMultiWanEntry.ispProviderName}, ${wanPort.name}, NAT ${translatedIp}) in ${totalLatency.toFixed(2)}ms.${mangleAnnotation}${queueAnnotation}`,
          };
        }

        // Find link connecting WAN port to ISP modem
        const wanLink = project.links.find(
          (l) => l.sourceInterfaceId === wanPort!.id || l.targetInterfaceId === wanPort!.id
        );

        if (wanLink && wanLink.status !== 'DIE' && wanLink.status !== 'DISABLED') {
          const ispDeviceId = wanLink.sourceDeviceId === currentDev.id ? wanLink.targetDeviceId : wanLink.sourceDeviceId;
          const ispDev = project.devices.find((d) => d.id === ispDeviceId);

          if (ispDev) {
            totalLatency += 4.5; // Metro-E / Internet latency

            hops.push({
              hopNumber: hopCounter++,
              deviceId: ispDev.id,
              deviceName: ispDev.name,
              action: 'FORWARD',
              details: `Transit via ISP Uplink ${ispDev.name} into Global Internet Backbone (Gateway ${bestStaticRoute?.gateway || 'Connected'})`,
              latencyMs: 4.5,
              status: 'OK',
            });

            hops.push({
              hopNumber: hopCounter++,
              deviceId: 'internet-cloud',
              deviceName: 'Global Internet Cloud',
              action: 'DELIVER',
              details: `Target IP ${targetIp} reached across Autonomous System routing (AS13335 / AS15169)`,
              latencyMs: totalLatency,
              status: 'OK',
            });

            return {
              id: `sim-${Date.now()}`,
              timestamp,
              sourceDeviceId: sourceDev.id,
              sourceDeviceName: sourceDev.name,
              sourceIp: sourceIpOnly,
              targetIp,
              targetDeviceId: ispDev.id,
              targetDeviceName: ispDev.name,
              protocol,
              success: true,
              totalLatencyMs: parseFloat(totalLatency.toFixed(2)),
              packetLossPercent: 0,
              hops,
              summary: `Success: Public destination ${targetIp} reached via ${currentDev.name} RouterOS NAT (${translatedIp}) and ${ispDev.name} in ${totalLatency.toFixed(2)}ms.${mangleAnnotation}${queueAnnotation}`,
            };
          }
        }
      }

      // If no route to destination
      hops.push({
        hopNumber: hopCounter++,
        deviceId: currentDev.id,
        deviceName: currentDev.name,
        action: 'DROP',
        details: `Router ${currentDev.name} could not forward packet to ${targetIp} (${routeDetail})`,
        latencyMs: 0,
        status: 'DROPPED',
        dropReason: `ROUTE_NOT_FOUND: No matching active route or reachable next-hop gateway for ${targetIp}`,
      });
      break;
    }

    // C. WAN Modem or Endpoint
    if (currentDev.category === 'wan') {
      hops.push({
        hopNumber: hopCounter++,
        deviceId: currentDev.id,
        deviceName: currentDev.name,
        action: 'DELIVER',
        details: `Arrived at ISP Carrier Terminal ${currentDev.name}`,
        latencyMs: totalLatency,
        status: 'OK',
      });
      break;
    }
  }

  const lastHop = hops[hops.length - 1];
  const isSuccess = lastHop?.status === 'OK' && lastHop?.action === 'DELIVER';

  return {
    id: `sim-${Date.now()}`,
    timestamp,
    sourceDeviceId: sourceDev.id,
    sourceDeviceName: sourceDev.name,
    sourceIp: sourceIpOnly,
    targetIp,
    protocol,
    success: isSuccess,
    totalLatencyMs: parseFloat(totalLatency.toFixed(2)),
    packetLossPercent: isSuccess ? 0 : 100,
    hops,
    summary: isSuccess
      ? `Packet successfully delivered to ${targetIp}.`
      : `Packet dropped: ${lastHop?.dropReason || 'Unreachable destination.'}`,
  };
}
