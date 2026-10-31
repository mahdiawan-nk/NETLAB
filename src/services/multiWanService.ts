import { NetworkDevice, NetworkProject } from '../types/network';
import {
  HybridPolicyRule,
  LoadBalancingMethod,
  MangleRule,
  MultiWanConfigState,
  MultiWanEventLog,
  MultiWanInterfaceConfig,
  MultiWanSimulationScenarioId,
  MultiWanTemplateType,
  RouterOsAddressListEntry,
  RouterOsBackupSnapshot,
  RouterOsDeviceConfig,
  RouterOsFirewallNatRule,
  RouterOsIpAddress,
  RouterOsRoute,
  RouterOsRoutingTable,
  RouterOsVersion,
  WanOperationalState,
} from '../types/routerOs';
import { RouterOsConfigService, MutationResult } from './routerOsConfigService';
import { parseIPv4Cidr } from './validationEngine';

export const MWAN_TAG = '[MWAN]';

export interface MultiWanSamplePreset {
  id: string;
  title: string;
  category: MultiWanTemplateType;
  badge: string;
  description: string;
  wanCount: number;
  recommendedFor: string;
  buildState: (device: NetworkDevice) => MultiWanConfigState;
}

export interface MultiWanValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category:
    | 'interface'
    | 'gateway'
    | 'ip-subnet'
    | 'routing-table'
    | 'mangle'
    | 'nat'
    | 'policy-conflict'
    | 'version-compat'
    | 'duplicate-rule'
    | 'routing-loop'
    | 'no-backup-path';
  title: string;
  message: string;
  remediation?: string;
}

export interface MultiWanGeneratedArtifacts {
  version: RouterOsVersion;
  ipAddresses: RouterOsIpAddress[];
  routingTables: RouterOsRoutingTable[];
  routes: RouterOsRoute[];
  addressLists: RouterOsAddressListEntry[];
  mangleRules: MangleRule[];
  natRules: RouterOsFirewallNatRule[];
  interfaceComments: Record<string, string>;
  cliScript: string;
}

export interface MultiWanDryRunPreview {
  valid: boolean;
  issues: MultiWanValidationIssue[];
  summary: {
    addedRoutes: number;
    removedMwanRoutes: number;
    addedMangleRules: number;
    removedMwanMangleRules: number;
    addedNatRules: number;
    addedRoutingTables: number;
    preservedCustomRules: number;
  };
  diffLines: Array<{ type: 'same' | 'added' | 'removed'; line: string }>;
  generatedScript: string;
}

export interface WanTelemetryMetrics {
  wanId: string;
  wanName: string;
  physicalInterface: string;
  ispProviderName: string;
  role: string;
  operationalStatus: WanOperationalState;
  linkState: 'UP' | 'DOWN';
  gatewayState: 'REACHABLE' | 'UNREACHABLE';
  internetState: 'ONLINE' | 'OFFLINE';
  serviceState: 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE';
  isActiveRoute: boolean;
  downloadCapacityMbps: number;
  uploadCapacityMbps: number;
  cirMbps: number;
  currentDownloadMbps: number;
  currentUploadMbps: number;
  utilizationDownPercent: number;
  utilizationUpPercent: number;
  activeConnections: number;
  packetSharePercent: number;
  effectiveLatencyMs: number;
  effectiveJitterMs: number;
  effectivePacketLossPercent: number;
  weightRatio: number;
  pccMatchers: string[];
  statusReason: string;
}

export interface MultiWanDashboardTelemetry {
  wans: WanTelemetryMetrics[];
  totalCapacityDownMbps: number;
  totalCapacityUpMbps: number;
  totalThroughputDownMbps: number;
  totalThroughputUpMbps: number;
  totalActiveConnections: number;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'FAILOVER_ACTIVE' | 'OUTAGE';
  activeRouteSummary: string;
  weightedRatioSummary: string;
}

// ==========================================
// HELPER: GCD & WEIGHTED PCC RATIO CALCULATOR
// ==========================================

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function calculateWeightedPccRatios(
  wans: MultiWanInterfaceConfig[],
  useAutoBandwidth: boolean
): {
  ratios: Record<string, number>;
  totalStreams: number;
  bucketsByWanId: Record<string, string[]>;
  classifierName: string;
  ratioLabel: string;
} {
  if (wans.length === 0) {
    return {
      ratios: {},
      totalStreams: 0,
      bucketsByWanId: {},
      classifierName: 'both-addresses-and-ports',
      ratioLabel: '0',
    };
  }

  let rawWeights = wans.map((w) => {
    if (!useAutoBandwidth && w.manualWeight && w.manualWeight > 0) {
      return Math.max(1, Math.round(w.manualWeight));
    }
    return Math.max(1, Math.round(w.downloadMbps || 100));
  });

  // Compute GCD across all weights
  let divisor = rawWeights[0];
  for (let i = 1; i < rawWeights.length; i++) {
    divisor = gcd(divisor, rawWeights[i]);
  }

  let normalized = rawWeights.map((v) => Math.max(1, Math.round(v / divisor)));

  // Cap total PCC streams at 16 so Mangle table stays clean and practical
  const sum = normalized.reduce((a, b) => a + b, 0);
  if (sum > 16) {
    const scale = sum / 12;
    normalized = normalized.map((v) => Math.max(1, Math.round(v / scale)));
    let d2 = normalized[0];
    for (let i = 1; i < normalized.length; i++) {
      d2 = gcd(d2, normalized[i]);
    }
    normalized = normalized.map((v) => Math.max(1, Math.round(v / d2)));
  }

  const totalStreams = normalized.reduce((a, b) => a + b, 0);
  const ratios: Record<string, number> = {};
  const bucketsByWanId: Record<string, string[]> = {};

  let streamCursor = 0;
  wans.forEach((w, idx) => {
    const count = normalized[idx];
    ratios[w.id] = count;
    bucketsByWanId[w.id] = [];
    for (let r = 0; r < count; r++) {
      bucketsByWanId[w.id].push(`${totalStreams}/${streamCursor}`);
      streamCursor++;
    }
  });

  return {
    ratios,
    totalStreams,
    bucketsByWanId,
    classifierName: 'both-addresses-and-ports',
    ratioLabel: normalized.join(' : '),
  };
}

// ==========================================
// HELPER: CREATE DEFAULT WAN INTERFACES DYNAMICALLY
// ==========================================

const ISP_PRESET_POOL = [
  {
    provider: 'Biznet Dedicated Fiber',
    ip: '203.142.80.2/30',
    gw: '203.142.80.1',
    down: 300,
    up: 300,
    cir: 300,
    ratio: '1:1',
    lat: 4,
    jit: 1,
    target: '8.8.8.8',
    type: 'static' as const,
  },
  {
    provider: 'IndiHome Broadband Pro',
    ip: '180.252.110.14/24',
    gw: '180.252.110.1',
    down: 200,
    up: 100,
    cir: 50,
    ratio: '1:4',
    lat: 12,
    jit: 3,
    target: '1.1.1.1',
    type: 'pppoe' as const,
  },
  {
    provider: 'FirstMedia Corporate',
    ip: '114.79.32.18/29',
    gw: '114.79.32.17',
    down: 100,
    up: 100,
    cir: 50,
    ratio: '1:2',
    lat: 9,
    jit: 2,
    target: '9.9.9.9',
    type: 'dhcp' as const,
  },
  {
    provider: 'Starlink Business LEO',
    ip: '100.64.10.25/24',
    gw: '100.64.10.1',
    down: 220,
    up: 35,
    cir: 40,
    ratio: '1:8',
    lat: 38,
    jit: 9,
    target: '208.67.222.222',
    type: 'dhcp' as const,
  },
  {
    provider: 'Telkomsel Enterprise Metro-E',
    ip: '36.88.14.2/30',
    gw: '36.88.14.1',
    down: 500,
    up: 500,
    cir: 500,
    ratio: '1:1',
    lat: 3,
    jit: 1,
    target: '8.8.4.4',
    type: 'static' as const,
  },
];

export function buildWanEntry(
  index: number,
  physicalInterface: string,
  overrides?: Partial<MultiWanInterfaceConfig>
): MultiWanInterfaceConfig {
  const preset = ISP_PRESET_POOL[index % ISP_PRESET_POOL.length];
  const role = index === 0 ? 'primary' : index === 1 ? 'secondary' : 'backup';
  return {
    id: `wan-${index + 1}`,
    name: `WAN${index + 1}`,
    physicalInterface,
    ispProviderName: preset.provider,
    connectionType: preset.type,
    ipAddress: preset.ip,
    gateway: preset.gw,
    pppoeUsername: preset.type === 'pppoe' ? `corp_wan${index + 1}@isp.id` : undefined,
    pppoePassword: preset.type === 'pppoe' ? 'secret123' : undefined,
    downloadMbps: preset.down,
    uploadMbps: preset.up,
    cirMbps: preset.cir,
    contentionRatio: preset.ratio,
    latencyMs: preset.lat,
    jitterMs: preset.jit,
    packetLossPercent: 0,
    role,
    priority: index + 1,
    distance: index + 1,
    manualWeight: index === 0 ? 3 : index === 1 ? 2 : 1,
    healthCheckMethod: 'recursive-route',
    healthCheckTarget: preset.target,
    checkIntervalSec: 10,
    failThreshold: 3,
    recoveryThreshold: 3,
    linkState: 'UP',
    gatewayState: 'REACHABLE',
    internetState: 'ONLINE',
    serviceState: 'AVAILABLE',
    operationalStatus: 'UP',
    isOverloaded: false,
    ...overrides,
  };
}

export function getAvailablePhysicalInterfaces(device: NetworkDevice): string[] {
  const names = device.interfaces.map((i) => i.name);
  return names.length > 0 ? names : ['ether1', 'ether2', 'ether3', 'ether4', 'ether5'];
}

// ==========================================
// 10 SAMPLE CONFIGURATION LIBRARY PRESETS
// ==========================================

export const SAMPLE_MULTIWAN_TEMPLATES: MultiWanSamplePreset[] = [
  {
    id: 'two-wan-failover',
    title: '1. Two WAN Failover',
    category: 'failover',
    badge: 'Failover • 2 WAN',
    description:
      'Konfigurasi klasik Primary + Backup WAN dengan Recursive Route Health Check (8.8.8.8 & 1.1.1.1) dan automatic route recovery.',
    wanCount: 2,
    recommendedFor: 'Small Office / Branch Router dengan 1 ISP Dedicated + 1 ISP Broadband Backup',
    buildState: (device) => {
      const ifaces = getAvailablePhysicalInterfaces(device);
      const w1 = buildWanEntry(0, ifaces[0] || 'ether1', {
        role: 'primary',
        priority: 1,
        distance: 1,
        healthCheckMethod: 'recursive-route',
        healthCheckTarget: '8.8.8.8',
      });
      const w2 = buildWanEntry(1, ifaces[1] || 'ether2', {
        role: 'backup',
        priority: 2,
        distance: 2,
        healthCheckMethod: 'recursive-route',
        healthCheckTarget: '1.1.1.1',
      });
      return createBaseMultiWanState('failover', [w1, w2], {
        selectedPresetId: 'two-wan-failover',
        failoverCheckMethod: 'recursive-route',
      });
    },
  },
  {
    id: 'three-wan-failover',
    title: '2. Three WAN Failover',
    category: 'failover',
    badge: 'Failover • 3 WAN',
    description:
      'Redundansi bertingkat 3 ISP: Primary (Distance 1) → Secondary (Distance 2) → Tertiary Backup (Distance 3) dengan deteksi recursive host.',
    wanCount: 3,
    recommendedFor: 'Enterprise Branch / Kampus dengan 3 link ISP independen',
    buildState: (device) => {
      const ifaces = getAvailablePhysicalInterfaces(device);
      const wans = [
        buildWanEntry(0, ifaces[0] || 'ether1', { role: 'primary', priority: 1, distance: 1 }),
        buildWanEntry(1, ifaces[1] || 'ether2', { role: 'secondary', priority: 2, distance: 2 }),
        buildWanEntry(2, ifaces[2] || 'ether3', { role: 'backup', priority: 3, distance: 3 }),
      ];
      return createBaseMultiWanState('failover', wans, {
        selectedPresetId: 'three-wan-failover',
        failoverCheckMethod: 'recursive-route',
      });
    },
  },
  {
    id: 'four-wan-failover',
    title: '3. Four WAN Failover',
    category: 'failover',
    badge: 'Failover • 4 WAN',
    description:
      'High-Availability 4 WAN (Fiber Dedicated, Broadband, Cable, dan LEO Satellite Starlink sebagai last-resort backup Distance 4).',
    wanCount: 4,
    recommendedFor: 'Mission-Critical Headquarters / Data Center Edge',
    buildState: (device) => {
      const ifaces = getAvailablePhysicalInterfaces(device);
      const wans = [
        buildWanEntry(0, ifaces[0] || 'ether1', { role: 'primary', priority: 1, distance: 1 }),
        buildWanEntry(1, ifaces[1] || 'ether2', { role: 'secondary', priority: 2, distance: 2 }),
        buildWanEntry(2, ifaces[2] || 'ether3', { role: 'backup', priority: 3, distance: 3 }),
        buildWanEntry(3, ifaces[3] || 'ether4', { role: 'backup', priority: 4, distance: 4 }),
      ];
      return createBaseMultiWanState('failover', wans, {
        selectedPresetId: 'four-wan-failover',
        failoverCheckMethod: 'recursive-route',
      });
    },
  },
  {
    id: 'two-wan-pcc',
    title: '4. Two WAN PCC',
    category: 'load-balancing',
    badge: 'PCC • 2 WAN (1:1)',
    description:
      'Per Connection Classifier (both-addresses-and-ports 2/0 & 2/1) untuk membagi koneksi secara seimbang di antara 2 WAN dengan sticky session.',
    wanCount: 2,
    recommendedFor: 'Dual ISP simetris untuk meningkatkan kapasitas agregat multi-koneksi',
    buildState: (device) => {
      const ifaces = getAvailablePhysicalInterfaces(device);
      const wans = [
        buildWanEntry(0, ifaces[0] || 'ether1', { downloadMbps: 200, uploadMbps: 200, manualWeight: 1 }),
        buildWanEntry(1, ifaces[1] || 'ether2', { downloadMbps: 200, uploadMbps: 200, manualWeight: 1 }),
      ];
      return createBaseMultiWanState('load-balancing', wans, {
        selectedPresetId: 'two-wan-pcc',
        loadBalancingMethod: 'pcc-both-addresses-and-ports',
        useAutoBandwidthWeight: false,
      });
    },
  },
  {
    id: 'three-wan-pcc',
    title: '5. Three WAN PCC',
    category: 'load-balancing',
    badge: 'PCC • 3 WAN (1:1:1)',
    description:
      'Distribusi beban PCC 3 arah (3/0, 3/1, 3/2) menggunakan classifier both-addresses untuk menjaga konsistensi sesi HTTPS/Banking.',
    wanCount: 3,
    recommendedFor: 'Kantor menengah / Co-working space dengan 3 jalur ISP setara',
    buildState: (device) => {
      const ifaces = getAvailablePhysicalInterfaces(device);
      const wans = [
        buildWanEntry(0, ifaces[0] || 'ether1', { downloadMbps: 200, uploadMbps: 200, manualWeight: 1 }),
        buildWanEntry(1, ifaces[1] || 'ether2', { downloadMbps: 200, uploadMbps: 200, manualWeight: 1 }),
        buildWanEntry(2, ifaces[2] || 'ether3', { downloadMbps: 200, uploadMbps: 200, manualWeight: 1 }),
      ];
      return createBaseMultiWanState('load-balancing', wans, {
        selectedPresetId: 'three-wan-pcc',
        loadBalancingMethod: 'pcc-both-addresses',
        useAutoBandwidthWeight: false,
      });
    },
  },
  {
    id: 'three-wan-weighted-pcc',
    title: '6. Three WAN Weighted PCC',
    category: 'load-balancing',
    badge: 'Weighted PCC • 3:2:1',
    description:
      'Weighted PCC proporsional otomatis berdasarkan rasio bandwidth (WAN1 300 Mbps, WAN2 200 Mbps, WAN3 100 Mbps → Rasio 3:2:1 = 6 bucket PCC).',
    wanCount: 3,
    recommendedFor: 'Multi-ISP dengan kapasitas bandwidth asimetris (300M + 200M + 100M)',
    buildState: (device) => {
      const ifaces = getAvailablePhysicalInterfaces(device);
      const wans = [
        buildWanEntry(0, ifaces[0] || 'ether1', { downloadMbps: 300, uploadMbps: 300, manualWeight: 3 }),
        buildWanEntry(1, ifaces[1] || 'ether2', { downloadMbps: 200, uploadMbps: 100, manualWeight: 2 }),
        buildWanEntry(2, ifaces[2] || 'ether3', { downloadMbps: 100, uploadMbps: 50, manualWeight: 1 }),
      ];
      return createBaseMultiWanState('load-balancing', wans, {
        selectedPresetId: 'three-wan-weighted-pcc',
        loadBalancingMethod: 'weighted-pcc',
        useAutoBandwidthWeight: true,
      });
    },
  },
  {
    id: 'vlan-based-multi-wan',
    title: '7. VLAN Based Multi-WAN',
    category: 'hybrid',
    badge: 'PBR • Per-VLAN',
    description:
      'Policy-Based Routing berbasis segmen VLAN: VLAN 10 (Server/Admin) → WAN1 Dedicated; VLAN 20 (Staff) → WAN2; VLAN 30 (Guest) → WAN3.',
    wanCount: 3,
    recommendedFor: 'Jaringan tersegmentasi VLAN yang membutuhkan pemisahan jalur ISP',
    buildState: (device) => {
      const ifaces = getAvailablePhysicalInterfaces(device);
      const wans = [
        buildWanEntry(0, ifaces[0] || 'ether1', { role: 'primary', priority: 1, distance: 1 }),
        buildWanEntry(1, ifaces[1] || 'ether2', { role: 'secondary', priority: 2, distance: 2 }),
        buildWanEntry(2, ifaces[2] || 'ether3', { role: 'backup', priority: 3, distance: 3 }),
      ];
      const policies: HybridPolicyRule[] = [
        {
          id: 'pol-vlan10',
          name: 'VLAN 10 Server & Admin -> WAN1 Primary (Backup WAN2)',
          priority: 1,
          enabled: true,
          policyType: 'vlan',
          inInterfaceOrVlan: 'vlan10',
          srcAddress: '10.10.10.0/24',
          routingMode: 'failover',
          preferredWanIds: ['wan-1'],
          backupWanIds: ['wan-2', 'wan-3'],
          comment: 'Critical servers via low-latency Dedicated WAN1',
        },
        {
          id: 'pol-vlan20',
          name: 'VLAN 20 Operational Staff -> WAN2 Primary (Backup WAN1)',
          priority: 2,
          enabled: true,
          policyType: 'vlan',
          inInterfaceOrVlan: 'vlan20',
          srcAddress: '10.10.20.0/24',
          routingMode: 'failover',
          preferredWanIds: ['wan-2'],
          backupWanIds: ['wan-1', 'wan-3'],
          comment: 'Staff subnet via WAN2 with WAN1 failover',
        },
        {
          id: 'pol-vlan30',
          name: 'VLAN 30 Public Wi-Fi -> WAN3 (Backup WAN2)',
          priority: 3,
          enabled: true,
          policyType: 'vlan',
          inInterfaceOrVlan: 'vlan30',
          srcAddress: '10.10.30.0/24',
          routingMode: 'failover',
          preferredWanIds: ['wan-3'],
          backupWanIds: ['wan-2'],
          comment: 'Isolate guest traffic on WAN3 broadband',
        },
      ];
      return createBaseMultiWanState('hybrid', wans, {
        selectedPresetId: 'vlan-based-multi-wan',
        hybridPolicies: policies,
      });
    },
  },
  {
    id: 'pcc-plus-failover',
    title: '8. PCC + Failover',
    category: 'load-balancing',
    badge: 'PCC + Hot Standby',
    description:
      'Load Balancing PCC aktif pada WAN1 & WAN2 dengan automatic failover ke WAN3 Backup apabila salah satu atau kedua link utama terputus.',
    wanCount: 3,
    recommendedFor: 'Perusahaan dengan 2 link produksi aktif + 1 link backup siaga',
    buildState: (device) => {
      const ifaces = getAvailablePhysicalInterfaces(device);
      const wans = [
        buildWanEntry(0, ifaces[0] || 'ether1', { role: 'primary', priority: 1, distance: 1, downloadMbps: 250 }),
        buildWanEntry(1, ifaces[1] || 'ether2', { role: 'secondary', priority: 2, distance: 2, downloadMbps: 250 }),
        buildWanEntry(2, ifaces[2] || 'ether3', { role: 'backup', priority: 3, distance: 3, downloadMbps: 100 }),
      ];
      return createBaseMultiWanState('load-balancing', wans, {
        selectedPresetId: 'pcc-plus-failover',
        loadBalancingMethod: 'pcc-both-addresses-and-ports',
        autoFailoverUnhealthyWan: true,
      });
    },
  },
  {
    id: 'hybrid-campus-network',
    title: '9. Hybrid Campus Network',
    category: 'hybrid',
    badge: 'Hybrid • Campus',
    description:
      'Skenario Kampus: VLAN 20 (Dosen/Rektorat) → WAN1 Primary + WAN2 Backup; VLAN 40 (Lab & Kelas) → Weighted PCC WAN1+WAN2 + WAN3 Backup; Trafik Zoom/VoIP → WAN1.',
    wanCount: 3,
    recommendedFor: 'Universitas / Politeknik / Sekolah dengan multi-segmen akademik',
    buildState: (device) => {
      const ifaces = getAvailablePhysicalInterfaces(device);
      const wans = [
        buildWanEntry(0, ifaces[0] || 'ether1', {
          ispProviderName: 'Biznet Dedicated Academic',
          downloadMbps: 300,
          uploadMbps: 300,
          role: 'primary',
          priority: 1,
          distance: 1,
        }),
        buildWanEntry(1, ifaces[1] || 'ether2', {
          ispProviderName: 'IndiHome Corporate Fiber',
          downloadMbps: 200,
          uploadMbps: 100,
          role: 'secondary',
          priority: 2,
          distance: 2,
        }),
        buildWanEntry(2, ifaces[2] || 'ether3', {
          ispProviderName: 'FirstMedia Backup Link',
          downloadMbps: 100,
          uploadMbps: 100,
          role: 'backup',
          priority: 3,
          distance: 3,
        }),
      ];
      const policies: HybridPolicyRule[] = [
        {
          id: 'pol-campus-voip',
          name: 'Real-Time Conferencing (UDP 3478,5060) -> WAN1 Low Latency',
          priority: 1,
          enabled: true,
          policyType: 'application',
          protocol: 'udp',
          dstPort: '3478,5060,8801',
          serviceLabel: 'Zoom / SIP VoIP',
          routingMode: 'failover',
          preferredWanIds: ['wan-1'],
          backupWanIds: ['wan-2', 'wan-3'],
          comment: 'Prioritize real-time conferencing via Dedicated WAN1',
        },
        {
          id: 'pol-campus-vlan20',
          name: 'VLAN 20 Lecturer & SIAKAD -> WAN1 Primary / WAN2 Backup',
          priority: 2,
          enabled: true,
          policyType: 'vlan',
          inInterfaceOrVlan: 'vlan20',
          srcAddress: '10.20.0.0/24',
          routingMode: 'failover',
          preferredWanIds: ['wan-1'],
          backupWanIds: ['wan-2', 'wan-3'],
          comment: 'Lecturer VLAN 20 dedicated path',
        },
        {
          id: 'pol-campus-vlan40',
          name: 'VLAN 40 Classroom & Lab -> Weighted PCC (WAN1 + WAN2) / WAN3 Backup',
          priority: 3,
          enabled: true,
          policyType: 'vlan',
          inInterfaceOrVlan: 'vlan40',
          srcAddress: '10.40.0.0/24',
          routingMode: 'weighted-pcc',
          pccClassifier: 'both-addresses-and-ports',
          preferredWanIds: ['wan-1', 'wan-2'],
          backupWanIds: ['wan-3'],
          comment: 'Student labs load-balanced across WAN1+WAN2 with WAN3 backup',
        },
      ];
      return createBaseMultiWanState('hybrid', wans, {
        selectedPresetId: 'hybrid-campus-network',
        hybridPolicies: policies,
      });
    },
  },
  {
    id: 'hybrid-office-network',
    title: '10. Hybrid Office Network',
    category: 'hybrid',
    badge: 'Hybrid • Enterprise',
    description:
      'Skenario Enterprise: ERP & Cloud Database (TCP 443/8443 ke Server HQ) → WAN1 Dedicated; Executive Subnet → WAN1+WAN2 Failover; General Staff → PCC Semua WAN.',
    wanCount: 3,
    recommendedFor: 'Kantor Pusat / Enterprise dengan aplikasi ERP, VoIP, dan General Internet',
    buildState: (device) => {
      const ifaces = getAvailablePhysicalInterfaces(device);
      const wans = [
        buildWanEntry(0, ifaces[0] || 'ether1', {
          ispProviderName: 'Telkomsel Metro-E Dedicated',
          downloadMbps: 300,
          uploadMbps: 300,
          role: 'primary',
          priority: 1,
          distance: 1,
        }),
        buildWanEntry(1, ifaces[1] || 'ether2', {
          ispProviderName: 'Biznet Metronet',
          downloadMbps: 200,
          uploadMbps: 200,
          role: 'secondary',
          priority: 2,
          distance: 2,
        }),
        buildWanEntry(2, ifaces[2] || 'ether3', {
          ispProviderName: 'Starlink Business Backup',
          downloadMbps: 150,
          uploadMbps: 30,
          role: 'backup',
          priority: 3,
          distance: 3,
        }),
      ];
      const policies: HybridPolicyRule[] = [
        {
          id: 'pol-office-erp',
          name: 'HQ Cloud ERP & Banking (TCP 443,8443) -> WAN1 Dedicated Sticky',
          priority: 1,
          enabled: true,
          policyType: 'application',
          protocol: 'tcp',
          dstPort: '443,8443',
          serviceLabel: 'HTTPS Banking & ERP',
          routingMode: 'failover',
          preferredWanIds: ['wan-1'],
          backupWanIds: ['wan-2', 'wan-3'],
          comment: 'Prevent IP change on banking & ERP sessions',
        },
        {
          id: 'pol-office-exec',
          name: 'Executive & Finance Subnet (192.168.10.0/24) -> WAN1 Primary / WAN2 Backup',
          priority: 2,
          enabled: true,
          policyType: 'src-address',
          srcAddress: '192.168.10.0/24',
          routingMode: 'failover',
          preferredWanIds: ['wan-1'],
          backupWanIds: ['wan-2', 'wan-3'],
          comment: 'Finance & Executive priority routing',
        },
        {
          id: 'pol-office-general',
          name: 'General Workforce LAN (192.168.88.0/24) -> PCC WAN1 + WAN2 (Backup WAN3)',
          priority: 3,
          enabled: true,
          policyType: 'src-address',
          srcAddress: '192.168.88.0/24',
          routingMode: 'pcc',
          pccClassifier: 'both-addresses',
          preferredWanIds: ['wan-1', 'wan-2'],
          backupWanIds: ['wan-3'],
          comment: 'Distribute general staff sessions across WAN1 & WAN2',
        },
      ];
      return createBaseMultiWanState('hybrid', wans, {
        selectedPresetId: 'hybrid-office-network',
        hybridPolicies: policies,
      });
    },
  },
];

export function createBaseMultiWanState(
  template: MultiWanTemplateType,
  wans: MultiWanInterfaceConfig[],
  overrides?: Partial<MultiWanConfigState>
): MultiWanConfigState {
  const defaultPolicies: HybridPolicyRule[] = [
    {
      id: 'pol-default-1',
      name: 'VLAN 20 Priority -> WAN1 Primary / WAN2 Backup',
      priority: 1,
      enabled: true,
      policyType: 'vlan',
      inInterfaceOrVlan: 'vlan20',
      srcAddress: '10.20.0.0/24',
      routingMode: 'failover',
      preferredWanIds: [wans[0]?.id || 'wan-1'],
      backupWanIds: wans.slice(1).map((w) => w.id),
      comment: 'Priority VLAN 20 traffic',
    },
    {
      id: 'pol-default-2',
      name: 'VLAN 40 Classroom -> PCC WAN1+WAN2 / Backup WAN3',
      priority: 2,
      enabled: true,
      policyType: 'vlan',
      inInterfaceOrVlan: 'vlan40',
      srcAddress: '10.40.0.0/24',
      routingMode: 'pcc',
      pccClassifier: 'both-addresses-and-ports',
      preferredWanIds: wans.slice(0, 2).map((w) => w.id),
      backupWanIds: wans.slice(2).map((w) => w.id),
      comment: 'Load balanced classroom traffic',
    },
  ];

  return {
    activeTemplate: template,
    selectedPresetId: overrides?.selectedPresetId || 'two-wan-failover',
    wans,
    failoverCheckMethod: 'recursive-route',
    autoRecovery: true,
    fastFailoverIntervalSec: 10,
    loadBalancingMethod: 'pcc-both-addresses-and-ports',
    useAutoBandwidthWeight: true,
    connectionTrackingSticky: true,
    autoFailoverUnhealthyWan: true,
    hybridPolicies: overrides?.hybridPolicies || defaultPolicies,
    localLanSubnets: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
    activeScenario: 'all-normal',
    simulatedTotalDemandDownMbps: 280,
    simulatedTotalDemandUpMbps: 95,
    simulatedActiveConnections: 420,
    events: [
      {
        id: `evt-init-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'SIMULATION',
        message: `Multi-WAN Manager initialized (${wans.length} WAN interfaces ready).`,
      },
    ],
    ...overrides,
  };
}

export function ensureMultiWanState(
  device: NetworkDevice,
  project?: NetworkProject
): MultiWanConfigState {
  const cfg = RouterOsConfigService.ensureConfig(device);
  if (cfg.multiWanConfig && cfg.multiWanConfig.wans && cfg.multiWanConfig.wans.length > 0) {
    return cfg.multiWanConfig;
  }

  // Dynamically inspect device physical interfaces and any connected ISP services
  const ifaces = getAvailablePhysicalInterfaces(device);
  const wanIfaces = device.interfaces.filter((i) => i.mode === 'wan');
  const candidateNames =
    wanIfaces.length >= 2
      ? wanIfaces.map((i) => i.name)
      : ifaces.slice(0, Math.min(Math.max(2, wanIfaces.length + 1), ifaces.length));

  const wans: MultiWanInterfaceConfig[] = candidateNames.map((ifName, idx) => {
    const devIface = device.interfaces.find((i) => i.name === ifName);
    const matchingIsp = project?.ispServices?.find(
      (isp) => isp.connectedDeviceId === device.id && isp.connectedInterfaceId === devIface?.id
    );
    return buildWanEntry(idx, ifName, {
      ispProviderName: matchingIsp?.providerName || ISP_PRESET_POOL[idx % ISP_PRESET_POOL.length].provider,
      ipAddress: devIface?.ipAddress || ISP_PRESET_POOL[idx % ISP_PRESET_POOL.length].ip,
      gateway: (idx === 0 ? device.defaultGateway : undefined) || ISP_PRESET_POOL[idx % ISP_PRESET_POOL.length].gw,
      downloadMbps: matchingIsp?.bandwidthDownMbps || ISP_PRESET_POOL[idx % ISP_PRESET_POOL.length].down,
      uploadMbps: matchingIsp?.bandwidthUpMbps || ISP_PRESET_POOL[idx % ISP_PRESET_POOL.length].up,
      cirMbps: matchingIsp?.cirDownMbps || ISP_PRESET_POOL[idx % ISP_PRESET_POOL.length].cir,
      contentionRatio: matchingIsp?.contentionRatio || ISP_PRESET_POOL[idx % ISP_PRESET_POOL.length].ratio,
      latencyMs: matchingIsp?.baseLatencyMs || ISP_PRESET_POOL[idx % ISP_PRESET_POOL.length].lat,
      jitterMs: matchingIsp?.jitterMs || ISP_PRESET_POOL[idx % ISP_PRESET_POOL.length].jit,
      packetLossPercent: matchingIsp?.packetLossPercent || 0,
    });
  });

  const initialState = createBaseMultiWanState('failover', wans);
  cfg.multiWanConfig = initialState;
  return initialState;
}

// ==========================================
// OPERATIONAL STATE EVALUATOR FOR EACH WAN
// ==========================================

export function evaluateWanOperationalStatus(
  wan: MultiWanInterfaceConfig,
  globalCheckMethod?: string
): { status: WanOperationalState; reason: string; canRouteTraffic: boolean } {
  const checkMethod = wan.healthCheckMethod || globalCheckMethod || 'recursive-route';

  // 1. Physical Link check
  if (wan.linkState === 'DOWN') {
    return {
      status: 'DOWN',
      reason: `Physical interface ${wan.physicalInterface} link is DOWN (carrier lost)`,
      canRouteTraffic: false,
    };
  }

  // 2. Next-hop Gateway check
  if (wan.gatewayState === 'UNREACHABLE') {
    return {
      status: 'DOWN',
      reason: `Gateway ${wan.gateway} is UNREACHABLE via ${wan.physicalInterface} (check-gateway=ping timeout)`,
      canRouteTraffic: false,
    };
  }

  // 3. Upstream Internet reachability check (Recursive Route vs Simple Gateway difference!)
  if (wan.internetState === 'OFFLINE') {
    if (checkMethod === 'recursive-route' || checkMethod === 'external-target') {
      return {
        status: 'DOWN',
        reason: `Gateway ${wan.gateway} is reachable, but Recursive Target ${wan.healthCheckTarget} is UNREACHABLE (ISP upstream outage detected!)`,
        canRouteTraffic: false,
      };
    } else {
      // Simple gateway check only pings local modem/gateway, so it fails to detect upstream internet outage!
      return {
        status: 'DEGRADED',
        reason: `Simple Gateway Check sees ${wan.gateway} UP, but upstream internet (${wan.healthCheckTarget}) is OFFLINE (Silent Blackhole! Enable Recursive Route)`,
        canRouteTraffic: true, // Router mistakenly keeps route active because simple check only checks gateway
      };
    }
  }

  // 4. Congestion / Overload / Service degradation check
  if (wan.isOverloaded || wan.serviceState === 'DEGRADED' || wan.packetLossPercent >= 5) {
    return {
      status: 'DEGRADED',
      reason: `High congestion / SLA degradation on ${wan.name} (loss ${wan.packetLossPercent}%, latency ${wan.latencyMs}ms)`,
      canRouteTraffic: true,
    };
  }

  if (wan.operationalStatus === 'RECOVERING') {
    return {
      status: 'RECOVERING',
      reason: `Health check target ${wan.healthCheckTarget} responding; stabilizing route recovery`,
      canRouteTraffic: true,
    };
  }

  return {
    status: 'UP',
    reason: `Healthy (${checkMethod === 'recursive-route' ? `Recursive via ${wan.healthCheckTarget}` : `Gateway ${wan.gateway}`} OK)`,
    canRouteTraffic: true,
  };
}

// ==========================================
// CONFIGURATION GENERATOR (RouterOS v6 & v7)
// ==========================================

export function generateMultiWanObjects(
  device: NetworkDevice,
  mwan: MultiWanConfigState,
  targetVersion?: RouterOsVersion
): MultiWanGeneratedArtifacts {
  const cfg = RouterOsConfigService.ensureConfig(device);
  const version: RouterOsVersion = targetVersion === 'v7' ? 'v7' : targetVersion === 'v6' ? 'v6' : cfg.version;
  const sortedWans = [...mwan.wans].sort((a, b) => a.priority - b.priority);

  const ipAddresses: RouterOsIpAddress[] = [];
  const routingTables: RouterOsRoutingTable[] = [];
  const routes: RouterOsRoute[] = [];
  const addressLists: RouterOsAddressListEntry[] = [];
  const mangleRules: MangleRule[] = [];
  const natRules: RouterOsFirewallNatRule[] = [];
  const interfaceComments: Record<string, string> = {};

  // 1. Interfaces & IP Addresses & NAT Masquerade per WAN
  sortedWans.forEach((wan, idx) => {
    const tableName = `to-${wan.name}`;
    const connMark = `${wan.name}_conn`;
    interfaceComments[wan.physicalInterface] =
      `${MWAN_TAG} ${wan.name} (${wan.ispProviderName}) [${wan.role.toUpperCase()}]`;

    // IP Address entry
    const cleanCidr = wan.ipAddress.includes('/') ? wan.ipAddress : `${wan.ipAddress}/24`;
    const parsedIp = parseIPv4Cidr(cleanCidr);
    ipAddresses.push({
      id: `mwan-ip-${wan.id}`,
      address: cleanCidr,
      network: parsedIp?.network || wan.gateway,
      interface: wan.physicalInterface,
      disabled: false,
      comment: `${MWAN_TAG} ${wan.name} (${wan.connectionType.toUpperCase()} - ${wan.ispProviderName})`,
    });

    // Routing Table (RouterOS v7 explicit FIB table)
    routingTables.push({
      id: `mwan-rt-${wan.id}`,
      name: tableName,
      fib: true,
      disabled: false,
      comment: `${MWAN_TAG} Routing Table for ${wan.name} (${wan.ispProviderName})`,
    });

    // NAT Masquerade Rule
    natRules.push({
      id: `mwan-nat-${wan.id}`,
      chain: 'srcnat',
      action: 'masquerade',
      outInterface: wan.physicalInterface,
      disabled: false,
      comment: `${MWAN_TAG} Masquerade outbound via ${wan.name} (${wan.physicalInterface})`,
      bytesCount: 0,
      packetsCount: 0,
    });

    // Evaluate current WAN health for route active flag
    const health = evaluateWanOperationalStatus(wan, mwan.failoverCheckMethod);
    const isRouteActive = health.canRouteTraffic;

    // Recursive Host Route if recursive-route or external-target is enabled
    const useRecursive =
      wan.healthCheckMethod === 'recursive-route' ||
      wan.healthCheckMethod === 'external-target' ||
      (mwan.activeTemplate === 'failover' && mwan.failoverCheckMethod !== 'simple-gateway');

    const checkTarget = (wan.healthCheckTarget || '8.8.8.8').trim();
    const effectiveGateway = useRecursive ? checkTarget : wan.gateway;

    if (useRecursive) {
      routes.push({
        id: `mwan-route-rec-${wan.id}`,
        dstAddress: `${checkTarget}/32`,
        gateway: wan.gateway,
        distance: 1,
        scope: 10,
        targetScope: 10,
        checkGateway: 'ping',
        disabled: false,
        active: wan.linkState === 'UP' && wan.gatewayState === 'REACHABLE',
        routingTable: 'main',
        comment: `${MWAN_TAG} Recursive Monitor Host for ${wan.name} via ${wan.gateway}`,
      });
    }

    // Per-WAN Policy Routing Table Default Route (Primary path in to-WANx)
    routes.push({
      id: `mwan-route-tbl-${wan.id}`,
      dstAddress: '0.0.0.0/0',
      gateway: effectiveGateway,
      distance: 1,
      scope: 30,
      targetScope: useRecursive ? 11 : 10,
      checkGateway: 'ping',
      disabled: false,
      active: isRouteActive,
      routingTable: tableName,
      routingMark: tableName,
      comment: `${MWAN_TAG} Policy Default Route for ${wan.name} (${tableName})`,
    });

    // Backup failover routes inside `to-WANx` table so marked connections fail over if WANx goes down
    if (mwan.autoFailoverUnhealthyWan || mwan.activeTemplate !== 'failover') {
      sortedWans
        .filter((other) => other.id !== wan.id)
        .forEach((backupWan, bIdx) => {
          const backupHealth = evaluateWanOperationalStatus(backupWan, mwan.failoverCheckMethod);
          const backupUseRec =
            backupWan.healthCheckMethod === 'recursive-route' ||
            backupWan.healthCheckMethod === 'external-target';
          const backupGw = backupUseRec ? backupWan.healthCheckTarget || '1.1.1.1' : backupWan.gateway;

          routes.push({
            id: `mwan-route-tbl-${wan.id}-backup-${backupWan.id}`,
            dstAddress: '0.0.0.0/0',
            gateway: backupGw,
            distance: bIdx + 2,
            scope: 30,
            targetScope: backupUseRec ? 11 : 10,
            checkGateway: 'ping',
            disabled: false,
            active: !isRouteActive && backupHealth.canRouteTraffic,
            routingTable: tableName,
            routingMark: tableName,
            comment: `${MWAN_TAG} Backup Route for ${tableName} via ${backupWan.name} (dist=${bIdx + 2})`,
          });
        });
    }

    // Main Routing Table Default Route (ordered by distance / priority, or ECMP)
    if (mwan.activeTemplate !== 'load-balancing' || mwan.loadBalancingMethod !== 'ecmp') {
      const dist = wan.distance || idx + 1;
      routes.push({
        id: `mwan-route-main-${wan.id}`,
        dstAddress: '0.0.0.0/0',
        gateway: effectiveGateway,
        distance: dist,
        scope: 30,
        targetScope: useRecursive ? 11 : 10,
        checkGateway: 'ping',
        disabled: false,
        active: isRouteActive,
        routingTable: 'main',
        comment: `${MWAN_TAG} Main Table Failover Route via ${wan.name} (${wan.role}, distance=${dist})`,
      });
    }

    // Keep unused variable warning away
    void connMark;
  });

  // If ECMP mode is selected in Load Balancing, add ECMP multi-gateway route in main table
  if (mwan.activeTemplate === 'load-balancing' && mwan.loadBalancingMethod === 'ecmp') {
    const healthyWans = sortedWans.filter(
      (w) => evaluateWanOperationalStatus(w, mwan.failoverCheckMethod).canRouteTraffic
    );
    const activeWansForEcmp = healthyWans.length > 0 ? healthyWans : sortedWans;
    const ecmpGateways = activeWansForEcmp.map((w) => w.gateway).join(',');
    routes.push({
      id: `mwan-route-ecmp-main`,
      dstAddress: '0.0.0.0/0',
      gateway: ecmpGateways,
      distance: 1,
      scope: 30,
      targetScope: 10,
      checkGateway: 'ping',
      disabled: false,
      active: healthyWans.length > 0,
      routingTable: 'main',
      comment: `${MWAN_TAG} ECMP Equal-Cost Multi-Path Default Route (${activeWansForEcmp.map((w) => w.name).join('+')})`,
    });
  }

  // 2. RFC1918 / Local LAN Bypass Address Lists
  const localSubnets =
    mwan.localLanSubnets && mwan.localLanSubnets.length > 0
      ? mwan.localLanSubnets
      : ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];

  localSubnets.forEach((subnet, idx) => {
    addressLists.push({
      id: `mwan-addrlist-lan-${idx + 1}`,
      list: 'LOCAL-LAN',
      address: subnet,
      disabled: false,
      dynamic: false,
      comment: `${MWAN_TAG} RFC1918 Local Network Bypass`,
    });
  });

  // 3. IP Firewall Mangle Rules (Ordered strictly for RouterOS best practices)
  let mangleOrder = 0;
  const pushMangle = (partial: Omit<MangleRule, 'id' | 'order' | 'invalid' | 'bytes' | 'packets' | 'createdAt' | 'updatedAt'>) => {
    const idx = mangleOrder++;
    mangleRules.push({
      ...partial,
      id: `mwan-mangle-${idx + 1}`,
      order: idx,
      invalid: false,
      bytes: 0,
      packets: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  // Step 3A: Local-to-Local traffic bypass (accept before policy routing)
  pushMangle({
    chain: 'prerouting',
    action: 'accept',
    srcAddressList: 'LOCAL-LAN',
    dstAddressList: 'LOCAL-LAN',
    passthrough: false,
    disabled: false,
    comment: `${MWAN_TAG} Bypass Policy Routing for Local-to-Local LAN traffic`,
  });

  // Step 3B: Mark incoming connections from each WAN so replies leave via the same WAN
  sortedWans.forEach((wan) => {
    pushMangle({
      chain: 'prerouting',
      action: 'mark-connection',
      inInterface: wan.physicalInterface,
      connectionMark: 'no-mark',
      newConnectionMark: `${wan.name}_conn`,
      passthrough: true,
      disabled: false,
      comment: `${MWAN_TAG} Ingress Connection Mark from ${wan.name} (${wan.physicalInterface})`,
    });
  });

  // Step 3C: Mark routing in output chain for router-originated replies
  sortedWans.forEach((wan) => {
    pushMangle({
      chain: 'output',
      action: 'mark-routing',
      connectionMark: `${wan.name}_conn`,
      newRoutingMark: `to-${wan.name}`,
      passthrough: false,
      disabled: false,
      comment: `${MWAN_TAG} Output Routing Mark for ${wan.name} replies`,
    });
  });

  // Step 3D: Template-Specific LAN Prerouting Classification Rules
  if (mwan.activeTemplate === 'load-balancing' && mwan.loadBalancingMethod !== 'ecmp') {
    // Determine active load-balanced WANs (primary + secondary, or all non-backup if configured, or all WANs)
    const lbWans =
      sortedWans.filter((w) => w.role !== 'backup').length >= 2
        ? sortedWans.filter((w) => w.role !== 'backup')
        : sortedWans;

    if (mwan.loadBalancingMethod === 'weighted-pcc') {
      const weighted = calculateWeightedPccRatios(lbWans, mwan.useAutoBandwidthWeight);
      lbWans.forEach((wan) => {
        const buckets = weighted.bucketsByWanId[wan.id] || [];
        buckets.forEach((bucket) => {
          pushMangle({
            chain: 'prerouting',
            action: 'mark-connection',
            srcAddressList: 'LOCAL-LAN',
            dstAddressList: '!LOCAL-LAN',
            connectionState: 'new',
            connectionMark: 'no-mark',
            pcc: `${weighted.classifierName}:${bucket}`,
            newConnectionMark: `${wan.name}_conn`,
            passthrough: true,
            disabled: false,
            comment: `${MWAN_TAG} Weighted PCC (${bucket}, weight=${weighted.ratios[wan.id]}) -> ${wan.name}`,
          });
        });
      });
    } else {
      const classifier =
        mwan.loadBalancingMethod === 'pcc-both-addresses'
          ? 'both-addresses'
          : mwan.loadBalancingMethod === 'pcc-src-address'
          ? 'src-address'
          : mwan.loadBalancingMethod === 'pcc-dst-address'
          ? 'dst-address'
          : 'both-addresses-and-ports';

      const total = lbWans.length;
      lbWans.forEach((wan, idx) => {
        pushMangle({
          chain: 'prerouting',
          action: 'mark-connection',
          srcAddressList: 'LOCAL-LAN',
          dstAddressList: '!LOCAL-LAN',
          connectionState: 'new',
          connectionMark: 'no-mark',
          pcc: `${classifier}:${total}/${idx}`,
          newConnectionMark: `${wan.name}_conn`,
          passthrough: true,
          disabled: false,
          comment: `${MWAN_TAG} PCC Load Balance (${classifier}:${total}/${idx}) -> ${wan.name}`,
        });
      });
    }
  } else if (mwan.activeTemplate === 'hybrid') {
    const orderedPolicies = [...mwan.hybridPolicies]
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    orderedPolicies.forEach((pol) => {
      const policyWans = pol.preferredWanIds
        .map((id) => sortedWans.find((w) => w.id === id))
        .filter((w): w is MultiWanInterfaceConfig => Boolean(w));

      const effectiveWans = policyWans.length > 0 ? policyWans : [sortedWans[0]].filter(Boolean);
      if (effectiveWans.length === 0) return;

      const commonMatchers = {
        inInterface: pol.policyType === 'vlan' && pol.inInterfaceOrVlan ? pol.inInterfaceOrVlan : undefined,
        srcAddress: pol.srcAddress || undefined,
        dstAddress: pol.dstAddress && pol.dstAddress !== '0.0.0.0/0' ? pol.dstAddress : undefined,
        dstAddressList: !pol.dstAddress || pol.dstAddress === '0.0.0.0/0' ? '!LOCAL-LAN' : undefined,
        protocol: pol.protocol && pol.protocol !== 'all' ? pol.protocol : undefined,
        dstPort: pol.dstPort || undefined,
      };

      if (pol.routingMode === 'failover' || effectiveWans.length === 1) {
        // Choose first healthy preferred WAN, or fallback to backup WAN if preferred is down
        let targetWan = effectiveWans[0];
        if (!evaluateWanOperationalStatus(targetWan, mwan.failoverCheckMethod).canRouteTraffic) {
          const healthyBackup = pol.backupWanIds
            .map((id) => sortedWans.find((w) => w.id === id))
            .find((w) => w && evaluateWanOperationalStatus(w, mwan.failoverCheckMethod).canRouteTraffic);
          if (healthyBackup) {
            targetWan = healthyBackup;
          }
        }
        pushMangle({
          chain: 'prerouting',
          action: 'mark-connection',
          ...commonMatchers,
          connectionMark: 'no-mark',
          newConnectionMark: `${targetWan.name}_conn`,
          passthrough: true,
          disabled: false,
          comment: `${MWAN_TAG} Hybrid Policy #${pol.priority} [${pol.name}] -> ${targetWan.name}`,
        });
      } else if (pol.routingMode === 'weighted-pcc') {
        const weighted = calculateWeightedPccRatios(effectiveWans, true);
        const clf = pol.pccClassifier || 'both-addresses-and-ports';
        effectiveWans.forEach((wan) => {
          const buckets = weighted.bucketsByWanId[wan.id] || [];
          buckets.forEach((bucket) => {
            pushMangle({
              chain: 'prerouting',
              action: 'mark-connection',
              ...commonMatchers,
              connectionMark: 'no-mark',
              pcc: `${clf}:${bucket}`,
              newConnectionMark: `${wan.name}_conn`,
              passthrough: true,
              disabled: false,
              comment: `${MWAN_TAG} Hybrid Policy #${pol.priority} [${pol.name}] Weighted PCC (${bucket}) -> ${wan.name}`,
            });
          });
        });
      } else {
        // Standard PCC across preferredWanIds
        const clf = pol.pccClassifier || 'both-addresses-and-ports';
        const total = effectiveWans.length;
        effectiveWans.forEach((wan, idx) => {
          pushMangle({
            chain: 'prerouting',
            action: 'mark-connection',
            ...commonMatchers,
            connectionMark: 'no-mark',
            pcc: `${clf}:${total}/${idx}`,
            newConnectionMark: `${wan.name}_conn`,
            passthrough: true,
            disabled: false,
            comment: `${MWAN_TAG} Hybrid Policy #${pol.priority} [${pol.name}] PCC (${total}/${idx}) -> ${wan.name}`,
          });
        });
      }
    });
  }

  // Step 3E: Translate Connection Marks into Routing Marks for LAN egress traffic
  sortedWans.forEach((wan) => {
    pushMangle({
      chain: 'prerouting',
      action: 'mark-routing',
      srcAddressList: 'LOCAL-LAN',
      dstAddressList: '!LOCAL-LAN',
      connectionMark: `${wan.name}_conn`,
      newRoutingMark: `to-${wan.name}`,
      passthrough: false,
      disabled: false,
      comment: `${MWAN_TAG} Route Marked Connections (${wan.name}_conn) via table to-${wan.name}`,
    });
  });

  const cliScript = generateMultiWanCliScript(device.name, version, mwan, {
    version,
    ipAddresses,
    routingTables,
    routes,
    addressLists,
    mangleRules,
    natRules,
    interfaceComments,
    cliScript: '',
  });

  return {
    version,
    ipAddresses,
    routingTables,
    routes,
    addressLists,
    mangleRules,
    natRules,
    interfaceComments,
    cliScript,
  };
}

export function generateMultiWanCliScript(
  routerName: string,
  version: RouterOsVersion,
  mwan: MultiWanConfigState,
  artifacts: MultiWanGeneratedArtifacts
): string {
  const verLabel = version === 'v7' ? 'RouterOS v7 (7.15.2)' : 'RouterOS v6 (6.49.13)';
  const lines: string[] = [];

  lines.push(`# ====================================================================`);
  lines.push(`# NETLAB MULTI-WAN CONFIGURATION GENERATOR`);
  lines.push(`# Router Identity : ${routerName}`);
  lines.push(`# Target OS       : MikroTik ${verLabel}`);
  lines.push(`# Architecture    : ${mwan.activeTemplate.toUpperCase()} (${mwan.wans.length} WAN Links)`);
  lines.push(`# Generated At    : ${new Date().toISOString()}`);
  lines.push(`# ====================================================================`);
  lines.push(``);

  // 1. Interface Comments
  lines.push(`/interface ethernet`);
  mwan.wans.forEach((w) => {
    lines.push(
      `set [ find default-name=${w.physicalInterface} ] comment="${MWAN_TAG} ${w.name} (${w.ispProviderName}) [${w.role.toUpperCase()}]"`
    );
  });
  lines.push(``);

  // 2. WAN Addressing (Static / DHCP Client / PPPoE Client)
  const staticIps = mwan.wans.filter((w) => w.connectionType === 'static');
  const dhcpWans = mwan.wans.filter((w) => w.connectionType === 'dhcp');
  const pppoeWans = mwan.wans.filter((w) => w.connectionType === 'pppoe');

  if (staticIps.length > 0) {
    lines.push(`/ip address`);
    staticIps.forEach((w) => {
      const cidr = w.ipAddress.includes('/') ? w.ipAddress : `${w.ipAddress}/30`;
      lines.push(
        `add address=${cidr} interface=${w.physicalInterface} comment="${MWAN_TAG} ${w.name} Static IP (${w.ispProviderName})"`
      );
    });
    lines.push(``);
  }

  if (dhcpWans.length > 0) {
    lines.push(`/ip dhcp-client`);
    dhcpWans.forEach((w) => {
      lines.push(
        `add interface=${w.physicalInterface} add-default-route=no use-peer-dns=no disabled=no comment="${MWAN_TAG} ${w.name} DHCP Client (${w.ispProviderName})"`
      );
    });
    lines.push(``);
  }

  if (pppoeWans.length > 0) {
    lines.push(`/interface pppoe-client`);
    pppoeWans.forEach((w, idx) => {
      lines.push(
        `add name=pppoe-out${idx + 1} interface=${w.physicalInterface} user="${w.pppoeUsername || 'user@isp'}" password="${w.pppoePassword || '***'}" add-default-route=no use-peer-dns=no disabled=no comment="${MWAN_TAG} ${w.name} PPPoE (${w.ispProviderName})"`
      );
    });
    lines.push(``);
  }

  // 3. Routing Tables (RouterOS v7 ONLY — never emit /routing table in v6!)
  if (version === 'v7') {
    lines.push(`# RouterOS v7 Explicit FIB Routing Tables`);
    lines.push(`/routing table`);
    artifacts.routingTables.forEach((rt) => {
      lines.push(`add name=${rt.name} fib comment="${rt.comment}"`);
    });
    lines.push(``);
  } else {
    lines.push(`# RouterOS v6 Note: Routing marks are defined directly in /ip firewall mangle and /ip route`);
    lines.push(``);
  }

  // 4. Firewall Address Lists (RFC1918 Bypass)
  lines.push(`/ip firewall address-list`);
  artifacts.addressLists.forEach((al) => {
    lines.push(`add list=${al.list} address=${al.address} comment="${al.comment}"`);
  });
  lines.push(``);

  // 5. Firewall Mangle
  lines.push(`/ip firewall mangle`);
  artifacts.mangleRules.forEach((m) => {
    let cmd = `add chain=${m.chain} action=${m.action}`;
    if (m.inInterface) cmd += ` in-interface=${m.inInterface}`;
    if (m.srcAddress) cmd += ` src-address=${m.srcAddress}`;
    if (m.dstAddress) cmd += ` dst-address=${m.dstAddress}`;
    if (m.srcAddressList) cmd += ` src-address-list=${m.srcAddressList}`;
    if (m.dstAddressList) cmd += ` dst-address-list=${m.dstAddressList}`;
    if (m.protocol) cmd += ` protocol=${m.protocol}`;
    if (m.dstPort) cmd += ` dst-port=${m.dstPort}`;
    if (m.connectionState) cmd += ` connection-state=${m.connectionState}`;
    if (m.connectionMark) cmd += ` connection-mark=${m.connectionMark}`;
    if (m.pcc) cmd += ` per-connection-classifier=${m.pcc}`;
    if (m.newConnectionMark) cmd += ` new-connection-mark=${m.newConnectionMark}`;
    if (m.newRoutingMark) cmd += ` new-routing-mark=${m.newRoutingMark}`;
    if (['mark-connection', 'mark-packet', 'mark-routing'].includes(m.action)) {
      cmd += ` passthrough=${m.passthrough ? 'yes' : 'no'}`;
    }
    if (m.comment) cmd += ` comment="${m.comment}"`;
    lines.push(cmd);
  });
  lines.push(``);

  // 6. Firewall NAT
  lines.push(`/ip firewall nat`);
  artifacts.natRules.forEach((n) => {
    lines.push(
      `add chain=${n.chain} out-interface=${n.outInterface} action=${n.action} comment="${n.comment}"`
    );
  });
  lines.push(``);

  // 7. IP Routes (Strict v6 routing-mark vs v7 routing-table syntax)
  lines.push(`/ip route`);
  artifacts.routes.forEach((r) => {
    let cmd = `add dst-address=${r.dstAddress} gateway=${r.gateway} distance=${r.distance}`;
    if (r.checkGateway && r.checkGateway !== 'none') {
      cmd += ` check-gateway=${r.checkGateway}`;
    }
    if (r.scope && r.scope !== 30) {
      cmd += ` scope=${r.scope}`;
    }
    if (r.targetScope && r.targetScope !== 10) {
      cmd += ` target-scope=${r.targetScope}`;
    }
    if (r.routingTable && r.routingTable !== 'main') {
      if (version === 'v7') {
        cmd += ` routing-table=${r.routingTable}`;
      } else {
        cmd += ` routing-mark=${r.routingTable}`;
      }
    }
    if (r.comment) {
      cmd += ` comment="${r.comment}"`;
    }
    lines.push(cmd);
  });

  return lines.join('\n');
}

// ==========================================
// PRE-APPLY VALIDATION & SAFETY ENGINE
// ==========================================

export function validateMultiWanConfig(
  device: NetworkDevice,
  mwan: MultiWanConfigState
): MultiWanValidationIssue[] {
  const issues: MultiWanValidationIssue[] = [];
  const cfg = RouterOsConfigService.ensureConfig(device);
  const physicalNames = new Set(device.interfaces.map((i) => i.name));
  const vlanNames = new Set((cfg.vlans || []).map((v) => v.name));
  const bridgeNames = new Set((cfg.bridges || []).map((b) => b.name));

  if (mwan.wans.length < 2) {
    issues.push({
      id: 'val-min-wans',
      severity: 'error',
      category: 'interface',
      title: 'Minimal 2 WAN Diperlukan',
      message: 'Konfigurasi Multi-WAN membutuhkan minimal 2 jalur WAN aktif.',
      remediation: 'Tambahkan WAN baru melalui tombol "+ Add WAN Link".',
    });
  }

  const usedIfaces = new Set<string>();
  const usedGateways = new Set<string>();
  const usedTargets = new Set<string>();

  mwan.wans.forEach((w) => {
    // 1. Interface existence & uniqueness
    if (!w.physicalInterface) {
      issues.push({
        id: `val-no-iface-${w.id}`,
        severity: 'error',
        category: 'interface',
        title: `${w.name}: Interface Fisik Belum Dipilih`,
        message: `${w.name} belum dipetakan ke interface fisik router.`,
        remediation: 'Pilih interface fisik seperti ether1, ether2, atau sfp1.',
      });
    } else {
      if (!physicalNames.has(w.physicalInterface)) {
        issues.push({
          id: `val-missing-iface-${w.id}`,
          severity: 'warning',
          category: 'interface',
          title: `${w.name}: Interface '${w.physicalInterface}' Tidak Ditemukan di Hardware`,
          message: `Interface ${w.physicalInterface} tidak ada pada daftar port fisik ${device.name}.`,
          remediation: `Pilih salah satu port yang tersedia: ${Array.from(physicalNames).join(', ')}.`,
        });
      }
      if (usedIfaces.has(w.physicalInterface)) {
        issues.push({
          id: `val-dup-iface-${w.id}`,
          severity: 'error',
          category: 'interface',
          title: `Konflik Interface Fisik (${w.physicalInterface})`,
          message: `Interface ${w.physicalInterface} digunakan oleh lebih dari satu WAN.`,
          remediation: 'Setiap WAN harus menggunakan interface fisik atau VLAN WAN yang berbeda.',
        });
      }
      usedIfaces.add(w.physicalInterface);
    }

    // 2. IP & Subnet validation
    const cidr = w.ipAddress.includes('/') ? w.ipAddress : `${w.ipAddress}/24`;
    const parsedIp = parseIPv4Cidr(cidr);
    if (!parsedIp) {
      issues.push({
        id: `val-ip-${w.id}`,
        severity: 'error',
        category: 'ip-subnet',
        title: `${w.name}: Format IP Address Tidak Valid`,
        message: `Alamat IP '${w.ipAddress}' pada ${w.name} tidak sesuai format IPv4/CIDR.`,
        remediation: 'Gunakan format IPv4/CIDR valid, contoh: 203.142.80.2/30.',
      });
    }

    // 3. Gateway validation & routing loop check
    const gwClean = (w.gateway || '').trim();
    const gwParts = gwClean.split('.');
    const isGwValid =
      gwParts.length === 4 &&
      gwParts.every((p) => {
        const n = Number(p);
        return !isNaN(n) && n >= 0 && n <= 255;
      });
    if (!isGwValid) {
      issues.push({
        id: `val-gw-${w.id}`,
        severity: 'error',
        category: 'gateway',
        title: `${w.name}: Gateway IP Tidak Valid`,
        message: `Gateway '${w.gateway}' pada ${w.name} bukan alamat IPv4 yang valid.`,
        remediation: 'Masukkan IPv4 gateway ISP yang valid (contoh: 203.142.80.1).',
      });
    } else {
      const ownIpOnly = w.ipAddress.split('/')[0].trim();
      if (gwClean === ownIpOnly) {
        issues.push({
          id: `val-loop-${w.id}`,
          severity: 'error',
          category: 'routing-loop',
          title: `${w.name}: Routing Loop Terdeteksi`,
          message: `Gateway ${w.gateway} sama dengan IP interface ${w.name} sendiri (${ownIpOnly}).`,
          remediation: 'Gunakan IP next-hop milik router/modem ISP, bukan IP interface router ini.',
        });
      }
      if (usedGateways.has(gwClean)) {
        issues.push({
          id: `val-dupgw-${w.id}`,
          severity: 'warning',
          category: 'gateway',
          title: `${w.name}: Gateway IP Sama dengan WAN Lain (${gwClean})`,
          message: `Beberapa WAN menggunakan IP gateway yang sama (${gwClean}). Pada recursive route hal ini dapat menyebabkan ambiguitas nexthop.`,
          remediation: 'Gunakan subnet gateway berbeda atau format gateway%interface.',
        });
      }
      usedGateways.add(gwClean);
    }

    // 4. Recursive Health Check Target uniqueness check
    if (w.healthCheckMethod === 'recursive-route' || w.healthCheckMethod === 'external-target') {
      if (!w.healthCheckTarget) {
        issues.push({
          id: `val-hc-empty-${w.id}`,
          severity: 'error',
          category: 'routing-table',
          title: `${w.name}: Target Health-Check Kosong`,
          message: `Metode Recursive Route membutuhkan IP target publik (contoh: 8.8.8.8).`,
        });
      } else if (usedTargets.has(w.healthCheckTarget)) {
        issues.push({
          id: `val-hc-dup-${w.id}`,
          severity: 'warning',
          category: 'routing-table',
          title: `Target Recursive Host Duplikat (${w.healthCheckTarget})`,
          message: `Lebih dari satu WAN memakai host recursive ${w.healthCheckTarget}/32 di tabel main.`,
          remediation: 'Gunakan target berbeda untuk tiap WAN (mis. WAN1=8.8.8.8, WAN2=1.1.1.1, WAN3=9.9.9.9).',
        });
      }
      if (w.healthCheckTarget) usedTargets.add(w.healthCheckTarget);
    }

    // 5. Bandwidth & CIR sanity check
    if (w.cirMbps > w.downloadMbps) {
      issues.push({
        id: `val-cir-${w.id}`,
        severity: 'warning',
        category: 'policy-conflict',
        title: `${w.name}: CIR Melebihi Bandwidth Download`,
        message: `CIR (${w.cirMbps} Mbps) lebih besar daripada Download Bandwidth (${w.downloadMbps} Mbps).`,
        remediation: 'Pastikan nilai CIR <= Download Bandwidth.',
      });
    }
  });

  // 6. Hybrid Policy Checks (Policy conflict, missing backup path, missing VLAN interface)
  if (mwan.activeTemplate === 'hybrid') {
    const enabledPolicies = mwan.hybridPolicies.filter((p) => p.enabled);
    const seenSignatures = new Set<string>();

    enabledPolicies.forEach((pol) => {
      if (pol.preferredWanIds.length === 0) {
        issues.push({
          id: `val-pol-nowan-${pol.id}`,
          severity: 'error',
          category: 'mangle',
          title: `Policy '${pol.name}': Belum Memilih Preferred WAN`,
          message: `Policy #${pol.priority} tidak memiliki target WAN utama.`,
          remediation: 'Pilih minimal satu Preferred WAN pada policy.',
        });
      }

      if (pol.backupWanIds.length === 0) {
        issues.push({
          id: `val-pol-nobackup-${pol.id}`,
          severity: 'warning',
          category: 'no-backup-path',
          title: `Policy '${pol.name}': Tanpa Jalur Backup (Single Point of Failure)`,
          message: `Policy #${pol.priority} tidak memiliki Backup WAN jika WAN utama mengalami gangguan.`,
          remediation: 'Tambahkan minimal 1 Backup WAN pada policy agar otomatis failover.',
        });
      }

      if (
        pol.policyType === 'vlan' &&
        pol.inInterfaceOrVlan &&
        !physicalNames.has(pol.inInterfaceOrVlan) &&
        !vlanNames.has(pol.inInterfaceOrVlan) &&
        !bridgeNames.has(pol.inInterfaceOrVlan)
      ) {
        issues.push({
          id: `val-pol-vlan-${pol.id}`,
          severity: 'info',
          category: 'interface',
          title: `Policy '${pol.name}': Interface '${pol.inInterfaceOrVlan}' Belum Ada di Tabel VLAN`,
          message: `Rule Mangle akan tetap menggunakan src-address (${pol.srcAddress || 'LAN'}) atau Anda dapat menambahkan interface ${pol.inInterfaceOrVlan} di menu VLAN.`,
        });
      }

      const sig = `${pol.policyType}|${pol.inInterfaceOrVlan || ''}|${pol.srcAddress || ''}|${pol.protocol || ''}|${pol.dstPort || ''}`;
      if (seenSignatures.has(sig)) {
        issues.push({
          id: `val-pol-conflict-${pol.id}`,
          severity: 'warning',
          category: 'policy-conflict',
          title: `Konflik / Overlap Matcher pada Policy '${pol.name}'`,
          message: `Terdapat policy lain dengan kriteria matcher yang identik (${sig}). Policy dengan prioritas lebih tinggi akan selalu dieksekusi lebih dulu (shadowing).`,
          remediation: 'Periksa urutan prioritas atau bedakan subnet/port pada policy.',
        });
      }
      seenSignatures.add(sig);
    });
  }

  // 7. RouterOS v6 vs v7 Compatibility Info
  issues.push({
    id: 'val-version-compat',
    severity: 'info',
    category: 'version-compat',
    title: `Kompatibilitas Sintaks MikroTik RouterOS ${cfg.version.toUpperCase()} Terverifikasi`,
    message:
      cfg.version === 'v7'
        ? 'Generator menggunakan sintaks RouterOS v7 murni (/routing table fib & routing-table=to-WANx).'
        : 'Generator menggunakan sintaks RouterOS v6 murni (routing-mark=to-WANx tanpa /routing table).',
  });

  return issues;
}

// ==========================================
// DRY RUN PREVIEW, APPLY, SNAPSHOT & ROLLBACK
// ==========================================

export function buildMergedConfigWithMultiWan(
  device: NetworkDevice,
  mwan: MultiWanConfigState
): {
  nextConfig: RouterOsDeviceConfig;
  artifacts: MultiWanGeneratedArtifacts;
  summary: MultiWanDryRunPreview['summary'];
} {
  const currentCfg = RouterOsConfigService.ensureConfig(device);
  const artifacts = generateMultiWanObjects(device, mwan, currentCfg.version);

  const isMwanComment = (c?: string) => Boolean(c && c.includes(MWAN_TAG));

  const preservedRoutes = currentCfg.routes.filter((r) => !isMwanComment(r.comment));
  const removedMwanRoutes = currentCfg.routes.length - preservedRoutes.length;

  const preservedMangle = (currentCfg.firewall.mangleRules || []).filter((m) => !isMwanComment(m.comment));
  const removedMwanMangle = (currentCfg.firewall.mangleRules || []).length - preservedMangle.length;

  const preservedNat = currentCfg.firewall.natRules.filter((n) => !isMwanComment(n.comment));
  const preservedAddrList = (currentCfg.firewall.addressLists || []).filter((a) => !isMwanComment(a.comment));
  const preservedTables = (currentCfg.routingTables || []).filter(
    (t) => t.name === 'main' || !isMwanComment(t.comment)
  );
  const preservedIps = currentCfg.ipAddresses.filter(
    (ip) => !isMwanComment(ip.comment) && !mwan.wans.some((w) => w.physicalInterface === ip.interface)
  );

  // Merge Mangle rules: Multi-WAN rules first, then preserved custom user rules re-indexed
  const combinedMangle: MangleRule[] = [
    ...artifacts.mangleRules,
    ...preservedMangle.map((m, idx) => ({
      ...m,
      order: artifacts.mangleRules.length + idx,
    })),
  ];

  // Update interface comments
  const updatedInterfaces = currentCfg.interfaces.map((iface) => {
    if (artifacts.interfaceComments[iface.name]) {
      return {
        ...iface,
        comment: artifacts.interfaceComments[iface.name],
      };
    }
    return iface;
  });

  // Update interface list members (WAN vs LAN)
  const wanIfaceSet = new Set(mwan.wans.map((w) => w.physicalInterface));
  const updatedListMembers = device.interfaces.map((iface, idx) => ({
    id: `ifm-mwan-${idx + 1}`,
    list: wanIfaceSet.has(iface.name) ? 'WAN' : 'LAN',
    interface: iface.name,
  }));

  const nextConfig: RouterOsDeviceConfig = {
    ...currentCfg,
    interfaces: updatedInterfaces,
    interfaceListMembers: updatedListMembers,
    ipAddresses: [...artifacts.ipAddresses, ...preservedIps],
    routingTables: [
      ...preservedTables,
      ...artifacts.routingTables.filter((rt) => !preservedTables.some((p) => p.name === rt.name)),
    ],
    routes: [...artifacts.routes, ...preservedRoutes],
    firewall: {
      ...currentCfg.firewall,
      addressLists: [...artifacts.addressLists, ...preservedAddrList],
      mangleRules: combinedMangle,
      natRules: [...artifacts.natRules, ...preservedNat],
    },
    multiWanConfig: {
      ...mwan,
      lastAppliedAt: new Date().toISOString(),
    },
    lastModifiedAt: new Date().toISOString(),
  };

  return {
    nextConfig,
    artifacts,
    summary: {
      addedRoutes: artifacts.routes.length,
      removedMwanRoutes,
      addedMangleRules: artifacts.mangleRules.length,
      removedMwanMangleRules: removedMwanMangle,
      addedNatRules: artifacts.natRules.length,
      addedRoutingTables: currentCfg.version === 'v7' ? artifacts.routingTables.length : 0,
      preservedCustomRules: preservedMangle.length + preservedRoutes.length,
    },
  };
}

export function previewMultiWanDryRun(
  device: NetworkDevice,
  mwan: MultiWanConfigState
): MultiWanDryRunPreview {
  const issues = validateMultiWanConfig(device, mwan);
  const hasBlockingError = issues.some((i) => i.severity === 'error');
  const currentRsc = RouterOsConfigService.exportRscScript(device);

  const { nextConfig, artifacts, summary } = buildMergedConfigWithMultiWan(device, mwan);
  const nextDevice: NetworkDevice = { ...device, routerOsConfig: nextConfig };
  const nextRsc = RouterOsConfigService.exportRscScript(nextDevice);

  const diffLines = RouterOsConfigService.computeConfigDiff(currentRsc, nextRsc);

  return {
    valid: !hasBlockingError,
    issues,
    summary,
    diffLines,
    generatedScript: artifacts.cliScript,
  };
}

export function applyMultiWanToDevice(
  device: NetworkDevice,
  mwan: MultiWanConfigState
): MutationResult {
  const issues = validateMultiWanConfig(device, mwan);
  const blocking = issues.find((i) => i.severity === 'error');
  if (blocking) {
    return {
      success: false,
      error: `Validasi gagal: ${blocking.title} — ${blocking.message}`,
    };
  }

  // Automatically create a pre-apply snapshot for instant rollback safety
  const currentCfg = RouterOsConfigService.ensureConfig(device);
  const autoBackup: RouterOsBackupSnapshot = {
    id: `mwan-snap-${Date.now()}`,
    name: `pre-mwan-${mwan.activeTemplate}-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.backup`,
    createdAt: new Date().toISOString(),
    routerOsVersion: currentCfg.version,
    sizeBytes: JSON.stringify(currentCfg).length,
    description: `Auto-snapshot sebelum apply Multi-WAN (${mwan.activeTemplate.toUpperCase()}, ${mwan.wans.length} WAN)`,
    serializedConfig: JSON.stringify({ ...currentCfg, backups: [] }),
  };

  const applyEvent: MultiWanEventLog = {
    id: `evt-apply-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: 'CONFIG_APPLY',
    message: `Applied ${mwan.activeTemplate.toUpperCase()} configuration (${mwan.wans.length} WANs) to ${device.name} [RouterOS ${currentCfg.version}].`,
    routeAction: `Generated ${mwan.wans.length} WAN tables, Mangle PBR/PCC rules, and NAT masquerade.`,
  };

  const updatedMwan: MultiWanConfigState = {
    ...mwan,
    events: [applyEvent, ...(mwan.events || []).slice(0, 49)],
    lastAppliedAt: new Date().toISOString(),
  };

  const { nextConfig, summary } = buildMergedConfigWithMultiWan(device, updatedMwan);
  nextConfig.backups = [autoBackup, ...(currentCfg.backups || []).slice(0, 14)];

  return {
    success: true,
    config: nextConfig,
    message: `Berhasil menerapkan Multi-WAN (${mwan.activeTemplate.toUpperCase()}): ${summary.addedMangleRules} Mangle rules, ${summary.addedRoutes} IP Routes, dan ${summary.addedNatRules} NAT rules telah aktif di ${device.name}.`,
  };
}

export function createMultiWanSnapshot(
  device: NetworkDevice,
  customLabel?: string
): MutationResult {
  const label =
    customLabel?.trim() ||
    `mwan-snapshot-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.backup`;
  return RouterOsConfigService.createBackup(device, label);
}

export function rollbackMultiWanSnapshot(
  device: NetworkDevice,
  snapshotIdOrName: string
): MutationResult {
  return RouterOsConfigService.restoreBackup(device, snapshotIdOrName);
}

// ==========================================
// 10 MULTI-WAN SIMULATION SCENARIOS & TELEMETRY
// ==========================================

export const MULTIWAN_SIMULATION_SCENARIOS: Array<{
  id: MultiWanSimulationScenarioId;
  number: number;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: 'all-normal',
    number: 1,
    label: '1. Semua WAN Normal',
    shortLabel: 'All Normal',
    description: 'Seluruh link fisik UP, gateway reachable, dan target internet recursive merespons normal.',
  },
  {
    id: 'wan1-down',
    number: 2,
    label: '2. WAN1 Down (Link Putus)',
    shortLabel: 'WAN1 Down',
    description: 'Link fisik WAN1 terputus. Trafik otomatis failover ke WAN2 / didistribusikan ulang ke WAN sehat.',
  },
  {
    id: 'wan2-down',
    number: 3,
    label: '3. WAN2 Down (Link Putus)',
    shortLabel: 'WAN2 Down',
    description: 'Link fisik WAN2 terputus. Koneksi WAN2 dialihkan ke WAN aktif lainnya.',
  },
  {
    id: 'wan3-down',
    number: 4,
    label: '4. WAN3 Down (Link Putus)',
    shortLabel: 'WAN3 Down',
    description: 'Link WAN3 / Backup mengalami gangguan fisik (carrier down).',
  },
  {
    id: 'two-wans-down',
    number: 5,
    label: '5. Dua WAN Down (WAN1 + WAN2 Down)',
    shortLabel: '2 WANs Down',
    description: 'WAN1 dan WAN2 mati bersamaan; menguji apakah trafik bertahan melalui WAN3 (Tertiary Backup).',
  },
  {
    id: 'all-wans-down',
    number: 6,
    label: '6. Semua WAN Down (Total Outage)',
    shortLabel: 'All WANs Down',
    description: 'Seluruh koneksi ISP terputus. Semua route default menjadi inactive dan trafik internet drop.',
  },
  {
    id: 'wan-recovery',
    number: 7,
    label: '7. WAN Recovery (Failback Otomatis)',
    shortLabel: 'WAN Recovery',
    description: 'WAN utama yang sebelumnya down kembali pulih (RECOVERING -> UP) dan mengambil alih route utama.',
  },
  {
    id: 'wan-overload',
    number: 8,
    label: '8. WAN Overload (Kongesti Tinggi)',
    shortLabel: 'WAN Overload',
    description: 'Lonjakan beban trafik melampaui kapasitas WAN1 menyebabkan antrean penuh, lonjakan latency, dan packet loss.',
  },
  {
    id: 'gateway-up-internet-down',
    number: 9,
    label: '9. Gateway Reachable tapi Internet Mati (Recursive Route Test)',
    shortLabel: 'Recursive Test',
    description:
      'Modem/Gateway WAN1 tetap bisa di-ping lokal, tetapi koneksi upstream ISP ke internet (8.8.8.8) mati.',
  },
  {
    id: 'isp-bandwidth-change',
    number: 10,
    label: '10. Perubahan Bandwidth ISP (Throttling / Upgrade)',
    shortLabel: 'ISP BW Change',
    description: 'Kapasitas bandwidth ISP berubah dinamis di tengah operasi (menguji adaptasi rasio Weighted PCC & utilisasi).',
  },
];

export function applySimulationScenarioToMultiWan(
  mwan: MultiWanConfigState,
  scenarioId: MultiWanSimulationScenarioId
): MultiWanConfigState {
  const now = new Date().toISOString();
  const nextEvents = [...(mwan.events || [])];

  const logEvt = (
    type: MultiWanEventLog['type'],
    message: string,
    wan?: MultiWanInterfaceConfig,
    routeAction?: string
  ) => {
    nextEvents.unshift({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      type,
      wanId: wan?.id,
      wanName: wan?.name,
      message,
      routeAction,
    });
  };

  let demandDown = mwan.simulatedTotalDemandDownMbps || 280;
  let demandUp = mwan.simulatedTotalDemandUpMbps || 95;
  let activeConns = mwan.simulatedActiveConnections || 420;

  const updatedWans: MultiWanInterfaceConfig[] = mwan.wans.map((w, idx) => {
    // Reset to baseline healthy first
    const base: MultiWanInterfaceConfig = {
      ...w,
      linkState: 'UP',
      gatewayState: 'REACHABLE',
      internetState: 'ONLINE',
      serviceState: 'AVAILABLE',
      operationalStatus: 'UP',
      isOverloaded: false,
      packetLossPercent: 0,
    };

    switch (scenarioId) {
      case 'all-normal':
        return base;

      case 'wan1-down':
        if (idx === 0) {
          return {
            ...base,
            linkState: 'DOWN',
            gatewayState: 'UNREACHABLE',
            internetState: 'OFFLINE',
            serviceState: 'UNAVAILABLE',
            operationalStatus: 'DOWN',
            packetLossPercent: 100,
          };
        }
        return base;

      case 'wan2-down':
        if (idx === 1) {
          return {
            ...base,
            linkState: 'DOWN',
            gatewayState: 'UNREACHABLE',
            internetState: 'OFFLINE',
            serviceState: 'UNAVAILABLE',
            operationalStatus: 'DOWN',
            packetLossPercent: 100,
          };
        }
        return base;

      case 'wan3-down':
        if (idx === 2 || (idx === mwan.wans.length - 1 && mwan.wans.length >= 3)) {
          return {
            ...base,
            linkState: 'DOWN',
            gatewayState: 'UNREACHABLE',
            internetState: 'OFFLINE',
            serviceState: 'UNAVAILABLE',
            operationalStatus: 'DOWN',
            packetLossPercent: 100,
          };
        }
        return base;

      case 'two-wans-down':
        if (idx === 0 || idx === 1) {
          return {
            ...base,
            linkState: 'DOWN',
            gatewayState: 'UNREACHABLE',
            internetState: 'OFFLINE',
            serviceState: 'UNAVAILABLE',
            operationalStatus: 'DOWN',
            packetLossPercent: 100,
          };
        }
        return base;

      case 'all-wans-down':
        return {
          ...base,
          linkState: 'DOWN',
          gatewayState: 'UNREACHABLE',
          internetState: 'OFFLINE',
          serviceState: 'UNAVAILABLE',
          operationalStatus: 'DOWN',
          packetLossPercent: 100,
        };

      case 'wan-recovery':
        if (idx === 0) {
          return {
            ...base,
            linkState: 'UP',
            gatewayState: 'REACHABLE',
            internetState: 'ONLINE',
            serviceState: 'AVAILABLE',
            operationalStatus: 'RECOVERING',
          };
        }
        return base;

      case 'wan-overload':
        if (idx === 0) {
          return {
            ...base,
            isOverloaded: true,
            serviceState: 'DEGRADED',
            operationalStatus: 'DEGRADED',
            packetLossPercent: 6.5,
          };
        }
        return base;

      case 'gateway-up-internet-down':
        if (idx === 0) {
          // Crucial test: Physical link is UP and local ISP Gateway responds to ping,
          // but upstream internet (8.8.8.8) is unreachable!
          const isRecursive =
            base.healthCheckMethod === 'recursive-route' ||
            base.healthCheckMethod === 'external-target';
          return {
            ...base,
            linkState: 'UP',
            gatewayState: 'REACHABLE',
            internetState: 'OFFLINE',
            serviceState: 'UNAVAILABLE',
            operationalStatus: isRecursive ? 'DOWN' : 'DEGRADED',
            packetLossPercent: 100,
          };
        }
        return base;

      case 'isp-bandwidth-change':
        if (idx === 0) {
          // Simulate ISP1 degraded bandwidth from 300M -> 100M while ISP2 upgraded to 400M
          return {
            ...base,
            downloadMbps: 100,
            uploadMbps: 100,
            cirMbps: 80,
          };
        }
        if (idx === 1) {
          return {
            ...base,
            downloadMbps: 400,
            uploadMbps: 200,
            cirMbps: 200,
          };
        }
        return base;

      default:
        return base;
    }
  });

  if (scenarioId === 'wan-overload') {
    demandDown = Math.round(
      updatedWans.reduce((acc, w) => acc + w.downloadMbps, 0) * 0.92
    );
    demandUp = Math.round(
      updatedWans.reduce((acc, w) => acc + w.uploadMbps, 0) * 0.85
    );
    activeConns = 1280;
  } else if (scenarioId === 'all-normal' || scenarioId === 'wan-recovery') {
    demandDown = 280;
    demandUp = 95;
    activeConns = 420;
  }

  // Generate descriptive failover/recovery logs
  const w1 = updatedWans[0];
  const w2 = updatedWans[1];
  const w3 = updatedWans[2];

  if (scenarioId === 'wan1-down' && w1) {
    logEvt(
      'FAILOVER',
      `[${w1.name}] Link/Gateway DOWN pada ${w1.physicalInterface}. Failover diaktifkan ke ${w2?.name || 'Backup WAN'}.`,
      w1,
      `Route via ${w1.gateway} (dist=${w1.distance}) marked INACTIVE -> Active route switched to ${w2?.name || 'WAN2'}`
    );
  } else if (scenarioId === 'wan2-down' && w2) {
    logEvt(
      'FAILOVER',
      `[${w2.name}] Link DOWN pada ${w2.physicalInterface}. Sesi PCC/Backup dialihkan ke ${w1?.name || 'WAN1'}${w3 ? ` & ${w3.name}` : ''}.`,
      w2,
      `Table to-${w2.name} switched to backup route via ${w1?.gateway || 'WAN1'}`
    );
  } else if (scenarioId === 'wan3-down' && w3) {
    logEvt(
      'FAILOVER',
      `[${w3.name}] Link DOWN pada ${w3.physicalInterface}. Jalur backup tersier tidak tersedia.`,
      w3,
      `Route via ${w3.gateway} marked INACTIVE`
    );
  } else if (scenarioId === 'two-wans-down') {
    logEvt(
      'FAILOVER',
      `CRITICAL: ${w1?.name} & ${w2?.name} mengalami gangguan bersamaan!`,
      w1,
      w3
        ? `Emergency Failover aktif ke ${w3.name} (${w3.ispProviderName}, dist=${w3.distance})`
        : `Tidak ada WAN tersisa! Tambahkan WAN3 untuk redundansi 2-WAN failure.`
    );
  } else if (scenarioId === 'all-wans-down') {
    logEvt(
      'FAILOVER',
      `TOTAL WAN OUTAGE: Seluruh link WAN (${updatedWans.map((w) => w.name).join(', ')}) terputus!`,
      w1,
      `All 0.0.0.0/0 routes INACTIVE -> ICMP Destination Net Unreachable`
    );
  } else if (scenarioId === 'wan-recovery' && w1) {
    logEvt(
      'RECOVERY',
      `[${w1.name}] Health check target ${w1.healthCheckTarget} kembali merespons (0% loss). Failback otomatis ke ${w1.name}.`,
      w1,
      `Route via ${w1.gateway} (dist=1) restored to ACTIVE primary route`
    );
  } else if (scenarioId === 'wan-overload' && w1) {
    logEvt(
      'DEGRADED',
      `[${w1.name}] Kongesti tinggi terdeteksi! Utilisasi mendekati 100%, latency naik dan packet loss 6.5%.`,
      w1,
      `QoS / Weighted PCC menyarankan distribusi beban ke ${w2?.name || 'WAN2'}`
    );
  } else if (scenarioId === 'gateway-up-internet-down' && w1) {
    const isRecursive =
      w1.healthCheckMethod === 'recursive-route' || w1.healthCheckMethod === 'external-target';
    logEvt(
      isRecursive ? 'FAILOVER' : 'DEGRADED',
      isRecursive
        ? `[Recursive Route Triggered] Gateway lokal ${w1.gateway} UP, namun host recursive ${w1.healthCheckTarget} TIMEOUT! Router mendeteksi gangguan upstream ISP dan memindahkan route ke ${w2?.name || 'WAN2'}.`
        : `[WARNING: Blackhole] Gateway ${w1.gateway} masih bisa di-ping sehingga Simple Gateway Check menganggap ${w1.name} UP, padahal internet upstream mati! Ubah ke Recursive Route.`,
      w1,
      isRecursive
        ? `Recursive nexthop ${w1.healthCheckTarget} unreachable -> Failover to ${w2?.name || 'WAN2'}`
        : `Route tetap di ${w1.name} (Silent Packet Drop!)`
    );
  } else if (scenarioId === 'isp-bandwidth-change') {
    const newRatio = calculateWeightedPccRatios(updatedWans, true);
    logEvt(
      'SIMULATION',
      `Perubahan kapasitas ISP terdeteksi (${w1?.name}: 100M, ${w2?.name}: 400M). Rasio Weighted PCC otomatis dikalkulasi ulang menjadi ${newRatio.ratioLabel}.`,
      w1,
      `Weighted PCC buckets updated (${newRatio.totalStreams} streams)`
    );
  } else {
    logEvt('RECOVERY', `Semua jalur WAN beroperasi normal (All Healthy).`);
  }

  return {
    ...mwan,
    wans: updatedWans,
    activeScenario: scenarioId,
    simulatedTotalDemandDownMbps: demandDown,
    simulatedTotalDemandUpMbps: demandUp,
    simulatedActiveConnections: activeConns,
    events: nextEvents.slice(0, 50),
  };
}

// ==========================================
// REAL-TIME TELEMETRY & TRAFFIC DISTRIBUTION CALCULATOR
// ==========================================

export function calculateMultiWanTelemetry(
  mwan: MultiWanConfigState
): MultiWanDashboardTelemetry {
  const sortedWans = [...mwan.wans].sort((a, b) => a.priority - b.priority);
  const weightedInfo = calculateWeightedPccRatios(sortedWans, mwan.useAutoBandwidthWeight);

  // Determine which WANs are currently carrying traffic based on template & health
  const healthMap = new Map<
    string,
    { status: WanOperationalState; reason: string; canRouteTraffic: boolean }
  >();
  sortedWans.forEach((w) => {
    healthMap.set(w.id, evaluateWanOperationalStatus(w, mwan.failoverCheckMethod));
  });

  const routableWans = sortedWans.filter((w) => healthMap.get(w.id)?.canRouteTraffic);

  // Compute raw traffic share weight for each WAN
  const shareWeights = new Map<string, number>();
  sortedWans.forEach((w) => shareWeights.set(w.id, 0));

  if (routableWans.length > 0) {
    if (mwan.activeTemplate === 'failover') {
      // Only the highest-priority (lowest distance) routable WAN carries primary traffic
      const activePrimary = routableWans[0];
      shareWeights.set(activePrimary.id, 100);
    } else if (mwan.activeTemplate === 'load-balancing') {
      // Primary + Secondary WANs carry load, or if all primary/secondary are down, fallback to backup WANs
      const activePool = routableWans.filter((w) => w.role !== 'backup');
      const effectivePool = activePool.length > 0 ? activePool : routableWans;

      if (mwan.loadBalancingMethod === 'weighted-pcc') {
        effectivePool.forEach((w) => {
          shareWeights.set(w.id, weightedInfo.ratios[w.id] || 1);
        });
      } else {
        effectivePool.forEach((w) => {
          shareWeights.set(w.id, 1);
        });
      }
    } else {
      // Hybrid: aggregate traffic share across enabled policies
      const enabledPolicies = mwan.hybridPolicies.filter((p) => p.enabled);
      if (enabledPolicies.length === 0) {
        shareWeights.set(routableWans[0].id, 100);
      } else {
        enabledPolicies.forEach((pol) => {
          const prefRoutable = pol.preferredWanIds
            .map((id) => sortedWans.find((w) => w.id === id))
            .filter((w): w is MultiWanInterfaceConfig =>
              Boolean(w && healthMap.get(w.id)?.canRouteTraffic)
            );

          if (prefRoutable.length > 0) {
            if (pol.routingMode === 'failover') {
              const target = prefRoutable[0];
              shareWeights.set(target.id, (shareWeights.get(target.id) || 0) + 35);
            } else if (pol.routingMode === 'weighted-pcc') {
              prefRoutable.forEach((w) => {
                const ratio = weightedInfo.ratios[w.id] || 1;
                shareWeights.set(w.id, (shareWeights.get(w.id) || 0) + ratio * 15);
              });
            } else {
              const perWan = 35 / prefRoutable.length;
              prefRoutable.forEach((w) => {
                shareWeights.set(w.id, (shareWeights.get(w.id) || 0) + perWan);
              });
            }
          } else {
            // Preferred WANs are down -> use first routable backup WAN!
            const backupRoutable = pol.backupWanIds
              .map((id) => sortedWans.find((w) => w.id === id))
              .find((w) => w && healthMap.get(w.id)?.canRouteTraffic);
            const fallback = backupRoutable || routableWans[0];
            if (fallback) {
              shareWeights.set(fallback.id, (shareWeights.get(fallback.id) || 0) + 35);
            }
          }
        });
      }
    }
  }

  const totalWeight = Array.from(shareWeights.values()).reduce((a, b) => a + b, 0);
  const totalDemandDown = mwan.simulatedTotalDemandDownMbps || 280;
  const totalDemandUp = mwan.simulatedTotalDemandUpMbps || 95;
  const totalConns = mwan.simulatedActiveConnections || 420;

  const wanMetrics: WanTelemetryMetrics[] = sortedWans.map((w) => {
    const h = healthMap.get(w.id)!;
    const rawWeight = shareWeights.get(w.id) || 0;
    const shareFraction = totalWeight > 0 ? rawWeight / totalWeight : 0;
    const packetSharePercent = Math.round(shareFraction * 100);
    const isActiveRoute = shareFraction > 0 && h.canRouteTraffic;

    // If simple gateway check failed to detect upstream internet outage, traffic routed here is blackholed (0 delivered)
    const isSilentBlackhole = w.internetState === 'OFFLINE' && h.canRouteTraffic;

    const demandedDown = totalDemandDown * shareFraction;
    const demandedUp = totalDemandUp * shareFraction;

    const currentDownloadMbps = isSilentBlackhole
      ? 0
      : Number(Math.min(w.downloadMbps, demandedDown).toFixed(1));
    const currentUploadMbps = isSilentBlackhole
      ? 0
      : Number(Math.min(w.uploadMbps, demandedUp).toFixed(1));

    const utilizationDownPercent =
      w.downloadMbps > 0
        ? Math.min(100, Math.round((demandedDown / w.downloadMbps) * 100))
        : 0;
    const utilizationUpPercent =
      w.uploadMbps > 0
        ? Math.min(100, Math.round((demandedUp / w.uploadMbps) * 100))
        : 0;

    const activeConnections = isActiveRoute ? Math.round(totalConns * shareFraction) : 0;

    const isCongested = utilizationDownPercent >= 85 || Boolean(w.isOverloaded);
    const effectiveLatencyMs = !h.canRouteTraffic
      ? 0
      : Number(
          (
            w.latencyMs +
            (isCongested ? (utilizationDownPercent - 75) * 1.4 : 0)
          ).toFixed(1)
        );
    const effectiveJitterMs = !h.canRouteTraffic
      ? 0
      : Number((w.jitterMs + (isCongested ? 4.5 : 0)).toFixed(1));
    const effectivePacketLossPercent =
      !h.canRouteTraffic || isSilentBlackhole
        ? 100
        : Number(
            Math.min(
              100,
              w.packetLossPercent +
                (demandedDown > w.downloadMbps
                  ? ((demandedDown - w.downloadMbps) / demandedDown) * 100
                  : 0)
            ).toFixed(1)
          );

    return {
      wanId: w.id,
      wanName: w.name,
      physicalInterface: w.physicalInterface,
      ispProviderName: w.ispProviderName,
      role: w.role,
      operationalStatus: h.status,
      linkState: w.linkState,
      gatewayState: w.gatewayState,
      internetState: w.internetState,
      serviceState: isCongested && h.status === 'UP' ? 'DEGRADED' : w.serviceState,
      isActiveRoute,
      downloadCapacityMbps: w.downloadMbps,
      uploadCapacityMbps: w.uploadMbps,
      cirMbps: w.cirMbps,
      currentDownloadMbps,
      currentUploadMbps,
      utilizationDownPercent,
      utilizationUpPercent,
      activeConnections,
      packetSharePercent,
      effectiveLatencyMs,
      effectiveJitterMs,
      effectivePacketLossPercent,
      weightRatio: weightedInfo.ratios[w.id] || 1,
      pccMatchers: weightedInfo.bucketsByWanId[w.id] || [],
      statusReason: h.reason,
    };
  });

  const activeNames = wanMetrics.filter((m) => m.isActiveRoute).map((m) => m.wanName);
  const downCount = wanMetrics.filter((m) => m.operationalStatus === 'DOWN').length;
  const degradedCount = wanMetrics.filter((m) => m.operationalStatus === 'DEGRADED').length;

  let overallStatus: MultiWanDashboardTelemetry['overallStatus'] = 'HEALTHY';
  if (routableWans.length === 0) {
    overallStatus = 'OUTAGE';
  } else if (downCount > 0) {
    overallStatus = 'FAILOVER_ACTIVE';
  } else if (degradedCount > 0) {
    overallStatus = 'DEGRADED';
  }

  const activeRouteSummary =
    activeNames.length === 0
      ? 'No Active Route (All WANs Down)'
      : mwan.activeTemplate === 'failover'
      ? `Active Primary Path: ${activeNames[0]} (Backup: ${wanMetrics
          .filter((m) => !m.isActiveRoute && m.operationalStatus !== 'DOWN')
          .map((m) => m.wanName)
          .join(', ') || 'None'})`
      : `Active Multi-WAN Pool: ${activeNames.join(' + ')}`;

  return {
    wans: wanMetrics,
    totalCapacityDownMbps: wanMetrics
      .filter((m) => m.operationalStatus !== 'DOWN')
      .reduce((acc, m) => acc + m.downloadCapacityMbps, 0),
    totalCapacityUpMbps: wanMetrics
      .filter((m) => m.operationalStatus !== 'DOWN')
      .reduce((acc, m) => acc + m.uploadCapacityMbps, 0),
    totalThroughputDownMbps: Number(
      wanMetrics.reduce((acc, m) => acc + m.currentDownloadMbps, 0).toFixed(1)
    ),
    totalThroughputUpMbps: Number(
      wanMetrics.reduce((acc, m) => acc + m.currentUploadMbps, 0).toFixed(1)
    ),
    totalActiveConnections: wanMetrics.reduce((acc, m) => acc + m.activeConnections, 0),
    overallStatus,
    activeRouteSummary,
    weightedRatioSummary: weightedInfo.ratioLabel,
  };
}
