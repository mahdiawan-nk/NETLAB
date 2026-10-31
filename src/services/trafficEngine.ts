import {
  NetworkProject,
  NetworkLink,
  LinkTrafficStats,
  IspService,
  NetworkDevice,
  NetworkEventLog,
} from '../types/network';
import {
  InternetCircuit,
  DeviceWorkload,
  CircuitSimulationTelemetry,
  DeviceProcessingCapacityMetrics,
  WorkloadEngineSummary,
  BandwidthUnit,
} from '../types/ispWorkload';

// Helper to convert speed string to bits per second
export function speedStringToBps(speed: string): number {
  switch (speed) {
    case '100M':
      return 100_000_000;
    case '1G':
      return 1_000_000_000;
    case '2.5G':
      return 2_500_000_000;
    case '10G':
      return 10_000_000_000;
    case '25G':
      return 25_000_000_000;
    case '100G':
      return 100_000_000_000;
    default:
      return 1_000_000_000;
  }
}

// Convert Bandwidth Value to Mbps
export function toMbps(val: number, unit?: BandwidthUnit): number {
  if (!val) return 0;
  if (unit === 'Gbps') return val * 1000;
  if (unit === 'Kbps') return val / 1000;
  return val; // Default Mbps
}

// Convert Bandwidth Value to bps
export function toBps(val: number, unit?: BandwidthUnit): number {
  return toMbps(val, unit) * 1_000_000;
}

// Calculate Fair-Share Throughput for Shared ISP
export function calculateIspThroughput(isp: IspService): {
  estimatedThroughputDownMbps: number;
  estimatedThroughputUpMbps: number;
  utilizationPercent: number;
} {
  if (isp.serviceType === 'dedicated') {
    return {
      estimatedThroughputDownMbps: isp.cirDownMbps,
      estimatedThroughputUpMbps: isp.cirUpMbps,
      utilizationPercent: Math.min(100, Math.round((isp.cirDownMbps / isp.bandwidthDownMbps) * 75)),
    };
  }

  // Shared broadband contention model
  const ratioNum = parseInt(isp.contentionRatio.replace('1:', ''), 10) || 4;
  const activeLoadFactor = Math.max(1, isp.activeUsers / ratioNum);
  const fairShareDown = Math.min(
    isp.bandwidthDownMbps,
    Math.max(isp.cirDownMbps, isp.bandwidthDownMbps / activeLoadFactor)
  );
  const fairShareUp = Math.min(
    isp.bandwidthUpMbps,
    Math.max(isp.cirUpMbps, isp.bandwidthUpMbps / activeLoadFactor)
  );

  const util = Math.min(100, Math.round((fairShareDown / isp.bandwidthDownMbps) * 100));

  return {
    estimatedThroughputDownMbps: parseFloat(fairShareDown.toFixed(1)),
    estimatedThroughputUpMbps: parseFloat(fairShareUp.toFixed(1)),
    utilizationPercent: util,
  };
}

// Shortest path graph search between two devices using BFS
export function findPathBetweenDevices(
  startDeviceId: string,
  targetDeviceId: string,
  links: NetworkLink[]
): string[] {
  if (startDeviceId === targetDeviceId) return [];

  // Build adjacency list: deviceId -> { neighborId, linkId }[]
  const adj = new Map<string, { neighborId: string; linkId: string }[]>();
  for (const l of links) {
    if (l.status === 'DIE' || l.status === 'DISABLED') continue;
    if (!adj.has(l.sourceDeviceId)) adj.set(l.sourceDeviceId, []);
    if (!adj.has(l.targetDeviceId)) adj.set(l.targetDeviceId, []);
    adj.get(l.sourceDeviceId)!.push({ neighborId: l.targetDeviceId, linkId: l.id });
    adj.get(l.targetDeviceId)!.push({ neighborId: l.sourceDeviceId, linkId: l.id });
  }

  const queue: { current: string; path: string[] }[] = [{ current: startDeviceId, path: [] }];
  const visited = new Set<string>([startDeviceId]);

  while (queue.length > 0) {
    const { current, path } = queue.shift()!;
    if (current === targetDeviceId) {
      return path;
    }

    const neighbors = adj.get(current) || [];
    for (const { neighborId, linkId } of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ current: neighborId, path: [...path, linkId] });
      }
    }
  }

  return [];
}

// Find closest upstream Gateway/Router from any device
export function findGatewayPath(
  startDeviceId: string,
  devices: NetworkDevice[],
  links: NetworkLink[]
): string[] {
  const router = devices.find((d) => d.category === 'router' || d.category === 'wan');
  if (!router) return [];
  return findPathBetweenDevices(startDeviceId, router.id, links);
}

// Generate realistic simulated live link traffic counters with workload integration
export function generateLinkTrafficStats(
  link: NetworkLink,
  tickSeed: number,
  previousStats?: LinkTrafficStats,
  workloadLoadBps?: { rxBps: number; txBps: number }
): LinkTrafficStats {
  const capacityBps = speedStringToBps(link.speed);

  // If link is dead or disabled, 0 bps
  if (link.status === 'DIE' || link.status === 'DISABLED') {
    return {
      linkId: link.id,
      rxBps: 0,
      txBps: 0,
      rxPps: 0,
      txPps: 0,
      capacityBps,
      utilizationPercent: 0,
      latencyMs: 0,
      packetLossPercent: 100,
      isCongested: false,
      history: previousStats?.history || [],
    };
  }

  // Deterministic realistic stochastic variation
  const hash = link.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const wave = Math.sin((tickSeed + hash) * 0.2);
  const burst = Math.cos((tickSeed * 0.7 + hash) * 0.15) > 0.85 ? 1.35 : 1.0;

  let rxBps = 0;
  let txBps = 0;

  if (workloadLoadBps && (workloadLoadBps.rxBps > 0 || workloadLoadBps.txBps > 0)) {
    // Inject actual workload generated traffic with stochastic factor
    const loadMultiplier = Math.max(0.7, (1 + wave * 0.25) * burst);
    rxBps = Math.round(workloadLoadBps.rxBps * loadMultiplier);
    txBps = Math.round(workloadLoadBps.txBps * loadMultiplier);
  } else {
    // Baseline network background traffic
    const baseUtilPercent = link.isFiber ? 18 + wave * 8 : 8 + wave * 5;
    const clampedUtil = Math.max(1, Math.min(95, baseUtilPercent));
    const currentBps = capacityBps * (clampedUtil / 100);
    rxBps = Math.round(currentBps * 0.58);
    txBps = Math.round(currentBps * 0.42);
  }

  const totalBps = rxBps + txBps;
  const clampedUtil = Math.min(100, Math.round((totalBps / capacityBps) * 100));

  const avgPacketBytes = 850;
  const rxPps = Math.round(rxBps / (avgPacketBytes * 8));
  const txPps = Math.round(txBps / (avgPacketBytes * 8));

  const isCongested = clampedUtil >= 80;
  const packetLossPercent = isCongested ? parseFloat(((clampedUtil - 80) * 0.35).toFixed(1)) : 0;
  const baseLatency = link.isFiber ? 0.35 + (link.cableLengthMeters / 1000) * 0.05 : 0.85;
  const dynamicLatency = parseFloat(
    (baseLatency + (isCongested ? (clampedUtil - 80) * 0.6 : 0)).toFixed(2)
  );

  // Rolling 10 points history
  const timeStr = new Date().toLocaleTimeString();
  const newHistoryPoint = {
    time: timeStr,
    rxMbps: parseFloat((rxBps / 1_000_000).toFixed(1)),
    txMbps: parseFloat((txBps / 1_000_000).toFixed(1)),
    utilPercent: clampedUtil,
  };

  const oldHistory = previousStats?.history || [];
  const updatedHistory = [...oldHistory.slice(-9), newHistoryPoint];

  return {
    linkId: link.id,
    rxBps,
    txBps,
    rxPps,
    txPps,
    capacityBps,
    utilizationPercent: clampedUtil,
    latencyMs: dynamicLatency,
    packetLossPercent,
    isCongested,
    history: updatedHistory,
  };
}

// Master Simulation Runner: executes complete network traffic and ISP capacity evaluation
export function runComprehensiveTrafficSimulation(
  project: NetworkProject,
  tickSeed: number,
  previousStats: Record<string, LinkTrafficStats> = {},
  previousCircuitTelemetry: Record<string, CircuitSimulationTelemetry> = {}
): {
  linkStats: Record<string, LinkTrafficStats>;
  circuitTelemetry: Record<string, CircuitSimulationTelemetry>;
  deviceProcessingMetrics: Record<string, DeviceProcessingCapacityMetrics>;
  summary: WorkloadEngineSummary;
  newCongestionEvents: Omit<NetworkEventLog, 'id' | 'timestamp'>[];
} {
  const links = project.links || [];
  const devices = project.devices || [];
  const workloads = project.workloads || [];
  const circuits = project.circuits || [];
  const providers = project.ispProviders || [];

  const linkLoadAccumulator = new Map<string, { rxBps: number; txBps: number }>();
  for (const l of links) {
    linkLoadAccumulator.set(l.id, { rxBps: 0, txBps: 0 });
  }

  // Track demand per circuit
  const circuitDemandMap = new Map<string, { downKbps: number; upKbps: number }>();
  for (const c of circuits) {
    circuitDemandMap.set(c.id, { downKbps: 0, upKbps: 0 });
  }

  // Find primary and backup circuits
  const primaryCircuit = circuits.find((c) => c.isPrimaryWan && c.status === 'active') || circuits.find((c) => c.status === 'active') || circuits[0];
  const backupCircuit = circuits.find((c) => !c.isPrimaryWan && c.status === 'active');

  let totalActiveUsers = 0;
  let totalGeneratedDownMbps = 0;
  let totalGeneratedUpMbps = 0;

  // 1. Map each active workload to topology paths
  for (const w of workloads) {
    if (!w.enabled) continue;

    const effUsers = Math.max(1, (w.activeUsers || 10) * (w.concurrencyFactor || 0.4));
    totalActiveUsers += Math.round(effUsers);

    const downKbps = w.averageDownloadKbps || 5000;
    const upKbps = w.averageUploadKbps || 1200;

    totalGeneratedDownMbps += downKbps / 1000;
    totalGeneratedUpMbps += upKbps / 1000;

    // Check if any core router has active Mangle rules (PCC / PBR / Packet Marks) and Queues
    const routers = devices.filter((d) => d.category === 'router' && d.routerOsConfig);
    let hasPccLoadBalancing = false;
    let routedToBackupViaPbr = false;
    const activePacketMarks = new Set<string>();

    // Determine target VLAN subnet if workload is scoped to a VLAN
    const workloadVlan = w.targetVlanId ? (project.vlans || []).find((v) => v.id === w.targetVlanId) : undefined;

    for (const r of routers) {
      const mangleRules = (r.routerOsConfig?.firewall?.mangleRules || []).filter(
        (m) => !m.disabled && !m.invalid
      );
      for (const m of mangleRules) {
        if (m.pcc) {
          hasPccLoadBalancing = true;
        }
        // Check if this mangle rule matches the workload's VLAN or general traffic
        const matchesVlanIface =
          workloadVlan &&
          m.inInterface &&
          m.inInterface.toLowerCase().includes(String(workloadVlan.id));
        const matchesSubnet =
          workloadVlan &&
          m.srcAddress &&
          workloadVlan.subnet.split('/')[0].slice(0, 7) === m.srcAddress.split('/')[0].slice(0, 7);
        const isGenericRule = !m.srcAddress && !m.inInterface;

        if (matchesVlanIface || matchesSubnet || isGenericRule) {
          // Increment live Mangle rule packet and byte counters during simulation tick
          const estBytesPerTick = Math.max(640, Math.round(((downKbps + upKbps) * 125) / Math.max(1, mangleRules.length)));
          const estPacketsPerTick = Math.max(1, Math.round(estBytesPerTick / 850));
          m.bytes = (m.bytes || 0) + estBytesPerTick;
          m.packets = (m.packets || 0) + estPacketsPerTick;

          if (m.action === 'mark-packet' && m.newPacketMark) {
            activePacketMarks.add(m.newPacketMark);
          }
          if (m.action === 'mark-routing' && m.newRoutingMark) {
            const markLower = m.newRoutingMark.toLowerCase();
            if (markLower.includes('isp2') || markLower.includes('backup') || markLower.includes('wan2')) {
              routedToBackupViaPbr = true;
            }
          }
        }
      }
    }

    // Route demand to circuits (respecting Mangle PCC / PBR rules)
    if (primaryCircuit) {
      const cur = circuitDemandMap.get(primaryCircuit.id) || { downKbps: 0, upKbps: 0 };
      if (backupCircuit && hasPccLoadBalancing) {
        // PCC Multi-WAN balances load across Primary and Backup WAN circuits
        const bCur = circuitDemandMap.get(backupCircuit.id) || { downKbps: 0, upKbps: 0 };
        circuitDemandMap.set(primaryCircuit.id, {
          downKbps: cur.downKbps + downKbps * 0.5,
          upKbps: cur.upKbps + upKbps * 0.5,
        });
        circuitDemandMap.set(backupCircuit.id, {
          downKbps: bCur.downKbps + downKbps * 0.5,
          upKbps: bCur.upKbps + upKbps * 0.5,
        });
      } else if (backupCircuit && (routedToBackupViaPbr || w.trafficPriority === 'low')) {
        // Policy Based Routing (mark-routing) or low-priority offload to secondary WAN
        const bCur = circuitDemandMap.get(backupCircuit.id) || { downKbps: 0, upKbps: 0 };
        circuitDemandMap.set(backupCircuit.id, {
          downKbps: bCur.downKbps + downKbps,
          upKbps: bCur.upKbps + upKbps,
        });
      } else {
        circuitDemandMap.set(primaryCircuit.id, {
          downKbps: cur.downKbps + downKbps,
          upKbps: cur.upKbps + upKbps,
        });
      }
    }

    // Determine target device IDs for this workload
    let targetDevIds: string[] = [];
    if (w.scope === 'device' && w.targetDeviceId) {
      targetDevIds = [w.targetDeviceId];
    } else if (w.scope === 'group' && w.targetDeviceIds && w.targetDeviceIds.length > 0) {
      targetDevIds = w.targetDeviceIds;
    } else if (w.scope === 'vlan' && w.targetVlanId) {
      // Find devices participating in this VLAN
      for (const d of devices) {
        const inVlan = d.interfaces.some(
          (i) => i.pvid === w.targetVlanId || (i.taggedVlans && i.taggedVlans.includes(w.targetVlanId!))
        );
        if (inVlan) targetDevIds.push(d.id);
      }
    }

    if (targetDevIds.length === 0) {
      // Default to any client endpoint or first device
      const ep = devices.find((d) => d.category === 'endpoint');
      if (ep) targetDevIds = [ep.id];
      else if (devices[0]) targetDevIds = [devices[0].id];
    }

    // Distribute demand across target devices (with RouterOS Simple Queue & Queue Tree enforcement)
    let perDevDownBps = (downKbps * 1000) / Math.max(1, targetDevIds.length);
    let perDevUpBps = (upKbps * 1000) / Math.max(1, targetDevIds.length);

    // Check if any core router has an active RouterOS Simple Queue (/queue simple) or Queue Tree (/queue tree) capping bandwidth
    for (const r of routers) {
      const activeQueues = (r.routerOsConfig?.queues || []).filter((q) => !q.disabled);
      for (const q of activeQueues) {
        if (q.packetMarks && !activePacketMarks.has(q.packetMarks)) continue;
        if (q.maxLimitDownloadBps > 0 && perDevDownBps > q.maxLimitDownloadBps) {
          perDevDownBps = q.maxLimitDownloadBps;
        }
        if (q.maxLimitUploadBps > 0 && perDevUpBps > q.maxLimitUploadBps) {
          perDevUpBps = q.maxLimitUploadBps;
        }
      }

      const activeQueueTrees = (r.routerOsConfig?.queueTree || []).filter((qt) => !qt.disabled);
      for (const qt of activeQueueTrees) {
        if (qt.packetMark && !activePacketMarks.has(qt.packetMark)) continue;
        if (qt.maxLimitBps > 0 && perDevDownBps > qt.maxLimitBps) {
          perDevDownBps = qt.maxLimitBps;
        }
      }
    }

    // For each device, find path to gateway router
    for (const devId of targetDevIds) {
      const pathLinkIds = findGatewayPath(devId, devices, links);
      for (const lid of pathLinkIds) {
        const cur = linkLoadAccumulator.get(lid);
        if (cur) {
          cur.rxBps += perDevDownBps;
          cur.txBps += perDevUpBps;
        }
      }
    }
  }

  // 2. Generate Link Traffic Stats
  const nextLinkStats: Record<string, LinkTrafficStats> = {};
  const events: Omit<NetworkEventLog, 'id' | 'timestamp'>[] = [];

  for (const link of links) {
    const prev = previousStats[link.id];
    const workloadBps = linkLoadAccumulator.get(link.id);
    const updated = generateLinkTrafficStats(link, tickSeed, prev, workloadBps);
    nextLinkStats[link.id] = updated;

    if (updated.isCongested && (!prev || !prev.isCongested)) {
      events.push({
        type: 'congestion',
        severity: 'warning',
        title: 'Interface Link Congestion Alert',
        message: `Link ${link.id} reached ${updated.utilizationPercent}% utilization (${(updated.rxBps / 1_000_000).toFixed(1)} Mbps Rx, ${(updated.txBps / 1_000_000).toFixed(1)} Mbps Tx).`,
        targetId: link.id,
      });
    }
  }

  // 3. Compute Circuit Simulation Telemetry
  const nextCircuitTelemetry: Record<string, CircuitSimulationTelemetry> = {};
  let totalDeliveredDownMbps = 0;
  let totalDeliveredUpMbps = 0;
  let totalDroppedDownMbps = 0;
  let totalDroppedUpMbps = 0;
  let cirWarningsCount = 0;
  let slaWarningsCount = 0;

  for (const c of circuits) {
    const prov = providers.find((p) => p.id === c.ispProviderId);
    const demand = circuitDemandMap.get(c.id) || { downKbps: 0, upKbps: 0 };

    const demandDownMbps = Math.round((demand.downKbps / 1000) * 10) / 10;
    const demandUpMbps = Math.round((demand.upKbps / 1000) * 10) / 10;

    const capDownMbps = toMbps(c.downloadBandwidth, c.downloadUnit);
    const capUpMbps = toMbps(c.uploadBandwidth, c.uploadUnit);

    const cirDownMbps = c.downloadCir ? toMbps(c.downloadCir, c.downloadCirUnit) : capDownMbps;
    const cirUpMbps = c.uploadCir ? toMbps(c.uploadCir, c.uploadCirUnit) : capUpMbps;

    // Calculate delivered vs dropped
    const deliveredDownMbps = Math.min(demandDownMbps, capDownMbps);
    const deliveredUpMbps = Math.min(demandUpMbps, capUpMbps);

    const droppedDownMbps = Math.max(0, demandDownMbps - capDownMbps);
    const droppedUpMbps = Math.max(0, demandUpMbps - capUpMbps);

    totalDeliveredDownMbps += deliveredDownMbps;
    totalDeliveredUpMbps += deliveredUpMbps;
    totalDroppedDownMbps += droppedDownMbps;
    totalDroppedUpMbps += droppedUpMbps;

    const utilDown = capDownMbps > 0 ? Math.min(100, Math.round((deliveredDownMbps / capDownMbps) * 100)) : 0;
    const utilUp = capUpMbps > 0 ? Math.min(100, Math.round((deliveredUpMbps / capUpMbps) * 100)) : 0;

    const cirUtilDown = cirDownMbps > 0 ? Math.min(150, Math.round((deliveredDownMbps / cirDownMbps) * 100)) : 0;
    const cirUtilUp = cirUpMbps > 0 ? Math.min(150, Math.round((deliveredUpMbps / cirUpMbps) * 100)) : 0;

    const isCongested = utilDown >= 85 || utilUp >= 85 || droppedDownMbps > 0;
    const isCirViolated = cirUtilDown > 100 || (droppedDownMbps > 0 && deliveredDownMbps < cirDownMbps);

    if (isCirViolated) cirWarningsCount++;

    // Realistic dynamic latency and jitter bufferbloat model
    const baseLatency = c.latencyMs || (c.serviceType === 'satellite' ? 32 : 5.5);
    const bufferbloatDelay = isCongested ? (Math.max(utilDown, utilUp) - 80) * 1.8 + (droppedDownMbps > 0 ? 35 : 0) : 0;
    const dynamicLatency = Math.round((baseLatency + bufferbloatDelay) * 10) / 10;

    const baseJitter = c.jitterMs || (c.serviceType === 'satellite' ? 5.8 : 1.2);
    const dynamicJitter = Math.round((baseJitter + (isCongested ? 4.5 : 0)) * 10) / 10;

    const packetLossPercent = droppedDownMbps > 0 && demandDownMbps > 0
      ? Math.round((droppedDownMbps / demandDownMbps) * 1000) / 10
      : 0;

    const isSlaViolated = (c.slaPercent && packetLossPercent > 1.0) || (dynamicLatency > 80);
    if (isSlaViolated) slaWarningsCount++;

    // History
    const timeStr = new Date().toLocaleTimeString();
    const prevTelem = previousCircuitTelemetry[c.id];
    const prevHistory = prevTelem?.history || [];
    const newHistory = [
      ...prevHistory.slice(-9),
      {
        time: timeStr,
        downMbps: deliveredDownMbps,
        upMbps: deliveredUpMbps,
        utilPercent: Math.max(utilDown, utilUp),
      },
    ];

    nextCircuitTelemetry[c.id] = {
      circuitId: c.id,
      circuitName: c.circuitName,
      ispProviderName: prov?.name || 'Internet Gateway',
      isPrimaryWan: c.isPrimaryWan,
      demandDownMbps,
      demandUpMbps,
      deliveredDownMbps,
      deliveredUpMbps,
      droppedDownMbps,
      droppedUpMbps,
      utilizationDownPercent: utilDown,
      utilizationUpPercent: utilUp,
      cirUtilizationDownPercent: cirUtilDown,
      cirUtilizationUpPercent: cirUtilUp,
      queueLengthPackets: isCongested ? Math.round(droppedDownMbps * 120) : 0,
      latencyMs: dynamicLatency,
      jitterMs: dynamicJitter,
      packetLossPercent,
      isCongested,
      isCirViolated,
      isSlaViolated,
      history: newHistory,
    };

    // Congestion & Saturation Event Emission
    if (droppedDownMbps > 0 && (!prevTelem || prevTelem.droppedDownMbps === 0)) {
      events.push({
        type: 'congestion',
        severity: 'error',
        title: `WAN Uplink Saturated (${c.circuitName})`,
        message: `Circuit '${c.circuitName}' is dropping ${droppedDownMbps.toFixed(1)} Mbps due to demand exceeding circuit capacity (${capDownMbps} Mbps).`,
        targetId: c.id,
      });
    }
  }

  // 4. Compute Device Processing Capacity Metrics
  const nextDeviceMetrics: Record<string, DeviceProcessingCapacityMetrics> = {};
  for (const dev of devices) {
    // Sum throughput through all device links
    let devThroughputBps = 0;
    for (const l of links) {
      if (l.sourceDeviceId === dev.id || l.targetDeviceId === dev.id) {
        const stats = nextLinkStats[l.id];
        if (stats) {
          devThroughputBps += stats.rxBps + stats.txBps;
        }
      }
    }

    const currentThroughputMbps = Math.round((devThroughputBps / 1_000_000) * 10) / 10;
    const isRouter = dev.category === 'router' || dev.category === 'wan';
    const isSwitch = dev.category === 'switch';

    const switchingCapacityGbps = isSwitch ? 64 : isRouter ? 24 : 10;
    const routingThroughputMbps = isRouter ? 4500 : 1000;
    const forwardingRateMpps = isSwitch ? 45 : 12;

    // CPU estimation (including RouterOS Firewall Filter, NAT, Mangle & Simple Queue/Queue Tree processing overhead)
    const activeFilterCount = (dev.routerOsConfig?.firewall?.filterRules || []).filter((r) => !r.disabled).length;
    const activeNatCount = (dev.routerOsConfig?.firewall?.natRules || []).filter((r) => !r.disabled).length;
    const activeMangleCount = (dev.routerOsConfig?.firewall?.mangleRules || []).filter((r) => !r.disabled).length;
    const activeQueueCount =
      (dev.routerOsConfig?.queues || []).filter((q) => !q.disabled).length +
      (dev.routerOsConfig?.queueTree || []).filter((qt) => !qt.disabled).length;
    const rosRuleCpuOverhead = isRouter
      ? activeFilterCount * 1.2 + activeNatCount * 1.5 + activeMangleCount * 1.4 + activeQueueCount * 2.5
      : 0;

    const baseCpu = isRouter ? 10 : 5;
    const loadFactor = isRouter
      ? (currentThroughputMbps / routingThroughputMbps) * 80
      : (currentThroughputMbps / (switchingCapacityGbps * 1000)) * 50;

    const cpuLoad = Math.min(100, Math.round(baseCpu + loadFactor + rosRuleCpuOverhead));
    const ramUsage = Math.min(95, Math.round(35 + cpuLoad * 0.4));

    const isBottleneck = cpuLoad >= 88;

    nextDeviceMetrics[dev.id] = {
      deviceId: dev.id,
      deviceName: dev.name,
      category: dev.category,
      switchingCapacityGbps,
      forwardingRateMpps,
      routingThroughputMbps,
      currentThroughputMbps,
      cpuLoadPercent: cpuLoad,
      ramUsagePercent: ramUsage,
      status: dev.status,
      isBottleneck,
      bottleneckReason: isBottleneck
        ? `CPU load reached ${cpuLoad}% under ${currentThroughputMbps} Mbps routing load.`
        : undefined,
    };

    if (isBottleneck) {
      events.push({
        type: 'device_state',
        severity: 'warning',
        title: `Router CPU Bottleneck (${dev.name})`,
        message: `${dev.name} reached ${cpuLoad}% CPU utilization under ${currentThroughputMbps} Mbps aggregate throughput.`,
        targetId: dev.id,
      });
    }
  }

  // 5. Workload Engine Summary
  let mostUtilizedWan: { circuitId: string; name: string; utilPercent: number } | undefined;
  for (const tel of Object.values(nextCircuitTelemetry)) {
    const util = Math.max(tel.utilizationDownPercent, tel.utilizationUpPercent);
    if (!mostUtilizedWan || util > mostUtilizedWan.utilPercent) {
      mostUtilizedWan = { circuitId: tel.circuitId, name: tel.circuitName, utilPercent: util };
    }
  }

  let mostUtilizedLink: { linkId: string; utilPercent: number } | undefined;
  for (const stats of Object.values(nextLinkStats)) {
    if (!mostUtilizedLink || stats.utilizationPercent > mostUtilizedLink.utilPercent) {
      mostUtilizedLink = { linkId: stats.linkId, utilPercent: stats.utilizationPercent };
    }
  }

  let mostUtilizedDevice: { deviceId: string; name: string; cpuLoad: number } | undefined;
  for (const dm of Object.values(nextDeviceMetrics)) {
    if (!mostUtilizedDevice || dm.cpuLoadPercent > mostUtilizedDevice.cpuLoad) {
      mostUtilizedDevice = { deviceId: dm.deviceId, name: dm.deviceName, cpuLoad: dm.cpuLoadPercent };
    }
  }

  const summary: WorkloadEngineSummary = {
    totalActiveDevices: devices.filter((d) => d.status === 'RUN').length,
    totalActiveUsers,
    totalGeneratedDownMbps: Math.round(totalGeneratedDownMbps * 10) / 10,
    totalGeneratedUpMbps: Math.round(totalGeneratedUpMbps * 10) / 10,
    totalDeliveredDownMbps: Math.round(totalDeliveredDownMbps * 10) / 10,
    totalDeliveredUpMbps: Math.round(totalDeliveredUpMbps * 10) / 10,
    totalDroppedDownMbps: Math.round(totalDroppedDownMbps * 10) / 10,
    totalDroppedUpMbps: Math.round(totalDroppedUpMbps * 10) / 10,
    peakTrafficMbps: Math.round((totalGeneratedDownMbps + totalGeneratedUpMbps) * 1.35 * 10) / 10,
    mostUtilizedWan,
    mostUtilizedLink,
    mostUtilizedDevice,
    congestedVlans: [],
    cirWarningsCount,
    slaWarningsCount,
  };

  return {
    linkStats: nextLinkStats,
    circuitTelemetry: nextCircuitTelemetry,
    deviceProcessingMetrics: nextDeviceMetrics,
    summary,
    newCongestionEvents: events,
  };
}

// Generate default ISP profiles for projects
export function createDefaultIspProfiles(): IspService[] {
  return [
    {
      id: 'isp-telkom-dia',
      providerName: 'Telkom Metro-E (Dedicated)',
      serviceType: 'dedicated',
      bandwidthDownMbps: 300,
      bandwidthUpMbps: 300,
      cirDownMbps: 300,
      cirUpMbps: 300,
      contentionRatio: '1:1',
      activeUsers: 1,
      baseLatencyMs: 4.2,
      jitterMs: 0.8,
      packetLossPercent: 0,
      publicIp: '103.144.20.2',
      isPrimaryWan: true,
      status: 'RUN',
    },
    {
      id: 'isp-starlink-backup',
      providerName: 'Starlink LEO Satellite (Backup)',
      serviceType: 'shared',
      bandwidthDownMbps: 220,
      bandwidthUpMbps: 25,
      cirDownMbps: 50,
      cirUpMbps: 10,
      contentionRatio: '1:4',
      activeUsers: 4,
      baseLatencyMs: 28.5,
      jitterMs: 5.2,
      packetLossPercent: 0.2,
      publicIp: '170.203.8.45',
      isPrimaryWan: false,
      status: 'RUN',
    },
  ];
}
