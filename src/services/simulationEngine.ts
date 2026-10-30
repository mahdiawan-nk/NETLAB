import {
  NetworkProject,
  NetworkDevice,
  SimulationResult,
  PacketTraceHop,
} from '../types/network';
import { parseIPv4Cidr } from './validationEngine';
import { RouterOsConfigService } from './routerOsConfigService';
import { RouterOsRoute } from '../types/routerOs';

// Check if IP matches a subnet CIDR (or exact IP)
export function isIpInSubnet(ip: string, subnetOrIp: string): boolean {
  const cleanTarget = subnetOrIp.trim();
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

// Find Longest Prefix Match route in RouterOS routing table
function findBestRoute(routes: RouterOsRoute[], targetIp: string): RouterOsRoute | null {
  const activeRoutes = routes.filter((r) => !r.disabled && r.active !== false);
  let bestRoute: RouterOsRoute | null = null;
  let bestPrefix = -1;
  let bestDistance = 999;

  for (const r of activeRoutes) {
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
  project: NetworkProject
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

  // Helper to check RouterOS firewall rules on a device
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
      if (rule.srcAddress && !isIpInSubnet(sourceIpOnly, rule.srcAddress)) {
        continue;
      }
      if (rule.dstAddress && !isIpInSubnet(targetIp, rule.dstAddress)) {
        continue;
      }
      if (rule.inInterface && inIfaceName && rule.inInterface.toLowerCase() !== inIfaceName.toLowerCase()) {
        continue;
      }
      if (rule.outInterface && outIfaceName && rule.outInterface.toLowerCase() !== outIfaceName.toLowerCase()) {
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

      hops.push({
        hopNumber: hopCounter++,
        deviceId: currentDev.id,
        deviceName: currentDev.name,
        ingressInterfaceId: ingressPort?.id,
        ingressInterfaceName: ingressPort?.name,
        action: 'DELIVER',
        vlanId: currentVlan,
        details: `Packet successfully arrived at destination host ${currentDev.name} (${targetIp} on ${destRosIp?.interface || destIface?.name})`,
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
        summary: `Success: ${protocol} reply received from ${currentDev.name} (${targetIp}) in ${totalLatency.toFixed(2)}ms across ${hops.length} hops.`,
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

    // B. Router Processing (Layer 3 Routing, Firewall Filter, Simple Queue & NAT)
    if (currentDev.category === 'router') {
      totalLatency += 0.5; // routing lookup overhead

      // 1. Evaluate RouterOS /ip firewall filter chain=forward
      const fwForward = evaluateFirewallChain(currentDev, 'forward', ingressPort?.name);
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

      // 2. Evaluate RouterOS Simple Queues (/queue simple) matching source or destination
      const matchingQueue = currentRosConfig.queues.find(
        (q) => !q.disabled && (isIpInSubnet(sourceIpOnly, q.target) || isIpInSubnet(targetIp, q.target))
      );
      let queueAnnotation = '';
      if (matchingQueue) {
        const upM = (matchingQueue.maxLimitUploadBps / 1_000_000).toFixed(0);
        const downM = (matchingQueue.maxLimitDownloadBps / 1_000_000).toFixed(0);
        queueAnnotation = ` [QoS Queue '${matchingQueue.name}': ${upM}M/${downM}M]`;
        if (matchingQueue.maxLimitDownloadBps <= 15_000_000) {
          totalLatency += 1.2; // shaping queue delay
        } else {
          totalLatency += 0.2;
        }
      }

      // 3. Evaluate RouterOS /ip route (Connected Subnets + Static Routes Longest Prefix Match)
      const connectedSubnetIp = currentRosConfig.ipAddresses.find(
        (a) => !a.disabled && isIpInSubnet(targetIp, a.address)
      );
      const bestStaticRoute = findBestRoute(currentRosConfig.routes, targetIp);
      const matchingVlanSubnet = project.vlans.find((v) => isIpInSubnet(targetIp, v.subnet));

      const routeDetail = connectedSubnetIp
        ? `Connected route via ${connectedSubnetIp.interface} (${connectedSubnetIp.network})`
        : bestStaticRoute
        ? `Matched static route dst-address=${bestStaticRoute.dstAddress} gateway=${bestStaticRoute.gateway} (distance=${bestStaticRoute.distance})`
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
        details: `MikroTik RouterOS (${currentRosConfig.version}) FIB lookup for ${targetIp}: ${routeDetail}${queueAnnotation}`,
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
          summary: `Success: ${protocol} reply received from ${targetDev.name} (${targetIp}) in ${totalLatency.toFixed(2)}ms.${queueAnnotation}`,
        };
      }

      // 4. Check for WAN Egress / Public Destination Routing & NAT Masquerade
      const wanPort = currentDev.interfaces.find(
        (i) => i.mode === 'wan' || i.name.includes('wan') || i.name === 'ether1'
      );

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
            (!n.outInterface || n.outInterface.toLowerCase() === wanPort.name.toLowerCase())
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
            : wanPort.ipAddress?.split('/')[0] || '103.144.20.2';

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

        // Find link connecting WAN port to ISP modem
        const wanLink = project.links.find(
          (l) => l.sourceInterfaceId === wanPort.id || l.targetInterfaceId === wanPort.id
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
              summary: `Success: Public destination ${targetIp} reached via ${currentDev.name} RouterOS NAT (${translatedIp}) and ${ispDev.name} in ${totalLatency.toFixed(2)}ms.${queueAnnotation}`,
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
