import {
  NetworkDevice,
  NetworkLink,
  NetworkVlan,
  DiagnosticResult,
  DiagnosticErrorCode,
} from '../types/network';
import {
  InternetCircuit,
  DeviceWorkload,
  CircuitSimulationTelemetry,
  DeviceProcessingCapacityMetrics,
} from '../types/ispWorkload';
import { CABLE_SPECIFICATIONS, TRANSCEIVER_SPECIFICATIONS } from '../data/mediaSpecs';

// Helper: parse IPv4 and prefix
export function parseIPv4Cidr(cidr: string): { ip: string; prefix: number; network: string } | null {
  if (!cidr || !cidr.includes('/')) return null;
  const [ip, prefixStr] = cidr.trim().split('/');
  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;

  const octets = ip.split('.').map((o) => parseInt(o, 10));
  if (octets.length !== 4 || octets.some((o) => isNaN(o) || o < 0 || o > 255)) return null;

  // Calculate network address
  const ipNum = (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3];
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix));
  const netNum = ipNum & mask;

  const netOctets = [
    (netNum >>> 24) & 255,
    (netNum >>> 16) & 255,
    (netNum >>> 8) & 255,
    netNum & 255,
  ];

  return { ip, prefix, network: netOctets.join('.') };
}

export function validateTopology(
  devices: NetworkDevice[],
  links: NetworkLink[],
  vlans: NetworkVlan[],
  circuits?: InternetCircuit[],
  workloads?: DeviceWorkload[],
  telemetry?: Record<string, CircuitSimulationTelemetry>,
  deviceMetrics?: Record<string, DeviceProcessingCapacityMetrics>
): DiagnosticResult[] {
  const diagnostics: DiagnosticResult[] = [];
  const now = new Date().toISOString();

  const deviceMap = new Map<string, NetworkDevice>(devices.map((d) => [d.id, d]));
  const interfaceMap = new Map<string, { device: NetworkDevice; iface: NetworkDevice['interfaces'][0] }>();

  // Index all interfaces
  for (const dev of devices) {
    for (const iface of dev.interfaces) {
      interfaceMap.set(iface.id, { device: dev, iface });
    }
  }

  // 1. Device Hostname Duplication Check
  const nameMap = new Map<string, string[]>();
  for (const dev of devices) {
    const trimmed = dev.name.trim().toLowerCase();
    const existing = nameMap.get(trimmed) || [];
    existing.push(dev.id);
    nameMap.set(trimmed, existing);
  }
  for (const [name, ids] of nameMap.entries()) {
    if (ids.length > 1) {
      diagnostics.push({
        id: `diag-name-dup-${ids[0]}`,
        errorCode: 'DEVICE_NAME_DUPLICATE',
        severity: 'warning',
        objectId: ids[0],
        objectType: 'device',
        affectedObjects: ids,
        status: 'DEGRADED',
        observedCondition: `Multiple devices have the same hostname '${name}'`,
        evidence: `Devices [${ids.map((id) => deviceMap.get(id)?.name).join(', ')}] have colliding hostnames`,
        probableCause: 'Copy/paste or manual duplicate naming without unique identifiers.',
        impact: 'DNS resolution, DHCP lease conflicts, and MikroTik neighbor discovery confusion.',
        recommendedAction: 'Rename devices with unique identifiers (e.g. CORE-1, SW-DIST-2, AP-FLOOR3).',
        timestamp: now,
      });
    }
  }

  // 2. IP Address Conflicts Check (including RouterOS logical & secondary IPs)
  const ipMap = new Map<string, { devName: string; ifaceName: string; deviceId: string }[]>();
  for (const dev of devices) {
    const recordedDeviceIps = new Set<string>();
    if (dev.routerOsConfig?.ipAddresses) {
      for (const rosIp of dev.routerOsConfig.ipAddresses) {
        if (rosIp.disabled) continue;
        const parsed = parseIPv4Cidr(rosIp.address);
        if (parsed) {
          const key = `${parsed.ip}:${rosIp.interface}`;
          recordedDeviceIps.add(key);
          const list = ipMap.get(parsed.ip) || [];
          list.push({ devName: dev.name, ifaceName: rosIp.interface, deviceId: dev.id });
          ipMap.set(parsed.ip, list);
        }
      }
    }
    for (const iface of dev.interfaces) {
      if (iface.ipAddress) {
        const parsed = parseIPv4Cidr(iface.ipAddress);
        if (parsed && !recordedDeviceIps.has(`${parsed.ip}:${iface.name}`)) {
          const list = ipMap.get(parsed.ip) || [];
          list.push({ devName: dev.name, ifaceName: iface.name, deviceId: dev.id });
          ipMap.set(parsed.ip, list);
        }
      }
    }
  }
  for (const [ip, holders] of ipMap.entries()) {
    if (holders.length > 1) {
      diagnostics.push({
        id: `diag-ip-conflict-${ip}`,
        errorCode: 'IP_ADDRESS_CONFLICT',
        severity: 'error',
        objectId: holders[0].deviceId,
        objectType: 'interface',
        affectedObjects: holders.map((h) => h.deviceId),
        status: 'DIE',
        observedCondition: `IP Address conflict detected on ${ip}`,
        evidence: `IP ${ip} configured on ${holders.map((h) => `${h.devName}:${h.ifaceName}`).join(' and ')}`,
        probableCause: 'Duplicate static IP assignment on overlapping network interfaces.',
        impact: 'ARP flapping, intermittent packet drops, and complete loss of reachability for affected hosts.',
        recommendedAction: 'Assign unique IP addresses within the respective subnets or enable DHCP.',
        timestamp: now,
      });
    }
  }

  // 3. Link Physical & Transceiver Validation
  for (const link of links) {
    const src = interfaceMap.get(link.sourceInterfaceId);
    const tgt = interfaceMap.get(link.targetInterfaceId);

    if (!src || !tgt) {
      diagnostics.push({
        id: `diag-endpoint-missing-${link.id}`,
        errorCode: 'LINK_ENDPOINT_MISSING',
        severity: 'error',
        objectId: link.id,
        objectType: 'link',
        affectedObjects: [link.sourceDeviceId, link.targetDeviceId],
        status: 'DIE',
        observedCondition: 'Link refers to one or more missing interfaces or deleted devices.',
        evidence: `Source found: ${!!src}, Target found: ${!!tgt}`,
        probableCause: 'Device was removed or port definition was modified while link persisted.',
        impact: 'Link is completely severed and cannot carry any frame.',
        recommendedAction: 'Remove orphaned link and re-establish connection from available ports.',
        timestamp: now,
      });
      continue;
    }

    const srcDev = src.device;
    const tgtDev = tgt.device;
    const srcIface = src.iface;
    const tgtIface = tgt.iface;

    // Check Administrative State
    if (srcIface.adminState === 'down' || tgtIface.adminState === 'down') {
      const downList = [
        srcIface.adminState === 'down' ? `${srcDev.name}:${srcIface.name}` : null,
        tgtIface.adminState === 'down' ? `${tgtDev.name}:${tgtIface.name}` : null,
      ].filter(Boolean);

      diagnostics.push({
        id: `diag-admin-down-${link.id}`,
        errorCode: 'INTERFACE_DISABLED',
        severity: 'warning',
        objectId: link.id,
        objectType: 'link',
        affectedObjects: [srcDev.id, tgtDev.id],
        status: 'DISABLED',
        observedCondition: `Physical link inactive because interface is administratively disabled.`,
        evidence: `Port(s) down: ${downList.join(', ')}`,
        probableCause: 'Interface has admin status set to disabled in configuration.',
        impact: 'No physical link carrier (NO CARRIER / Link Down).',
        recommendedAction: 'Set interface admin status to UP (e.g. `/interface enable [name]`).',
        timestamp: now,
      });
    }

    // Media & Port Physical Compatibility Check
    const cableSpec = CABLE_SPECIFICATIONS[link.mediaType];
    const isFiberMedia = link.mediaType === 'fiber-smf' || link.mediaType === 'fiber-mmf';

    // A. Fiber cable plugged into copper Ethernet without SFP cage
    if (isFiberMedia && (srcIface.type === 'ethernet' || tgtIface.type === 'ethernet')) {
      const wrongIface = srcIface.type === 'ethernet' ? `${srcDev.name}:${srcIface.name}` : `${tgtDev.name}:${tgtIface.name}`;
      diagnostics.push({
        id: `diag-media-mismatch-${link.id}`,
        errorCode: 'MEDIA_MISMATCH',
        severity: 'error',
        objectId: link.id,
        objectType: 'link',
        affectedObjects: [srcDev.id, tgtDev.id],
        status: 'DIE',
        observedCondition: `Optical fiber media connected directly to copper RJ45 port ${wrongIface}.`,
        evidence: `Port type is ${srcIface.type === 'ethernet' ? 'Copper Ethernet' : 'SFP'}, but media is ${cableSpec?.name}.`,
        probableCause: 'Direct optical patch inserted into RJ45 jack without media converter or SFP cage.',
        impact: 'Physical connection cannot mate; link will never achieve signal lock.',
        recommendedAction: 'Use Cat6/Cat6A copper cable or route through an SFP/SFP+ optical port with transceiver.',
        timestamp: now,
      });
    }

    // B. Copper cable plugged into SFP cage without copper SFP module
    if (!isFiberMedia && (srcIface.type === 'sfp' || srcIface.type === 'sfp-plus' || tgtIface.type === 'sfp' || tgtIface.type === 'sfp-plus')) {
      const sfpEnd = (srcIface.type === 'sfp' || srcIface.type === 'sfp-plus') ? srcIface : tgtIface;
      const devEnd = (srcIface.type === 'sfp' || srcIface.type === 'sfp-plus') ? srcDev : tgtDev;
      const trans = sfpEnd.transceiver;

      if (!trans || (trans !== 'sfp-1g-rj45' && trans !== 'sfpplus-10g-rj45')) {
        diagnostics.push({
          id: `diag-sfp-copper-missing-module-${link.id}`,
          errorCode: 'MEDIA_MISMATCH',
          severity: 'error',
          objectId: link.id,
          objectType: 'link',
          affectedObjects: [devEnd.id],
          status: 'DIE',
          observedCondition: `Copper cable plugged into SFP slot ${devEnd.name}:${sfpEnd.name} without RJ45 SFP module.`,
          evidence: `Slot is ${sfpEnd.type}, installed transceiver is '${trans || 'EMPTY'}', cable is copper.`,
          probableCause: 'Missing copper S-RJ01 or S+RJ10 transceiver module in SFP cage.',
          impact: 'No physical mating or electrical coupling possible.',
          recommendedAction: 'Install MikroTik S-RJ01 or S+RJ10 copper module, or use optical fiber cable.',
          timestamp: now,
        });
      }
    }

    // C. Optical Transceiver Compatibility & Fiber Type Check
    if (isFiberMedia) {
      const srcTransType = srcIface.transceiver || 'none';
      const tgtTransType = tgtIface.transceiver || 'none';
      const srcSpec = TRANSCEIVER_SPECIFICATIONS[srcTransType];
      const tgtSpec = TRANSCEIVER_SPECIFICATIONS[tgtTransType];

      // Missing transceiver
      if (!srcSpec || !tgtSpec) {
        const emptyPorts = [];
        if (!srcSpec) emptyPorts.push(`${srcDev.name}:${srcIface.name}`);
        if (!tgtSpec) emptyPorts.push(`${tgtDev.name}:${tgtIface.name}`);

        diagnostics.push({
          id: `diag-transceiver-missing-${link.id}`,
          errorCode: 'TRANSCEIVER_INCOMPATIBLE',
          severity: 'error',
          objectId: link.id,
          objectType: 'link',
          affectedObjects: [srcDev.id, tgtDev.id],
          status: 'DIE',
          observedCondition: `Optical link missing transceiver module in SFP cage(s): ${emptyPorts.join(', ')}.`,
          evidence: `Fiber patch cord connected to empty SFP cage without optical transceiver optics.`,
          probableCause: 'Transceiver slot is unpopulated.',
          impact: 'No laser emitter or photodiode; link remains dead.',
          recommendedAction: 'Insert compatible SFP/SFP+ optical transceiver module (e.g. 10G LR for SMF or 10G SR for MMF).',
          timestamp: now,
        });
      } else {
        // Fiber Mismatch: SMF vs MMF
        if (link.mediaType === 'fiber-smf' && (srcSpec.fiberType === 'mmf' || tgtSpec.fiberType === 'mmf')) {
          diagnostics.push({
            id: `diag-fiber-mmf-on-smf-${link.id}`,
            errorCode: 'TRANSCEIVER_INCOMPATIBLE',
            severity: 'error',
            objectId: link.id,
            objectType: 'link',
            affectedObjects: [srcDev.id, tgtDev.id],
            status: 'DIE',
            observedCondition: `Multi-Mode optics (850nm SX/SR) installed on Single-Mode Yellow fiber cable (9/125µm).`,
            evidence: `Optic is ${srcSpec.modelName} (MMF), but patch cord is OS2 Single-Mode.`,
            probableCause: 'Core diameter mismatch: 9µm SMF core cannot couple 850nm LED/VCSEL light efficiently.',
            impact: 'Severe optical attenuation > 30dB, link cannot achieve bit-lock.',
            recommendedAction: 'Replace cable with OM3/OM4 Aqua Multi-Mode fiber or upgrade optics to Single-Mode (10G LR / 1G LX).',
            timestamp: now,
          });
        }

        if (link.mediaType === 'fiber-mmf' && (srcSpec.fiberType === 'smf' || tgtSpec.fiberType === 'smf')) {
          diagnostics.push({
            id: `diag-fiber-smf-on-mmf-${link.id}`,
            errorCode: 'TRANSCEIVER_INCOMPATIBLE',
            severity: 'warning',
            objectId: link.id,
            objectType: 'link',
            affectedObjects: [srcDev.id, tgtDev.id],
            status: 'DEGRADED',
            observedCondition: `Single-Mode optics (1310nm LR/LX) connected via Multi-Mode OM3/OM4 cable.`,
            evidence: `Optic is Single-Mode laser, cable is 50µm Multi-Mode.`,
            probableCause: 'Differential mode delay (DMD) and modal dispersion.',
            impact: 'Signal jitter and packet loss, limited to short distances (< 300m) with mode conditioning.',
            recommendedAction: 'Use matching OS2 Single-Mode Yellow fiber cable.',
            timestamp: now,
          });
        }

        // BiDi Transceiver Check (BiDi Up must connect to BiDi Down)
        if (srcTransType === 'sfpplus-10g-bidi-u' && tgtTransType !== 'sfpplus-10g-bidi-d') {
          diagnostics.push({
            id: `diag-bidi-mismatch-${link.id}`,
            errorCode: 'TRANSCEIVER_INCOMPATIBLE',
            severity: 'error',
            objectId: link.id,
            objectType: 'link',
            affectedObjects: [srcDev.id, tgtDev.id],
            status: 'DIE',
            observedCondition: `BiDi Up transceiver (Tx 1270 / Rx 1330) not paired with BiDi Down (Tx 1330 / Rx 1270).`,
            evidence: `Source has ${srcSpec.modelName}, but Target has ${tgtSpec.modelName}.`,
            probableCause: 'Both ends transmitting on conflicting or mismatched optical wavelengths.',
            impact: 'Receiver photodiode receives no optical carrier on designated passband.',
            recommendedAction: 'Pair S+23LC10D (BiDi Up) with S+32LC10D (BiDi Down) at opposite end of single-strand fiber.',
            timestamp: now,
          });
        }

        // Distance / Optical Budget Check
        const maxDist = Math.min(srcSpec.maxDistanceMeters, tgtSpec.maxDistanceMeters);
        if (link.cableLengthMeters > maxDist) {
          diagnostics.push({
            id: `diag-optical-dist-exceeded-${link.id}`,
            errorCode: 'FIBER_SIGNAL_LOSS',
            severity: 'error',
            objectId: link.id,
            objectType: 'link',
            affectedObjects: [srcDev.id, tgtDev.id],
            status: 'DIE',
            observedCondition: `Fiber length (${link.cableLengthMeters}m) exceeds transceiver maximum rating (${maxDist}m).`,
            evidence: `Cable length is ${link.cableLengthMeters}m, but optic reach limit is ${maxDist}m.`,
            probableCause: 'Optical span exceeds optical power budget of installed transceivers.',
            impact: 'Complete optical signal loss (LOS) or severe CRC errors.',
            recommendedAction: `Upgrade transceivers to longer reach (e.g. S+55DLC40D 40km ER) or install optical repeater.`,
            timestamp: now,
          });
        }
      }
    }

    // D. Copper Distance Check
    if (!isFiberMedia && link.cableLengthMeters > 100) {
      diagnostics.push({
        id: `diag-copper-length-exceeded-${link.id}`,
        errorCode: 'SPEED_MISMATCH',
        severity: 'warning',
        objectId: link.id,
        objectType: 'link',
        affectedObjects: [srcDev.id, tgtDev.id],
        status: 'DEGRADED',
        observedCondition: `Copper Ethernet cable length (${link.cableLengthMeters}m) exceeds IEEE 802.3 100-meter limit.`,
        evidence: `UTP/STP copper certified channel limit is 100 meters (90m horizontal + 10m patch cords).`,
        probableCause: 'Excessive copper cable distance.',
        impact: 'High packet loss, auto-negotiation failure down to 10Mbps half-duplex or complete link drop.',
        recommendedAction: 'Install an intermediate PoE extender switch or replace run with Single-Mode Fiber.',
        timestamp: now,
      });
    }

    // E. VLAN & Port Mode Compatibility
    // If both are Access ports, do their PVIDs match?
    if (srcIface.mode === 'access' && tgtIface.mode === 'access') {
      const srcPvid = srcIface.pvid || 1;
      const tgtPvid = tgtIface.pvid || 1;
      if (srcPvid !== tgtPvid) {
        diagnostics.push({
          id: `diag-vlan-pvid-mismatch-${link.id}`,
          errorCode: 'VLAN_MISMATCH',
          severity: 'warning',
          objectId: link.id,
          objectType: 'link',
          affectedObjects: [srcDev.id, tgtDev.id],
          status: 'DEGRADED',
          observedCondition: `Access port PVID mismatch: ${srcDev.name}:${srcIface.name} (VLAN ${srcPvid}) <-> ${tgtDev.name}:${tgtIface.name} (VLAN ${tgtPvid}).`,
          evidence: `Frames leaving VLAN ${srcPvid} untagged will be ingested as VLAN ${tgtPvid} on the peer switch.`,
          probableCause: 'Accidental cross-connection of two different access VLAN segments.',
          impact: 'VLAN leakage / unintentional bridging of two separate broadcast domains.',
          recommendedAction: 'Align PVID on both access ports or change inter-switch link to Trunk mode.',
          timestamp: now,
        });
      }
    }

    // F. Direct L3 IP Subnet Mismatch Check
    if (srcIface.ipAddress && tgtIface.ipAddress) {
      const srcNet = parseIPv4Cidr(srcIface.ipAddress);
      const tgtNet = parseIPv4Cidr(tgtIface.ipAddress);

      if (srcNet && tgtNet && (srcNet.network !== tgtNet.network || srcNet.prefix !== tgtNet.prefix)) {
        diagnostics.push({
          id: `diag-subnet-mismatch-${link.id}`,
          errorCode: 'IP_SUBNET_MISMATCH',
          severity: 'error',
          objectId: link.id,
          objectType: 'link',
          affectedObjects: [srcDev.id, tgtDev.id],
          status: 'DIE',
          observedCondition: `IP Subnet mismatch on point-to-point link: ${srcIface.ipAddress} <-> ${tgtIface.ipAddress}.`,
          evidence: `Source network: ${srcNet.network}/${srcNet.prefix}, Target network: ${tgtNet.network}/${tgtNet.prefix}.`,
          probableCause: 'Misconfigured subnet mask or mismatched IP address on routed link.',
          impact: 'Direct IP communication, ARP resolution, and routing will fail completely between these nodes.',
          recommendedAction: `Reconfigure one of the interfaces to share the same subnet prefix (e.g. /30 for point-to-point).`,
          timestamp: now,
        });
      }
    }
  }

  // 4. Default Gateway Reachability Check for Endpoints
  for (const dev of devices) {
    if (dev.category === 'endpoint' && dev.defaultGateway) {
      const gwParsed = parseIPv4Cidr(dev.defaultGateway);
      const devIfaceWithIp = dev.interfaces.find((i) => i.ipAddress);
      if (devIfaceWithIp && devIfaceWithIp.ipAddress) {
        const ifaceParsed = parseIPv4Cidr(devIfaceWithIp.ipAddress);
        if (ifaceParsed) {
          const gwIpOnly = dev.defaultGateway.split('/')[0];
          // Check if gateway IP is in device's subnet
          const devNet = parseIPv4Cidr(`${gwIpOnly}/${ifaceParsed.prefix}`);
          if (devNet && devNet.network !== ifaceParsed.network) {
            diagnostics.push({
              id: `diag-gw-unreachable-${dev.id}`,
              errorCode: 'GATEWAY_UNREACHABLE',
              severity: 'error',
              objectId: dev.id,
              objectType: 'device',
              affectedObjects: [dev.id],
              status: 'DEGRADED',
              observedCondition: `Default gateway ${dev.defaultGateway} is not in local subnet ${ifaceParsed.network}/${ifaceParsed.prefix}.`,
              evidence: `Endpoint IP ${devIfaceWithIp.ipAddress} cannot directly ARP resolve gateway outside its subnet.`,
              probableCause: 'Default gateway assigned from a different subnet than the host interface IP.',
              impact: 'Device cannot route traffic outside local broadcast domain (No Internet / No WAN).',
              recommendedAction: `Set default gateway to an IP within ${ifaceParsed.network}/${ifaceParsed.prefix} (e.g. router interface).`,
              timestamp: now,
            });
          }
        }
      }
    }
  }

  // 5. Unmapped Internet Circuit Termination Check
  if (circuits) {
    for (const c of circuits) {
      if (c.status === 'active' && (!c.cpeDeviceId || !c.targetRouterDeviceId)) {
        diagnostics.push({
          id: `diag-unmapped-circuit-${c.id}`,
          errorCode: 'ROUTE_NOT_FOUND',
          severity: 'warning',
          objectId: c.id,
          objectType: 'link',
          affectedObjects: [c.id],
          status: 'DEGRADED',
          observedCondition: `Internet Circuit '${c.circuitName}' is not mapped to a physical Modem/ONT or Core Router.`,
          evidence: `Circuit is active in project but lacks physical termination link to network hardware.`,
          probableCause: 'Circuit provisioned without completing CPE modem and router interface mapping.',
          impact: 'Subnet endpoints cannot route internet-bound traffic through this circuit.',
          recommendedAction: 'Open ISP & Circuits tab and configure CPE & WAN Interface mapping.',
          timestamp: now,
        });
      }
    }
  }

  // 6. Live WAN Sizing & Dropped Traffic Check
  if (telemetry) {
    for (const [circuitId, telem] of Object.entries(telemetry)) {
      if (telem.droppedDownMbps > 0) {
        diagnostics.push({
          id: `diag-wan-saturation-${circuitId}`,
          errorCode: 'WAN_SATURATION',
          severity: 'error',
          objectId: circuitId,
          objectType: 'link',
          affectedObjects: [circuitId],
          status: 'DEGRADED',
          observedCondition: `WAN Circuit '${telem.circuitName}' is saturated (dropping ${telem.droppedDownMbps} Mbps).`,
          evidence: `Peak traffic demand (${telem.demandDownMbps} Mbps) exceeds circuit provisioned capacity.`,
          probableCause: 'Simultaneous high-bandwidth applications or unconstrained endpoint workloads.',
          impact: `High packet loss (${telem.packetLossPercent}%), bufferbloat latency (${telem.latencyMs}ms), and severe user slowdowns.`,
          recommendedAction: 'Upgrade circuit bandwidth, configure MikroTik PCQ queue tree, or offload low priority traffic.',
          timestamp: now,
        });
      }

      if (telem.isCirViolated) {
        diagnostics.push({
          id: `diag-cir-violation-${circuitId}`,
          errorCode: 'CIR_VIOLATION',
          severity: 'warning',
          objectId: circuitId,
          objectType: 'link',
          affectedObjects: [circuitId],
          status: 'DEGRADED',
          observedCondition: `Committed Information Rate (CIR) violated on '${telem.circuitName}'.`,
          evidence: `Delivered bandwidth dropped below contract guaranteed CIR minimum with contention.`,
          probableCause: 'High oversubscription contention ratio on shared broadband transit during peak hours.',
          impact: 'Throughput guarantees in Service Level Agreement cannot be fulfilled.',
          recommendedAction: 'Review SLA with ISP provider NOC or upgrade to a 1:1 dedicated internet access (DIA) circuit.',
          timestamp: now,
        });
      }
    }
  }

  // 7. Router / Gateway CPU Processing Bottleneck Check
  if (deviceMetrics) {
    for (const [devId, dm] of Object.entries(deviceMetrics)) {
      if (dm.isBottleneck) {
        diagnostics.push({
          id: `diag-cpu-bottleneck-${devId}`,
          errorCode: 'ROUTER_PROCESSING_BOTTLENECK',
          severity: 'warning',
          objectId: devId,
          objectType: 'device',
          affectedObjects: [devId],
          status: 'DEGRADED',
          observedCondition: `Core device CPU bottleneck detected on ${dm.deviceName} (${dm.cpuLoadPercent}% CPU).`,
          evidence: `Routing load of ${dm.currentThroughputMbps} Mbps pushing CPU cores near maximum execution capacity.`,
          probableCause: 'High packet forwarding load with firewall/NAT inspection without hardware offloading.',
          impact: 'Packet jitter, buffer queue drops, and sluggish web management / CLI response.',
          recommendedAction: 'Enable FastTrack hardware offload in RouterOS or upgrade router to higher core count.',
          timestamp: now,
        });
      }
    }
  }

  // 8. LAN Workload Oversubscription Check
  if (workloads && circuits) {
    const totalWorkloadDown = workloads
      .filter((w) => w.enabled)
      .reduce((sum, w) => sum + (w.averageDownloadKbps || 0) / 1000, 0);

    const totalWanCap = circuits
      .filter((c) => c.status === 'active')
      .reduce((sum, c) => {
        const mult = c.downloadUnit === 'Gbps' ? 1000 : c.downloadUnit === 'Kbps' ? 0.001 : 1;
        return sum + c.downloadBandwidth * mult;
      }, 0);

    if (totalWanCap > 0 && totalWorkloadDown > totalWanCap * 2.2) {
      diagnostics.push({
        id: `diag-oversubscribed-uplink`,
        errorCode: 'OVERSUBSCRIBED_UPLINK',
        severity: 'warning',
        objectId: 'project-uplink',
        objectType: 'device',
        affectedObjects: circuits.map((c) => c.id),
        status: 'DEGRADED',
        observedCondition: `LAN workload demand (${totalWorkloadDown.toFixed(1)} Mbps) oversubscribes WAN capacity (${totalWanCap} Mbps) by ${(totalWorkloadDown / totalWanCap).toFixed(1)}x.`,
        evidence: `Aggregate workload profiles exceed total available Internet transit during peak periods.`,
        probableCause: 'Multiple high-density VLANs configured without proportional upstream WAN transit.',
        impact: 'Periodic link saturation, bufferbloat latency spikes, and packet dropping during peak hours.',
        recommendedAction: 'Provision additional secondary WAN circuit or configure per-VLAN bandwidth rate limiting.',
        timestamp: now,
      });
    }
  }

  // 9. RouterOS Configuration Validation (Routes, NAT, Firewall, DHCP)
  for (const dev of devices) {
    const cfg = dev.routerOsConfig;
    if (!cfg) continue;

    // A. Router Default Route & NAT Masquerade Check
    if (dev.category === 'router') {
      const hasActiveDefaultRoute = (cfg.routes || []).some(
        (r) => !r.disabled && r.dstAddress === '0.0.0.0/0'
      );
      if (!hasActiveDefaultRoute) {
        diagnostics.push({
          id: `diag-ros-no-default-route-${dev.id}`,
          errorCode: 'ROUTE_NOT_FOUND',
          severity: 'warning',
          objectId: dev.id,
          objectType: 'device',
          affectedObjects: [dev.id],
          status: 'DEGRADED',
          observedCondition: `RouterOS on ${dev.name} has no active default route (0.0.0.0/0) in /ip route.`,
          evidence: `All 0.0.0.0/0 entries in /ip route are either removed or disabled.`,
          probableCause: 'Default gateway route was deleted or disabled in RouterOS CLI or Winbox GUI.',
          impact: 'Router cannot forward traffic to public Internet destinations outside local connected subnets.',
          recommendedAction: 'Add an active default route: `/ip route add dst-address=0.0.0.0/0 gateway=<wan-gw-ip>`.',
          timestamp: now,
        });
      }

      const hasActiveMasquerade = (cfg.firewall?.natRules || []).some(
        (n) => !n.disabled && n.chain === 'srcnat' && (n.action === 'masquerade' || n.action === 'src-nat')
      );
      if (!hasActiveMasquerade) {
        diagnostics.push({
          id: `diag-ros-no-nat-${dev.id}`,
          errorCode: 'NAT_MISCONFIGURED',
          severity: 'warning',
          objectId: dev.id,
          objectType: 'device',
          affectedObjects: [dev.id],
          status: 'DEGRADED',
          observedCondition: `RouterOS on ${dev.name} has no active srcnat masquerade or src-nat rule in /ip firewall nat.`,
          evidence: `No enabled rule with chain=srcnat and action=masquerade/src-nat found.`,
          probableCause: 'WAN NAT rule was disabled or deleted in RouterOS configuration.',
          impact: 'Private RFC1918 LAN hosts cannot reach public Internet targets through WAN uplink.',
          recommendedAction: 'Enable NAT masquerade: `/ip firewall nat add chain=srcnat action=masquerade out-interface=ether1`.',
          timestamp: now,
        });
      }
    }

    // B. DHCP Server Pool & Interface IP Validation
    for (const dhcp of cfg.dhcpServers || []) {
      if (dhcp.disabled) continue;
      const hasIfaceIp = (cfg.ipAddresses || []).some(
        (ip) => !ip.disabled && ip.interface.toLowerCase() === dhcp.interface.toLowerCase()
      );
      const hasPool =
        dhcp.addressPool === 'static-only' ||
        (cfg.ipPools || []).some((p) => p.name.toLowerCase() === dhcp.addressPool.toLowerCase());

      if (!hasIfaceIp || !hasPool) {
        diagnostics.push({
          id: `diag-ros-dhcp-invalid-${dev.id}-${dhcp.id}`,
          errorCode: 'DHCP_UNAVAILABLE',
          severity: 'warning',
          objectId: dev.id,
          objectType: 'device',
          affectedObjects: [dev.id],
          status: 'DEGRADED',
          observedCondition: `RouterOS DHCP Server '${dhcp.name}' on ${dev.name}:${dhcp.interface} is misconfigured.`,
          evidence: !hasIfaceIp
            ? `Interface '${dhcp.interface}' has no active IP address assigned in /ip address.`
            : `Referenced IP pool '${dhcp.addressPool}' does not exist in /ip pool.`,
          probableCause: 'DHCP server enabled before assigning an IP subnet to the interface or creating the IP pool.',
          impact: 'Downstream endpoints on this segment will fail to obtain dynamic DHCP leases.',
          recommendedAction: !hasIfaceIp
            ? `Assign an IP address to ${dhcp.interface} via \`/ip address add\`.`
            : `Create IP pool '${dhcp.addressPool}' via \`/ip pool add\`.`,
          timestamp: now,
        });
      }
    }

    // C. Unconditional Firewall Drop Rule Warning
    for (const rule of cfg.firewall?.filterRules || []) {
      if (rule.disabled) continue;
      if (
        (rule.action === 'drop' || rule.action === 'reject') &&
        !rule.srcAddress &&
        !rule.dstAddress &&
        !rule.protocol &&
        !rule.inInterface &&
        !rule.connectionState
      ) {
        diagnostics.push({
          id: `diag-ros-fw-dropall-${dev.id}-${rule.id}`,
          errorCode: 'FIREWALL_DROP',
          severity: 'warning',
          objectId: dev.id,
          objectType: 'device',
          affectedObjects: [dev.id],
          status: 'DEGRADED',
          observedCondition: `Unconditional '${rule.action}' rule active in /ip firewall filter chain=${rule.chain} on ${dev.name}.`,
          evidence: `Rule ${rule.id} (${rule.comment || 'no comment'}) drops all ${rule.chain} packets without filter criteria.`,
          probableCause: 'Broad firewall drop rule added without specifying src-address, dst-address, or connection-state.',
          impact: `All ${rule.chain === 'forward' ? 'routed transit' : 'device management/ICMP'} traffic matching chain=${rule.chain} will be dropped.`,
          recommendedAction: 'Disable or refine the firewall filter rule in Winbox GUI (IP > Firewall) or `/ip firewall filter`.',
          timestamp: now,
        });
      }
    }
  }

  return diagnostics;
}
