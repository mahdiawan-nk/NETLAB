import { z } from 'zod';

export type RouterOsVersion = 'v6' | 'v7';

// ==========================================
// 1. Interfaces & Physical / Logical Ports
// ==========================================

export interface RouterOsInterface {
  id: string; // e.g., "*1", "*2" or port id
  name: string; // e.g., "ether1", "sfp-sfpplus1", "bridge1"
  type: 'ethernet' | 'sfp' | 'sfp-plus' | 'vlan' | 'bridge';
  disabled: boolean;
  running: boolean;
  mtu: number;
  actualMtu: number;
  macAddress: string;
  comment?: string;
  linkSpeed?: string;
}

// ==========================================
// 2. Bridges & Bridge Ports (802.1Q)
// ==========================================

export interface RouterOsBridge {
  id: string;
  name: string;
  disabled: boolean;
  vlanFiltering: boolean;
  mtu: number;
  macAddress: string;
  comment?: string;
}

export interface RouterOsBridgePort {
  id: string;
  bridge: string; // Bridge name
  interface: string; // Member interface name
  pvid: number;
  disabled: boolean;
  comment?: string;
}

// ==========================================
// 3. VLAN Interfaces (802.1Q Tagged)
// ==========================================

export interface RouterOsVlan {
  id: string;
  name: string; // e.g., "vlan20-staff"
  vlanId: number; // 1-4094
  interface: string; // Parent interface e.g. "bridge1" or "ether1"
  disabled: boolean;
  comment?: string;
}

// ==========================================
// 4. IP Addresses & Subnets
// ==========================================

export interface RouterOsIpAddress {
  id: string;
  address: string; // e.g. "192.168.88.1/24"
  network: string; // e.g. "192.168.88.0"
  interface: string; // Target interface e.g. "ether1", "bridge1"
  disabled: boolean;
  invalid?: boolean;
  dynamic?: boolean;
  comment?: string;
}

// ==========================================
// 5. IP Routing Table
// ==========================================

export interface RouterOsRoute {
  id: string;
  dstAddress: string; // e.g. "0.0.0.0/0", "10.0.0.0/8"
  gateway: string; // e.g. "192.168.88.254" or "ether1"
  distance: number; // default 1
  scope: number; // default 30
  targetScope: number; // default 10
  checkGateway?: 'ping' | 'arp' | 'none';
  disabled: boolean;
  active: boolean;
  routingTable?: string; // v7 routing table or "main"
  routingMark?: string; // v6 routing mark
  comment?: string;
}

// ==========================================
// 6. IP Pools & DHCP Server
// ==========================================

export interface RouterOsIpPool {
  id: string;
  name: string; // e.g. "pool-students"
  ranges: string; // e.g. "192.168.88.100-192.168.88.200"
}

export interface RouterOsDhcpServer {
  id: string;
  name: string;
  interface: string;
  addressPool: string; // Pool name
  leaseTime: string; // e.g. "1d", "10m"
  disabled: boolean;
  authoritative?: boolean;
}

export interface RouterOsDhcpNetwork {
  id: string;
  address: string; // e.g. "192.168.88.0/24"
  gateway: string; // e.g. "192.168.88.1"
  dnsServers: string[]; // e.g. ["8.8.8.8", "1.1.1.1"]
  comment?: string;
}

// ==========================================
// 7. IP DNS & Cache
// ==========================================

export interface RouterOsDnsStaticEntry {
  id: string;
  name: string; // FQDN e.g. "router.lan"
  address: string; // IP e.g. "192.168.88.1"
  ttl?: string;
  disabled?: boolean;
}

export interface RouterOsDnsConfig {
  servers: string[]; // Upstream DNS servers
  allowRemoteRequests: boolean;
  cacheSizeKb: number;
  staticEntries: RouterOsDnsStaticEntry[];
}

// ==========================================
// 8. IP Firewall: Filter, NAT, Mangle & Address Lists
// ==========================================

export type MangleChain = 'prerouting' | 'input' | 'forward' | 'output' | 'postrouting';

export type MangleAction =
  | 'accept'
  | 'add-src-to-address-list'
  | 'add-dst-to-address-list'
  | 'change-dscp'
  | 'change-mss'
  | 'change-ttl'
  | 'mark-connection'
  | 'mark-packet'
  | 'mark-routing'
  | 'passthrough'
  | 'return'
  | 'log';

export interface MangleRule {
  id: string;
  order: number;
  disabled: boolean;
  invalid: boolean;
  invalidReason?: string;
  dynamic?: boolean;

  // General
  chain: MangleChain;
  srcAddress?: string; // IP, CIDR, or !IP/CIDR
  dstAddress?: string;
  protocol?: string; // tcp, udp, icmp, gre, ipsec-esp, all
  srcPort?: string;
  dstPort?: string;
  inInterface?: string;
  outInterface?: string;
  inInterfaceList?: string;
  outInterfaceList?: string;

  // Advanced
  srcAddressList?: string;
  dstAddressList?: string;
  connectionState?: string; // e.g. "new", "established,related"
  connectionMark?: string;
  packetMark?: string;
  routingMark?: string;
  packetLength?: string; // e.g. "0-128"
  packetSize?: string; // alias for packetLength
  dscp?: number | string; // 0-63
  priority?: number | string; // 0-7
  pcc?: string; // Per Connection Classifier e.g. "both-addresses:2/0"
  perConnectionClassifier?: string; // alias for pcc

  // Extra
  limit?: string; // e.g. "10/1s,5:packet"
  time?: string; // e.g. "08:00:00-17:00:00,mon,tue,wed,thu,fri"
  layer7Protocol?: string; // RouterOS v6 only
  connectionBytes?: string; // e.g. "500000-0"
  connectionRate?: string; // e.g. "2M-100M"

  // Action & Action Parameters
  action: MangleAction;
  newConnectionMark?: string;
  newPacketMark?: string;
  newRoutingMark?: string;
  addressList?: string;
  addressListTimeout?: string;
  newDscp?: number | string;
  newMss?: number | string;
  newTtl?: number | string;
  log?: boolean;
  logPrefix?: string;
  passthrough: boolean;

  // Metadata & Counters
  comment?: string;
  bytes: number;
  packets: number;
  createdAt: string;
  updatedAt: string;
}

export interface RouterOsAddressListEntry {
  id: string;
  list: string; // e.g. "LAN-SUBNETS", "STUDENT-LIST", "BLOCKED-IPS"
  address: string; // IP or CIDR e.g. "10.20.0.0/24"
  timeout?: string; // e.g. "1h", "00:30:00"
  dynamic?: boolean;
  disabled: boolean;
  comment?: string;
  creationTime?: string;
}

export interface RouterOsInterfaceList {
  id: string;
  name: string; // e.g. "WAN", "LAN"
  comment?: string;
}

export interface RouterOsInterfaceListMember {
  id: string;
  list: string; // e.g. "WAN"
  interface: string; // e.g. "ether1"
  disabled?: boolean;
}

export interface RouterOsRoutingTable {
  id: string;
  name: string; // e.g. "main", "to-ISP1", "to-ISP2"
  fib: boolean;
  disabled: boolean;
  dynamic?: boolean;
  comment?: string;
}

export interface RouterOsConnectionTrackingEntry {
  id: string;
  protocol: string;
  srcAddress: string;
  dstAddress: string;
  srcPort?: string;
  dstPort?: string;
  connectionState: 'new' | 'established' | 'related';
  connectionMark?: string;
  packetMark?: string;
  routingMark?: string;
  timeout: string;
  bytes: number;
  packets: number;
  updatedAt: string;
}

export interface RouterOsFirewallFilterRule {
  id: string;
  chain: 'input' | 'forward' | 'output';
  action: 'accept' | 'drop' | 'reject' | 'passthrough' | 'log';
  protocol?: 'tcp' | 'udp' | 'icmp' | 'gre' | 'ipsec-esp' | 'all';
  srcAddress?: string; // CIDR or IP
  dstAddress?: string;
  srcPort?: string;
  dstPort?: string;
  inInterface?: string;
  outInterface?: string;
  srcAddressList?: string;
  dstAddressList?: string;
  connectionState?: string; // e.g. "established,related"
  connectionMark?: string;
  packetMark?: string;
  routingMark?: string;
  disabled: boolean;
  comment?: string;
  bytesCount?: number;
  packetsCount?: number;
}

export interface RouterOsFirewallNatRule {
  id: string;
  chain: 'srcnat' | 'dstnat';
  action: 'masquerade' | 'src-nat' | 'dst-nat' | 'redirect';
  outInterface?: string;
  inInterface?: string;
  srcAddress?: string;
  dstAddress?: string;
  srcAddressList?: string;
  dstAddressList?: string;
  connectionMark?: string;
  packetMark?: string;
  routingMark?: string;
  protocol?: 'tcp' | 'udp' | 'all';
  dstPort?: string;
  toAddresses?: string;
  toPorts?: string;
  disabled: boolean;
  comment?: string;
  bytesCount?: number;
  packetsCount?: number;
}

// ==========================================
// 9. Simple Queues & Queue Tree (QoS Bandwidth Shaping)
// ==========================================

export interface RouterOsSimpleQueue {
  id: string;
  name: string;
  target: string; // IP or CIDR e.g. "192.168.88.0/24"
  maxLimitUploadBps: number; // in bps (e.g. 10_000_000 = 10M)
  maxLimitDownloadBps: number;
  burstLimitUploadBps?: number;
  burstLimitDownloadBps?: number;
  burstThresholdUploadBps?: number;
  burstThresholdDownloadBps?: number;
  burstTimeSeconds?: number;
  packetMarks?: string; // Matches packet-mark from Mangle
  priority?: number; // 1 (highest) to 8 (lowest)
  disabled: boolean;
  comment?: string;
}

export interface RouterOsQueueTree {
  id: string;
  name: string;
  parent: string; // e.g. "global" or interface name
  packetMark: string; // Matches packet-mark from Mangle
  limitAtBps?: number;
  maxLimitBps: number;
  priority: number; // 1 to 8
  disabled: boolean;
  comment?: string;
  bytes?: number;
  packets?: number;
}

// ==========================================
// 10. System Identity & Simulated Resources
// ==========================================

export interface RouterOsSystemIdentity {
  name: string; // System hostname e.g. "CORE-CCR2116"
}

export interface RouterOsSystemResource {
  uptimeSeconds: number;
  version: string; // e.g. "7.14.3" or "6.49.10"
  buildTime: string;
  factorySoftware?: string;
  freeMemoryBytes: number;
  totalMemoryBytes: number;
  cpuModel: string;
  cpuCount: number;
  cpuFrequencyMhz: number;
  cpuLoadPercent: number;
  freeHddSpaceBytes: number;
  totalHddSpaceBytes: number;
  architecture: string;
  boardName: string;
}

// ==========================================
// 11. Configuration Backups & Change Snapshots
// ==========================================

export interface RouterOsBackupSnapshot {
  id: string;
  name: string;
  createdAt: string;
  routerOsVersion: RouterOsVersion;
  sizeBytes: number;
  description?: string;
  serializedConfig: string;
}

// ==========================================
// 11B. Multi-WAN Configuration Manager & Telemetry
// ==========================================

export type MultiWanTemplateType = 'failover' | 'load-balancing' | 'hybrid';
export type WanConnectionType = 'dhcp' | 'static' | 'pppoe';
export type WanRole = 'primary' | 'secondary' | 'backup';
export type WanHealthCheckMethod = 'simple-gateway' | 'recursive-route' | 'external-target';
export type WanOperationalState = 'UP' | 'DOWN' | 'DEGRADED' | 'RECOVERING';

export type LoadBalancingMethod =
  | 'pcc-both-addresses'
  | 'pcc-both-addresses-and-ports'
  | 'pcc-src-address'
  | 'pcc-dst-address'
  | 'ecmp'
  | 'weighted-pcc';

export type MultiWanSimulationScenarioId =
  | 'all-normal'
  | 'wan1-down'
  | 'wan2-down'
  | 'wan3-down'
  | 'two-wans-down'
  | 'all-wans-down'
  | 'wan-recovery'
  | 'wan-overload'
  | 'gateway-up-internet-down'
  | 'isp-bandwidth-change';

export interface MultiWanInterfaceConfig {
  id: string;
  name: string; // e.g. "WAN1", "WAN2", "WAN3", "WAN4"
  physicalInterface: string; // e.g. "ether1", "ether2", "sfp-sfpplus1"
  ispProviderName: string; // e.g. "Biznet Dedicated", "IndiHome Fiber", "Starlink"
  connectionType: WanConnectionType;
  ipAddress: string; // e.g. "203.142.80.2/30"
  gateway: string; // e.g. "203.142.80.1"
  pppoeUsername?: string;
  pppoePassword?: string;
  downloadMbps: number;
  uploadMbps: number;
  cirMbps: number;
  contentionRatio: string; // e.g. "1:1", "1:4", "1:8"
  latencyMs: number;
  jitterMs: number;
  packetLossPercent: number;
  role: WanRole;
  priority: number; // 1 = highest priority
  distance: number; // Route distance (1, 2, 3...)
  manualWeight?: number; // Optional manual weight ratio for Weighted PCC
  healthCheckMethod: WanHealthCheckMethod;
  healthCheckTarget: string; // e.g. "8.8.8.8", "1.1.1.1", "9.9.9.9"
  checkIntervalSec: number;
  failThreshold: number;
  recoveryThreshold: number;
  // Multi-layer simulation states
  linkState: 'UP' | 'DOWN';
  gatewayState: 'REACHABLE' | 'UNREACHABLE';
  internetState: 'ONLINE' | 'OFFLINE';
  serviceState: 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE';
  operationalStatus: WanOperationalState;
  isOverloaded?: boolean;
}

export interface HybridPolicyRule {
  id: string;
  name: string; // e.g. "VLAN 20 Lecturer Priority", "Classroom PCC Pool"
  priority: number; // Order 1, 2, 3...
  enabled: boolean;
  policyType: 'vlan' | 'src-address' | 'dst-address' | 'application' | 'custom';
  inInterfaceOrVlan?: string; // e.g. "vlan20", "bridge-lan"
  srcAddress?: string; // e.g. "10.20.0.0/24"
  dstAddress?: string; // e.g. "0.0.0.0/0"
  protocol?: 'tcp' | 'udp' | 'icmp' | 'all';
  dstPort?: string; // e.g. "80,443" or "5060"
  serviceLabel?: string; // e.g. "Web/HTTPS", "VoIP SIP", "Video Zoom"
  routingMode: 'failover' | 'pcc' | 'weighted-pcc';
  pccClassifier?: 'both-addresses' | 'both-addresses-and-ports' | 'src-address' | 'dst-address';
  preferredWanIds: string[]; // Primary WAN(s) used for Failover or PCC group
  backupWanIds: string[]; // Ordered failover WAN IDs if preferred WAN(s) go down
  comment?: string;
}

export interface MultiWanEventLog {
  id: string;
  timestamp: string;
  type: 'FAILOVER' | 'RECOVERY' | 'DEGRADED' | 'CONFIG_APPLY' | 'ROLLBACK' | 'SIMULATION';
  wanId?: string;
  wanName?: string;
  message: string;
  routeAction?: string;
}

export interface MultiWanConfigState {
  activeTemplate: MultiWanTemplateType;
  selectedPresetId?: string;
  wans: MultiWanInterfaceConfig[];
  // Failover specific options
  failoverCheckMethod: WanHealthCheckMethod;
  autoRecovery: boolean;
  fastFailoverIntervalSec: number;
  // Load Balancing specific options
  loadBalancingMethod: LoadBalancingMethod;
  useAutoBandwidthWeight: boolean;
  connectionTrackingSticky: boolean;
  autoFailoverUnhealthyWan: boolean;
  // Hybrid specific options
  hybridPolicies: HybridPolicyRule[];
  // Local LAN networks to bypass policy routing (RFC1918 + router subnets)
  localLanSubnets: string[];
  // Simulation & Telemetry state
  activeScenario: MultiWanSimulationScenarioId;
  simulatedTotalDemandDownMbps: number;
  simulatedTotalDemandUpMbps: number;
  simulatedActiveConnections: number;
  events: MultiWanEventLog[];
  lastAppliedAt?: string;
}

// ==========================================
// 12. Master Device Configuration Model
// ==========================================

export interface RouterOsDeviceConfig {
  version: RouterOsVersion;
  identity: RouterOsSystemIdentity;
  interfaces: RouterOsInterface[];
  interfaceLists?: RouterOsInterfaceList[];
  interfaceListMembers?: RouterOsInterfaceListMember[];
  bridges: RouterOsBridge[];
  bridgePorts: RouterOsBridgePort[];
  vlans: RouterOsVlan[];
  ipAddresses: RouterOsIpAddress[];
  routes: RouterOsRoute[];
  routingTables?: RouterOsRoutingTable[];
  ipPools: RouterOsIpPool[];
  dhcpServers: RouterOsDhcpServer[];
  dhcpNetworks: RouterOsDhcpNetwork[];
  dns: RouterOsDnsConfig;
  firewall: {
    filterRules: RouterOsFirewallFilterRule[];
    natRules: RouterOsFirewallNatRule[];
    mangleRules: MangleRule[];
    addressLists?: RouterOsAddressListEntry[];
  };
  connectionTracking?: RouterOsConnectionTrackingEntry[];
  queues: RouterOsSimpleQueue[];
  queueTree?: RouterOsQueueTree[];
  backups: RouterOsBackupSnapshot[];
  multiWanConfig?: MultiWanConfigState;
  lastModifiedAt: string;
}

// ==========================================
// 13. Zod Schemas for Validation
// ==========================================

export const RouterOsIpAddressSchema = z.object({
  address: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/, 'Invalid IP/CIDR format (e.g. 192.168.88.1/24)'),
  interface: z.string().min(1, 'Target interface is required'),
  disabled: z.boolean().default(false),
  comment: z.string().optional(),
});

export const RouterOsRouteSchema = z.object({
  dstAddress: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/, 'Invalid Dst-Address/CIDR format (e.g. 0.0.0.0/0)'),
  gateway: z.string().min(1, 'Gateway IP or Interface is required'),
  distance: z.number().int().min(1).max(255).default(1),
  disabled: z.boolean().default(false),
  comment: z.string().optional(),
});

export const RouterOsBridgeSchema = z.object({
  name: z.string().min(1, 'Bridge name is required').regex(/^[a-zA-Z0-9_-]+$/, 'Bridge name can only contain letters, numbers, and dashes'),
  vlanFiltering: z.boolean().default(false),
  disabled: z.boolean().default(false),
  comment: z.string().optional(),
});

export const RouterOsVlanSchema = z.object({
  name: z.string().min(1, 'VLAN interface name is required'),
  vlanId: z.number().int().min(1).max(4094, 'VLAN ID must be between 1 and 4094'),
  interface: z.string().min(1, 'Parent interface is required'),
  disabled: z.boolean().default(false),
  comment: z.string().optional(),
});

export const RouterOsSimpleQueueSchema = z.object({
  name: z.string().min(1, 'Queue name is required'),
  target: z.string().min(1, 'Target IP or subnet is required'),
  maxLimitUploadBps: z.number().nonnegative(),
  maxLimitDownloadBps: z.number().nonnegative(),
  priority: z.number().int().min(1).max(8).default(8),
  disabled: z.boolean().default(false),
  comment: z.string().optional(),
});
