import { z } from 'zod';
import { OperationalStatus } from './network';

// ==========================================
// FEATURE 1: DYNAMIC ISP & INTERNET CIRCUIT
// ==========================================

export type IspProviderType =
  | 'fiber'
  | 'broadband'
  | 'dedicated'
  | 'wireless'
  | 'satellite'
  | 'metro-ethernet'
  | 'private-wan'
  | 'other';

export interface IspProvider {
  id: string;
  name: string;
  type: IspProviderType;
  logo?: string;
  website?: string;
  customerService?: string;
  description?: string;
  status: 'active' | 'inactive';
  circuitCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type BandwidthUnit = 'Kbps' | 'Mbps' | 'Gbps';

export type CircuitServiceType =
  | 'dedicated'
  | 'shared'
  | 'broadband'
  | 'best-effort'
  | 'metro-ethernet'
  | 'private-wan'
  | 'satellite';

export type CircuitConnectionStatus = 'active' | 'standby' | 'down' | 'maintenance' | 'disabled';

export interface InternetCircuit {
  id: string;
  ispProviderId: string;
  circuitName: string;
  serviceType: CircuitServiceType;

  // Bandwidth Download & Upload (separated)
  downloadBandwidth: number;
  downloadUnit: BandwidthUnit;
  uploadBandwidth: number;
  uploadUnit: BandwidthUnit;

  // CIR (Committed Information Rate) Download & Upload (separated)
  downloadCir?: number;
  downloadCirUnit?: BandwidthUnit;
  uploadCir?: number;
  uploadCirUnit?: BandwidthUnit;

  // MIR (Maximum Information Rate / Peak Burst)
  downloadMir?: number;
  downloadMirUnit?: BandwidthUnit;
  uploadMir?: number;
  uploadMirUnit?: BandwidthUnit;

  // Contention Ratio (e.g. "1:1", "1:2", "1:4", "1:8", "1:10", "custom")
  contentionRatio: string;

  // Service Level & SLA Metrics
  latencyMs?: number;
  jitterMs?: number;
  packetLossPercent?: number;
  slaPercent?: number; // e.g. 99.5%

  // Contract & Billing
  contractStart?: string;
  contractEnd?: string;
  monthlyCost?: number;
  currency?: string;

  // IP Addressing
  publicIp?: string;
  gatewayIp?: string;
  subnetMask?: string;
  dnsServers?: string[];

  // WAN Topology Assignment
  isPrimaryWan: boolean;
  status: CircuitConnectionStatus;

  // CPE / Termination Modem Link
  cpeDeviceId?: string;
  cpeWanInterfaceId?: string;
  cpeLanInterfaceId?: string;

  // Target Router WAN Interface Link
  targetRouterDeviceId?: string;
  targetRouterInterfaceId?: string;

  createdAt: string;
  updatedAt: string;
}

export type CpeConnectionMode = 'bridge' | 'router';
export type CpeIpMode = 'pppoe' | 'dhcp' | 'static';

export interface CpeAssignment {
  id: string;
  circuitId: string;
  cpeDeviceId: string; // References NetworkDevice ID or Catalog ID
  deviceModel: string;
  deviceCategory: 'modem' | 'ont' | 'isp-gateway' | 'optical-terminal' | 'router';
  managementIp?: string;
  wanInterfaceId?: string;
  lanInterfaceId?: string;
  connectionMode: CpeConnectionMode;
  ipMode: CpeIpMode;
  pppoeUsername?: string;
  pppoePassword?: string;
  physicalStatus: OperationalStatus;
  notes?: string;
}

// ==========================================
// FEATURE 2: DEVICE WORKLOAD MANAGEMENT
// ==========================================

export type WorkloadProfileCategory =
  | 'office'
  | 'campus'
  | 'residential'
  | 'small-business'
  | 'server'
  | 'cctv'
  | 'custom';

export type TrafficPriority = 'critical' | 'high' | 'normal' | 'low' | 'best-effort';

export interface ApplicationTrafficModel {
  id: string;
  name: string;
  category?: string;
  downloadRateKbps: number;
  uploadRateKbps: number;
  averageBitrateKbps: number;
  peakBitrateKbps: number;
  activityProbability: number; // 0.0 to 1.0 (e.g. 0.3 = 30% duty cycle)
  concurrentSessions: number;
  trafficPriority: TrafficPriority;
  latencySensitivity: 'ultra-low' | 'low' | 'medium' | 'tolerant';
}

export interface WorkloadProfile {
  id: string;
  name: string;
  category: WorkloadProfileCategory;
  description: string;
  defaultDeviceCount: number;
  defaultActiveUsers: number;
  defaultConcurrencyFactor: number;
  applications: ApplicationTrafficModel[];
  isCustom?: boolean;
}

export type WorkloadScope = 'device' | 'group' | 'vlan' | 'subnet' | 'site';

export interface DeviceWorkload {
  id: string;
  name: string;
  scope: WorkloadScope;
  targetDeviceId?: string;
  targetDeviceIds?: string[];
  targetVlanId?: number;
  targetSubnet?: string;

  profileId: string;
  profileCategory: WorkloadProfileCategory;

  deviceCount: number;
  activeUsers: number;
  concurrencyFactor: number; // 0.05 to 1.0 (e.g. 0.4 = 40% active simultaneously)
  activitySchedule?: '24/7' | 'business-hours' | 'evening-peak' | 'custom';

  // Calculated traffic rates
  downloadDemandKbps: number;
  uploadDemandKbps: number;
  averageDownloadKbps: number;
  averageUploadKbps: number;
  peakDownloadKbps: number;
  peakUploadKbps: number;

  trafficPriority: TrafficPriority;
  applications: ApplicationTrafficModel[];
  enabled: boolean;

  createdAt: string;
  updatedAt: string;
}

// ==========================================
// SIMULATION & TELEMETRY ENGINE METRICS
// ==========================================

export interface CircuitSimulationTelemetry {
  circuitId: string;
  circuitName: string;
  ispProviderName: string;
  isPrimaryWan: boolean;

  // Demand
  demandDownMbps: number;
  demandUpMbps: number;

  // Delivered
  deliveredDownMbps: number;
  deliveredUpMbps: number;

  // Dropped
  droppedDownMbps: number;
  droppedUpMbps: number;

  // Utilization
  utilizationDownPercent: number;
  utilizationUpPercent: number;
  cirUtilizationDownPercent: number;
  cirUtilizationUpPercent: number;

  // Queue and Quality of Service
  queueLengthPackets: number;
  latencyMs: number;
  jitterMs: number;
  packetLossPercent: number;

  // Status flags
  isCongested: boolean;
  isCirViolated: boolean;
  isSlaViolated: boolean;

  // Historical telemetry
  history: {
    time: string;
    downMbps: number;
    upMbps: number;
    utilPercent: number;
  }[];
}

export interface DeviceProcessingCapacityMetrics {
  deviceId: string;
  deviceName: string;
  category: string;
  switchingCapacityGbps: number;
  forwardingRateMpps: number;
  routingThroughputMbps: number;
  firewallThroughputMbps?: number;
  currentThroughputMbps: number;
  cpuLoadPercent: number;
  ramUsagePercent: number;
  status: OperationalStatus;
  isBottleneck: boolean;
  bottleneckReason?: string;
}

export interface WorkloadEngineSummary {
  totalActiveDevices: number;
  totalActiveUsers: number;
  totalGeneratedDownMbps: number;
  totalGeneratedUpMbps: number;
  totalDeliveredDownMbps: number;
  totalDeliveredUpMbps: number;
  totalDroppedDownMbps: number;
  totalDroppedUpMbps: number;
  peakTrafficMbps: number;

  mostUtilizedWan?: { circuitId: string; name: string; utilPercent: number };
  mostUtilizedLink?: { linkId: string; utilPercent: number };
  mostUtilizedDevice?: { deviceId: string; name: string; cpuLoad: number };
  congestedVlans: number[];
  cirWarningsCount: number;
  slaWarningsCount: number;
}

// ==========================================
// ZOD VALIDATION SCHEMAS
// ==========================================

export const IspProviderSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Provider name is required'),
  type: z.enum([
    'fiber',
    'broadband',
    'dedicated',
    'wireless',
    'satellite',
    'metro-ethernet',
    'private-wan',
    'other',
  ]),
  logo: z.string().optional(),
  website: z.string().optional(),
  customerService: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const InternetCircuitSchema = z.object({
  id: z.string(),
  ispProviderId: z.string().min(1, 'ISP Provider ID is required'),
  circuitName: z.string().min(1, 'Circuit name is required'),
  serviceType: z.enum([
    'dedicated',
    'shared',
    'broadband',
    'best-effort',
    'metro-ethernet',
    'private-wan',
    'satellite',
  ]),
  downloadBandwidth: z.number().positive('Download bandwidth must be positive'),
  downloadUnit: z.enum(['Kbps', 'Mbps', 'Gbps']).default('Mbps'),
  uploadBandwidth: z.number().positive('Upload bandwidth must be positive'),
  uploadUnit: z.enum(['Kbps', 'Mbps', 'Gbps']).default('Mbps'),
  downloadCir: z.number().nonnegative().optional(),
  downloadCirUnit: z.enum(['Kbps', 'Mbps', 'Gbps']).optional(),
  uploadCir: z.number().nonnegative().optional(),
  uploadCirUnit: z.enum(['Kbps', 'Mbps', 'Gbps']).optional(),
  downloadMir: z.number().nonnegative().optional(),
  downloadMirUnit: z.enum(['Kbps', 'Mbps', 'Gbps']).optional(),
  uploadMir: z.number().nonnegative().optional(),
  uploadMirUnit: z.enum(['Kbps', 'Mbps', 'Gbps']).optional(),
  contentionRatio: z.string().default('1:1'),
  latencyMs: z.number().nonnegative().optional(),
  jitterMs: z.number().nonnegative().optional(),
  packetLossPercent: z.number().min(0).max(100).optional(),
  slaPercent: z.number().min(0).max(100).optional(),
  contractStart: z.string().optional(),
  contractEnd: z.string().optional(),
  monthlyCost: z.number().optional(),
  currency: z.string().optional().default('IDR'),
  publicIp: z.string().optional(),
  gatewayIp: z.string().optional(),
  subnetMask: z.string().optional(),
  dnsServers: z.array(z.string()).optional(),
  isPrimaryWan: z.boolean().default(false),
  status: z.enum(['active', 'standby', 'down', 'maintenance', 'disabled']).default('active'),
  cpeDeviceId: z.string().optional(),
  cpeWanInterfaceId: z.string().optional(),
  cpeLanInterfaceId: z.string().optional(),
  targetRouterDeviceId: z.string().optional(),
  targetRouterInterfaceId: z.string().optional(),
});
