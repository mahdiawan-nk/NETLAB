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
  disabled: boolean;
  active: boolean;
  routingTable?: string; // v7 routing table or "main"
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
// 8. IP Firewall: Filter & NAT
// ==========================================

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
  connectionState?: string; // e.g. "established,related"
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
// 9. Simple Queues & QoS Bandwidth Shaping
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
  priority?: number; // 1 (highest) to 8 (lowest)
  disabled: boolean;
  comment?: string;
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
// 12. Master Device Configuration Model
// ==========================================

export interface RouterOsDeviceConfig {
  version: RouterOsVersion;
  identity: RouterOsSystemIdentity;
  interfaces: RouterOsInterface[];
  bridges: RouterOsBridge[];
  bridgePorts: RouterOsBridgePort[];
  vlans: RouterOsVlan[];
  ipAddresses: RouterOsIpAddress[];
  routes: RouterOsRoute[];
  ipPools: RouterOsIpPool[];
  dhcpServers: RouterOsDhcpServer[];
  dhcpNetworks: RouterOsDhcpNetwork[];
  dns: RouterOsDnsConfig;
  firewall: {
    filterRules: RouterOsFirewallFilterRule[];
    natRules: RouterOsFirewallNatRule[];
  };
  queues: RouterOsSimpleQueue[];
  backups: RouterOsBackupSnapshot[];
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
