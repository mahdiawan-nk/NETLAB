import { z } from 'zod';
import type {
  IspProvider,
  InternetCircuit,
  CpeAssignment,
  DeviceWorkload,
  WorkloadProfile,
} from './ispWorkload';
export * from './ispWorkload';
export * from './routerOs';
import type { RouterOsDeviceConfig } from './routerOs';

// ==========================================
// Physical Interface & Media Specifications

// ==========================================

export type InterfaceType = 
  | 'ethernet'
  | 'sfp'
  | 'sfp-plus'
  | 'sfp28'
  | 'qsfp28'
  | 'wireless'
  | 'bridge'
  | 'vlan'
  | 'management';

export type MediaType = 
  | 'copper-cat5e'
  | 'copper-cat6'
  | 'copper-cat6a'
  | 'copper-cat7'
  | 'fiber-smf'      // Single-mode fiber 9/125µm (Yellow jacket)
  | 'fiber-mmf'      // Multi-mode fiber 50/125µm OM3/OM4 (Aqua/Magenta jacket)
  | 'wireless-rf';

export type OpticalTransceiverType = 
  | 'sfp-1g-sx'      // MMF 850nm 550m
  | 'sfp-1g-lx'      // SMF 1310nm 10km
  | 'sfp-1g-rj45'    // Copper RJ45 transceiver
  | 'sfpplus-10g-sr' // MMF 850nm 300m
  | 'sfpplus-10g-lr' // SMF 1310nm 10km
  | 'sfpplus-10g-er' // SMF 1550nm 40km
  | 'sfpplus-10g-bidi-u' // SMF Tx1270/Rx1330 10km
  | 'sfpplus-10g-bidi-d' // SMF Tx1330/Rx1270 10km
  | 'sfpplus-10g-rj45'   // 10G Copper module
  | 'none';

export type InterfaceSpeed = '10M' | '100M' | '1G' | '2.5G' | '10G' | '25G' | '40G' | '100G';

export type PortMode = 'access' | 'trunk' | 'hybrid' | 'wan' | 'management' | 'routed';

export type OperationalStatus = 'RUN' | 'DEGRADED' | 'DIE' | 'DISABLED' | 'UNKNOWN';

// ==========================================
// Device Catalog Models & Interfaces
// ==========================================

export type DeviceCategory = 
  | 'router'
  | 'switch'
  | 'wireless'
  | 'wan'
  | 'endpoint'
  | 'server';

export interface DeviceModelInterfaceSpec {
  id: string;
  name: string;
  type: InterfaceType;
  defaultSpeed: InterfaceSpeed;
  supportedSpeeds: InterfaceSpeed[];
  poeOut?: boolean;
  poeIn?: boolean;
  comboWith?: string; // e.g. combo1 can be ether1 or sfp1
}

export interface DeviceModel {
  id: string;
  model: string;
  vendor: string;
  category: DeviceCategory;
  series: string;
  routerOsVersion?: 'v6' | 'v7' | 'v6/v7';
  cpu?: string;
  ram?: string;
  formFactor: '1U Rackmount' | 'Desktop' | 'Ceiling/Wall' | 'Tower' | 'Virtual';
  description: string;
  ports: DeviceModelInterfaceSpec[];
  isProvisional?: boolean;
  specSource: string;
}

// ==========================================
// Active Device & Interface State
// ==========================================

export interface DeviceInterface {
  id: string; // e.g. "dev-1_ether1"
  deviceId: string;
  name: string; // e.g. "ether1"
  type: InterfaceType;
  adminState: 'up' | 'down';
  operationalState: OperationalStatus;
  macAddress: string;
  ipAddress?: string; // e.g. "192.168.88.1/24"
  mode: PortMode;
  pvid?: number; // Default VLAN (Access port)
  taggedVlans?: number[]; // Allowed VLANs on trunk
  speed: InterfaceSpeed;
  duplex: 'full' | 'half' | 'auto';
  mtu: number;
  transceiver?: OpticalTransceiverType;
  opticalWavelength?: number; // nm e.g. 1310, 850, 1550
  connectedLinkId?: string;
  poeEnabled?: boolean;
  comment?: string;
}

export interface NetworkDevice {
  id: string;
  name: string; // e.g. "CORE-CCR2116"
  modelId: string;
  category: DeviceCategory;
  modelName: string;
  vendor: string;
  routerOsVersion: 'v6' | 'v7' | 'none';
  x: number;
  y: number;
  status: OperationalStatus;
  statusReason?: string;
  interfaces: DeviceInterface[];
  defaultGateway?: string;
  dnsServers?: string[];
  notes?: string;
  specificationVersion?: number;
  routerOsConfig?: RouterOsDeviceConfig;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Network Links & Fiber Physical Layer
// ==========================================

export interface NetworkLink {
  id: string;
  sourceDeviceId: string;
  sourceInterfaceId: string;
  targetDeviceId: string;
  targetInterfaceId: string;
  mediaType: MediaType;
  cableLengthMeters: number;
  speed: InterfaceSpeed;
  status: OperationalStatus;
  statusReason?: string;
  lossDb?: number;
  isFiber: boolean;
  sourceTransceiver?: OpticalTransceiverType;
  targetTransceiver?: OpticalTransceiverType;
  color?: string;
  createdAt: string;
}

// ==========================================
// VLAN & Routing
// ==========================================

export interface NetworkVlan {
  id: number; // e.g. 10, 20, 30
  name: string; // e.g. "MANAGEMENT", "CIVITAS", "STUDENT"
  subnet: string; // e.g. "10.20.0.0/24"
  gatewayIp: string; // e.g. "10.20.0.1"
  dhcpEnabled: boolean;
  dhcpRange?: string; // e.g. "10.20.0.100-10.20.0.250"
  color: string;
  description?: string;
}

// ==========================================
// Diagnostics & Root Cause Codes
// ==========================================

export type DiagnosticErrorCode = 
  | 'LINK_ENDPOINT_MISSING'
  | 'INTERFACE_DISABLED'
  | 'INTERFACE_NOT_FOUND'
  | 'TRANSCEIVER_INCOMPATIBLE'
  | 'MEDIA_MISMATCH'
  | 'SPEED_MISMATCH'
  | 'FIBER_SIGNAL_LOSS'
  | 'VLAN_NOT_ALLOWED'
  | 'VLAN_MISMATCH'
  | 'IP_SUBNET_MISMATCH'
  | 'IP_ADDRESS_CONFLICT'
  | 'GATEWAY_UNREACHABLE'
  | 'ROUTE_NOT_FOUND'
  | 'FIREWALL_DROP'
  | 'NAT_MISCONFIGURED'
  | 'DHCP_UNAVAILABLE'
  | 'DNS_FAILURE'
  | 'LINK_CONGESTION'
  | 'BANDWIDTH_EXCEEDED'
  | 'DEVICE_UNREACHABLE'
  | 'DEVICE_NAME_DUPLICATE'
  | 'WAN_SATURATION'
  | 'CIR_VIOLATION'
  | 'SHARED_BANDWIDTH_CONTENTION'
  | 'INTERFACE_CONGESTION'
  | 'OVERSUBSCRIBED_UPLINK'
  | 'ROUTER_PROCESSING_BOTTLENECK'
  | 'SWITCH_FABRIC_BOTTLENECK'
  | 'EXCESSIVE_WORKLOAD'
  | 'HIGH_PACKET_LOSS'
  | 'HIGH_LATENCY'
  | 'CPE_OFFLINE'
  | 'CIRCUIT_DOWN';

export interface DiagnosticResult {
  id: string;
  errorCode: DiagnosticErrorCode;
  severity: 'error' | 'warning' | 'info';
  objectId: string; // Device ID, Link ID, Circuit ID, or Workload ID
  objectType: 'device' | 'link' | 'interface' | 'vlan' | 'circuit' | 'isp' | 'workload';
  affectedObjects: string[];
  status: OperationalStatus;
  observedCondition: string;
  evidence: string;
  probableCause: string;
  confirmedCause?: string;
  impact: string;
  recommendedAction: string;
  timestamp: string;
}

// ==========================================
// Audit Logs & Event Logs
// ==========================================

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: 'device' | 'link' | 'interface' | 'vlan' | 'project' | 'cli';
  entityId: string;
  projectId?: string;
  source: 'canvas' | 'cli' | 'form' | 'ai' | 'import';
  details: string;
  beforeState?: unknown;
  afterState?: unknown;
}

export interface NetworkEventLog {
  id: string;
  timestamp: string;
  type: 'link_state' | 'device_state' | 'validation' | 'simulation' | 'congestion';
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  targetId: string;
}

// ==========================================
// Simulation Engine: Packet Tracer & Hops
// ==========================================

export interface PacketTraceHop {
  hopNumber: number;
  deviceId: string;
  deviceName: string;
  ingressInterfaceId?: string;
  ingressInterfaceName?: string;
  egressInterfaceId?: string;
  egressInterfaceName?: string;
  action: 'INGRESS' | 'SWITCH_VLAN' | 'ROUTE_LOOKUP' | 'NAT_MASQUERADE' | 'FORWARD' | 'DROP' | 'DELIVER';
  vlanId?: number;
  details: string;
  latencyMs: number;
  status: 'OK' | 'DROPPED';
  dropReason?: string;
}

export interface SimulationResult {
  id: string;
  timestamp: string;
  sourceDeviceId: string;
  sourceDeviceName: string;
  sourceIp: string;
  targetIp: string;
  targetDeviceId?: string;
  targetDeviceName?: string;
  protocol: 'ICMP' | 'TCP' | 'UDP' | 'DNS' | 'DHCP';
  success: boolean;
  totalLatencyMs: number;
  packetLossPercent: number;
  hops: PacketTraceHop[];
  summary: string;
}

// ==========================================
// Layer 3 Routing & Route Entries
// ==========================================

export interface RouteEntry {
  id: string;
  deviceId: string;
  destinationSubnet: string; // e.g. "10.20.0.0/24", "0.0.0.0/0"
  gatewayIp?: string;
  interfaceName: string;
  type: 'connected' | 'static' | 'default';
  distance: number;
  active: boolean;
}

// ==========================================
// Phase 5: ISP & Bandwidth Profiles
// ==========================================

export type IspServiceType = 'dedicated' | 'shared' | 'best-effort';
export type ContentionRatio = '1:1' | '1:2' | '1:4' | '1:8' | '1:10' | 'custom';

export interface IspService {
  id: string;
  providerName: string; // e.g. "Telkom Metro-E", "Indosat Ooredoo", "Starlink"
  serviceType: IspServiceType;
  bandwidthDownMbps: number;
  bandwidthUpMbps: number;
  cirDownMbps: number;
  cirUpMbps: number;
  contentionRatio: ContentionRatio;
  activeUsers: number;
  baseLatencyMs: number;
  jitterMs: number;
  packetLossPercent: number;
  publicIp: string;
  connectedDeviceId?: string;
  connectedInterfaceId?: string;
  isPrimaryWan: boolean;
  status: OperationalStatus;
}

// ==========================================
// Phase 5: Real-Time Traffic Telemetry
// ==========================================

export interface LinkTrafficStats {
  linkId: string;
  rxBps: number;
  txBps: number;
  rxPps: number;
  txPps: number;
  capacityBps: number;
  utilizationPercent: number;
  latencyMs: number;
  packetLossPercent: number;
  isCongested: boolean;
  history: {
    time: string;
    rxMbps: number;
    txMbps: number;
    utilPercent: number;
  }[];
}

// ==========================================
// Complete Project Container
// ==========================================

export interface NetworkProject {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  devices: NetworkDevice[];
  links: NetworkLink[];
  vlans: NetworkVlan[];
  routes?: RouteEntry[];
  ispServices?: IspService[];
  ispProviders?: IspProvider[];
  circuits?: InternetCircuit[];
  cpeAssignments?: CpeAssignment[];
  workloads?: DeviceWorkload[];
  workloadProfiles?: WorkloadProfile[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}

// ==========================================
// Zod Schemas for API & Validation
// ==========================================

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Project name is required'),
  description: z.string().default(''),
  version: z.string().default('1.0.0'),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
  devices: z.array(z.any()).default([]),
  links: z.array(z.any()).default([]),
  vlans: z.array(z.any()).default([]),
  ispServices: z.array(z.any()).optional().default([]),
  ispProviders: z.array(z.any()).optional().default([]),
  circuits: z.array(z.any()).optional().default([]),
  cpeAssignments: z.array(z.any()).optional().default([]),
  workloads: z.array(z.any()).optional().default([]),
  workloadProfiles: z.array(z.any()).optional().default([]),
  viewport: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    zoom: z.number().default(1),
  }).default({ x: 0, y: 0, zoom: 1 }),
});

export const AddDevicePayloadSchema = z.object({
  modelId: z.string(),
  name: z.string().min(1),
  x: z.number().optional().default(200),
  y: z.number().optional().default(200),
});

export const AddLinkPayloadSchema = z.object({
  sourceDeviceId: z.string(),
  sourceInterfaceId: z.string(),
  targetDeviceId: z.string(),
  targetInterfaceId: z.string(),
  mediaType: z.enum([
    'copper-cat5e',
    'copper-cat6',
    'copper-cat6a',
    'copper-cat7',
    'fiber-smf',
    'fiber-mmf',
    'wireless-rf'
  ]),
  cableLengthMeters: z.number().positive().default(5),
  sourceTransceiver: z.string().optional(),
  targetTransceiver: z.string().optional(),
});

// ==========================================
// UNIFIED CUSTOM DEVICE BUILDER SCHEMA
// ==========================================

export type UnifiedDeviceCategory = 
  | 'router'
  | 'switch'
  | 'l3-switch'
  | 'firewall'
  | 'wireless-router'
  | 'access-point'
  | 'wireless-controller'
  | 'modem'
  | 'ont'
  | 'isp-gateway'
  | 'optical-terminal'
  | 'server'
  | 'storage-server'
  | 'hypervisor'
  | 'virtual-machine'
  | 'container-host'
  | 'load-balancer'
  | 'network-appliance'
  | 'custom-generic';

export type VerificationStatus = 'UNVERIFIED' | 'PARTIALLY_VERIFIED' | 'VERIFIED';

export type InterfaceCategory = 'fixed' | 'modular' | 'combo' | 'expansion' | 'wireless' | 'logical';
export type ConnectorType = 'RJ45' | 'LC' | 'SC' | 'MPO' | 'USB-A' | 'USB-C' | 'DB9' | 'Antenna RP-SMA' | 'Internal';

export interface HardwareSpec {
  cpuManufacturer?: string;
  cpuModel?: string;
  cpuArchitecture?: string;
  cpuCores?: number;
  cpuFrequencyMhz?: number;
  ramMb?: number;
  storageMb?: number;
  operatingSystem?: string;
  firmwareVersion?: string;
  powerConsumptionWatts?: number;
  powerSupplyType?: 'Internal AC' | 'Dual Redundant AC' | 'External DC Adapter' | 'PoE-In Passive/802.3at' | 'Other';
  coolingSystem?: 'Passive (Fanless)' | 'Active (PWM Fans)' | 'Redundant Hot-Swap Fans' | 'Other';
}

export interface UnifiedPortSpec {
  id: string;
  name: string;
  type: InterfaceType;
  category: InterfaceCategory;
  defaultSpeed: InterfaceSpeed;
  supportedSpeeds: InterfaceSpeed[];
  duplex: 'full' | 'half' | 'auto';
  connectorType: ConnectorType;
  mediaType: MediaType;
  portPosition: number;
  portGroup?: string;
  colorTag?: string;
  poeCapability?: {
    supportsIn?: boolean;
    supportsOut?: boolean;
    standard?: 'Passive' | '802.3af' | '802.3at' | '802.3bt';
    maxWattage?: number;
  };
  comboWithPortId?: string;
}

export interface PortLayoutSpec {
  faceplateStyle: '1U-Full-Width' | '2U-Full-Width' | 'Desktop-Front' | 'Desktop-Rear' | 'Blade-Server' | 'Modular-Slot' | 'Tower';
  rows: number;
  columns: number;
  totalPorts: number;
  portsOrder: string[];
}

export interface NetworkCapabilities {
  general: {
    layer2: boolean;
    layer3: boolean;
    ipv4: boolean;
    ipv6: boolean;
    staticRouting: boolean;
    dynamicRouting: boolean;
  };
  switching: {
    vlanSupport: boolean;
    vlanTrunking: boolean;
    stp: boolean;
    rstp: boolean;
    mstp: boolean;
    linkAggregation: boolean;
    lacp: boolean;
    portMirroring: boolean;
    jumboFrames: boolean;
    maxJumboFrameBytes?: number;
  };
  routing: {
    staticRoute: boolean;
    ospf: boolean;
    bgp: boolean;
    rip: boolean;
    ecmp: boolean;
    policyRouting: boolean;
  };
  networkServices: {
    nat: boolean;
    dhcpServer: boolean;
    dhcpClient: boolean;
    dnsForwarder: boolean;
    firewall: boolean;
    vpn: boolean;
    qos: boolean;
    trafficShaping: boolean;
    hotspot: boolean;
    radius: boolean;
  };
}

export interface PerformanceSpec {
  switchingCapacityGbps?: number;
  forwardingRateMpps?: number;
  maxThroughputMbps?: number;
  routingThroughputMbps?: number;
  firewallThroughputMbps?: number;
  vpnThroughputMbps?: number;
  maxMacTableSize?: number;
  maxVlanCount?: number;
  maxRoutingEntries?: number;
  maxConcurrentSessions?: number;
  maxConnectedClients?: number;
  measurementNotes?: string;
}

export interface PoeSpec {
  supported: boolean;
  type?: 'PSE (Power Sourcing)' | 'PD (Powered Device)' | 'Both (Passthrough)';
  standard?: '802.3af (PoE 15.4W)' | '802.3at (PoE+ 30W)' | '802.3bt (PoE++ 60-90W)' | 'Passive 24V';
  powerBudgetWatts?: number;
  maxPerPortWatts?: number;
}

export interface WirelessSpec {
  wifiStandard?: 'Wi-Fi 4 (802.11n)' | 'Wi-Fi 5 (802.11ac)' | 'Wi-Fi 6 (802.11ax)' | 'Wi-Fi 7 (802.11be)';
  frequencyBands?: ('2.4GHz' | '5GHz' | '6GHz')[];
  radioCount?: number;
  channelWidthMhz?: number[];
  maxPhyRateMbps?: number;
  spatialStreams?: string;
  mimoSupported?: boolean;
  muMimoSupported?: boolean;
  ofdmaSupported?: boolean;
  antennaType?: 'Internal Omnidirectional' | 'External High-Gain' | 'Sector' | 'Directional Dish';
  antennaGainDbi?: number;
  maxSsid?: number;
  maxWirelessClients?: number;
}

export interface CompatibilitySpec {
  supportedTransceivers: OpticalTransceiverType[];
  supportedMedia: MediaType[];
  allowsDacCables: boolean;
  allowsAocCables: boolean;
  formFactorExpansionSlots?: string[];
  recommendedPowerSupply?: string;
  notes?: string;
}

export interface SimulationProfile {
  supportedSimulationFeatures: ('L1-Carrier' | 'L2-VLAN' | 'L3-Routing' | 'L3-NAT' | 'Traffic-Telemetry' | 'QoS')[];
  switchingBehavior: 'SPECIFIED' | 'SIMULATED' | 'UNKNOWN';
  routingBehavior: 'SPECIFIED' | 'SIMULATED' | 'UNKNOWN';
  vlanBehavior: 'SPECIFIED' | 'SIMULATED' | 'UNKNOWN';
  natBehavior: 'SPECIFIED' | 'SIMULATED' | 'UNKNOWN';
  dhcpBehavior: 'SPECIFIED' | 'SIMULATED' | 'UNKNOWN';
  firewallBehavior: 'SPECIFIED' | 'SIMULATED' | 'UNKNOWN';
  trafficHandling: 'Hardware-Offloaded' | 'CPU-Bound' | 'Synthetic-Deterministic';
}

export interface SourceReference {
  id: string;
  type: 'Manufacturer Datasheet' | 'Product Page' | 'Technical Manual' | 'Distributor Spec' | 'User Manual' | 'Other';
  title: string;
  url?: string;
  notes?: string;
  accessedAt?: string;
  verifiedBy?: string;
}

export interface UnifiedCatalogDevice {
  id: string;
  isCustom: boolean;
  schemaVersion: number;
  specificationVersion: number;

  // Basic Information
  name: string;
  brand: string;
  manufacturer: string;
  modelNumber: string;
  productSeries?: string;
  category: UnifiedDeviceCategory;
  description: string;
  imageUrl?: string;
  formFactor: '1U Rackmount' | '2U Rackmount' | 'Desktop' | 'Ceiling/Wall' | 'Tower' | 'Virtual' | 'DIN-Rail';
  releaseYear?: number;
  officialProductUrl?: string;
  datasheetUrl?: string;
  verificationStatus: VerificationStatus;
  sourceReferences: SourceReference[];

  // Modular Specs
  hardware: HardwareSpec;
  ports: UnifiedPortSpec[];
  portLayout: PortLayoutSpec;
  capabilities: NetworkCapabilities;
  performance: PerformanceSpec;
  poe?: PoeSpec;
  wireless?: WirelessSpec;
  compatibility: CompatibilitySpec;
  simulationProfile: SimulationProfile;

  // Metadata
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CustomDevicePayloadSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Device name is required'),
  brand: z.string().min(1, 'Brand is required'),
  manufacturer: z.string().default(''),
  modelNumber: z.string().min(1, 'Model number is required'),
  productSeries: z.string().optional(),
  category: z.string().default('router'),
  description: z.string().default(''),
  imageUrl: z.string().optional(),
  formFactor: z.string().default('Desktop'),
  releaseYear: z.number().optional(),
  officialProductUrl: z.string().optional(),
  datasheetUrl: z.string().optional(),
  verificationStatus: z.enum(['UNVERIFIED', 'PARTIALLY_VERIFIED', 'VERIFIED']).default('UNVERIFIED'),
  sourceReferences: z.array(z.any()).default([]),
  hardware: z.record(z.string(), z.any()).default({}),
  ports: z.array(z.any()).default([]),
  portLayout: z.record(z.string(), z.any()).default({ faceplateStyle: 'Desktop-Front', rows: 1, columns: 8, totalPorts: 0, portsOrder: [] }),
  capabilities: z.record(z.string(), z.any()).default({}),
  performance: z.record(z.string(), z.any()).default({}),
  poe: z.record(z.string(), z.any()).optional(),
  wireless: z.record(z.string(), z.any()).optional(),
  compatibility: z.record(z.string(), z.any()).default({ supportedTransceivers: [], supportedMedia: [], allowsDacCables: true, allowsAocCables: true }),
  simulationProfile: z.record(z.string(), z.any()).default({}),
});

