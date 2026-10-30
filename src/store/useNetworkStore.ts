import { create } from 'zustand';
import {
  NetworkProject,
  NetworkDevice,
  NetworkLink,
  NetworkVlan,
  DiagnosticResult,
  AuditLogEntry,
  MediaType,
  OpticalTransceiverType,
  SimulationResult,
  IspService,
  IspProvider,
  InternetCircuit,
  CpeAssignment,
  DeviceWorkload,
  WorkloadProfile,
  LinkTrafficStats,
  NetworkEventLog,
  UnifiedCatalogDevice,
} from '../types/network';
import {
  CircuitSimulationTelemetry,
  DeviceProcessingCapacityMetrics,
  WorkloadEngineSummary,
} from '../types/ispWorkload';
import { DEVICE_CATALOG } from '../data/deviceCatalog';
import { validateTopology } from '../services/validationEngine';
import { parseNetlabCommand } from '../services/cliParser';
import { createDefaultCampusProject } from '../data/defaultCampusProject';
import { simulatePacketTrace } from '../services/simulationEngine';
import {
  generateLinkTrafficStats,
  createDefaultIspProfiles,
  runComprehensiveTrafficSimulation,
} from '../services/trafficEngine';
import { createDeviceInterfacesFromUnified } from '../services/deviceAdapter';
import { WORKLOAD_SCENARIO_PRESETS } from '../data/workloadScenarios';
import { RouterOsConfigService, hasRouterOsSupport } from '../services/routerOsConfigService';
import { GuideSectionId } from '../types/userGuide';

interface ConnectingState {
  sourceDeviceId: string;
  sourceInterfaceId: string;
}

interface NetworkStoreState {
  // State
  projects: NetworkProject[];
  activeProject: NetworkProject;
  isLoading: boolean;
  selectedDeviceId: string | null;
  selectedLinkId: string | null;
  selectedInterfaceId: string | null;
  connectingFrom: ConnectingState | null;
  pendingConnectionModal: {
    sourceDeviceId: string;
    sourceInterfaceId: string;
    targetDeviceId: string;
    targetInterfaceId: string;
  } | null;

  // Custom Device Catalog State
  customDevices: UnifiedCatalogDevice[];
  isDeviceBuilderOpen: boolean;
  editingCustomDevice: UnifiedCatalogDevice | null;
  usageProtectionModal: {
    isOpen: boolean;
    deviceId: string;
    deviceName: string;
    usage: {
      inUse: boolean;
      totalDeviceCount: number;
      projects: { id: string; name: string; deviceCount: number }[];
    };
  } | null;
  diagnostics: DiagnosticResult[];
  auditLogs: AuditLogEntry[];
  cliHistory: { command: string; output: string; timestamp: string; isError?: boolean }[];
  historyPast: NetworkProject[];
  historyFuture: NetworkProject[];
  isDarkTheme: boolean;

  // Actions
  init: () => Promise<void>;
  switchProject: (projectId: string) => void;
  createNewProject: (name: string, description?: string) => void;
  saveProjectToServer: () => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  importProjectJson: (jsonString: string) => boolean;
  exportProjectJson: () => string;

  // Selection & UI
  setSelectedDevice: (id: string | null) => void;
  setSelectedLink: (id: string | null) => void;
  setSelectedInterface: (id: string | null) => void;
  setConnectingFrom: (state: ConnectingState | null) => void;
  setPendingConnectionModal: (val: NetworkStoreState['pendingConnectionModal']) => void;
  toggleTheme: () => void;
  setViewport: (vp: { x: number; y: number; zoom: number }) => void;

  // Topology Mutations (with Undo/Redo tracking)
  addDevice: (modelId: string, name?: string, x?: number, y?: number) => NetworkDevice | null;
  updateDevicePosition: (deviceId: string, x: number, y: number) => void;
  updateDevice: (deviceId: string, updates: Partial<NetworkDevice>) => void;
  removeDevice: (deviceId: string) => void;
  
  createLink: (
    sourceDeviceId: string,
    sourceInterfaceId: string,
    targetDeviceId: string,
    targetInterfaceId: string,
    mediaType?: MediaType,
    cableLengthMeters?: number,
    sourceTransceiver?: OpticalTransceiverType,
    targetTransceiver?: OpticalTransceiverType
  ) => NetworkLink | null;
  removeLink: (linkId: string) => void;
  updateLink: (linkId: string, updates: Partial<NetworkLink>) => void;

  // Phase 4-6 States
  activePacketTrace: import('../types/network').SimulationResult | null;
  simulationHistory: import('../types/network').SimulationResult[];
  ispServices: import('../types/network').IspService[];
  trafficStats: Record<string, import('../types/network').LinkTrafficStats>;
  circuitTelemetry: Record<string, CircuitSimulationTelemetry>;
  deviceProcessingMetrics: Record<string, DeviceProcessingCapacityMetrics>;
  workloadSummary: WorkloadEngineSummary | null;
  isTrafficRunning: boolean;
  trafficTickSeed: number;
  eventLogs: import('../types/network').NetworkEventLog[];

  updateInterface: (deviceId: string, interfaceId: string, updates: Partial<NetworkDevice['interfaces'][0]>) => void;

  addVlan: (vlan: NetworkVlan) => void;
  updateVlan: (vlanId: number, updates: Partial<NetworkVlan>) => void;
  removeVlan: (vlanId: number) => void;

  // Phase 4: Simulation
  runPing: (sourceDeviceId: string, targetIp: string, protocol?: 'ICMP' | 'TCP' | 'UDP' | 'DNS' | 'DHCP') => import('../types/network').SimulationResult;
  clearPacketTrace: () => void;

  // Phase 5: ISP & Traffic Telemetry
  toggleTrafficSimulation: () => void;
  updateTrafficTick: () => void;
  addIspService: (isp: import('../types/network').IspService) => void;
  updateIspService: (id: string, updates: Partial<import('../types/network').IspService>) => void;
  removeIspService: (id: string) => void;

  // Dynamic ISP Providers & Circuits Actions
  addIspProvider: (provider: Omit<IspProvider, 'id' | 'createdAt' | 'updatedAt'>) => IspProvider;
  updateIspProvider: (id: string, updates: Partial<IspProvider>) => void;
  deleteIspProvider: (id: string) => { success: boolean; error?: string };
  duplicateIspProvider: (id: string) => IspProvider | null;
  toggleIspProviderStatus: (id: string) => void;

  addCircuit: (circuit: Omit<InternetCircuit, 'id' | 'createdAt' | 'updatedAt'>) => InternetCircuit;
  updateCircuit: (id: string, updates: Partial<InternetCircuit>) => void;
  deleteCircuit: (id: string) => void;
  duplicateCircuit: (id: string) => InternetCircuit | null;
  setPrimaryCircuit: (id: string) => void;
  assignCpeToCircuit: (
    circuitId: string,
    assignment: Omit<CpeAssignment, 'id' | 'circuitId' | 'physicalStatus'>,
    targetRouter?: { deviceId: string; interfaceId: string },
    createLinkIfMissing?: boolean
  ) => void;
  unassignCpeFromCircuit: (circuitId: string) => void;

  // Workload Profiles & Assignments Actions
  addWorkload: (workload: Omit<DeviceWorkload, 'id' | 'createdAt' | 'updatedAt'>) => DeviceWorkload;
  updateWorkload: (id: string, updates: Partial<DeviceWorkload>) => void;
  deleteWorkload: (id: string) => void;
  duplicateWorkload: (id: string) => DeviceWorkload | null;
  toggleWorkloadEnabled: (id: string) => void;

  addWorkloadProfile: (profile: Omit<WorkloadProfile, 'id'>) => WorkloadProfile;
  updateWorkloadProfile: (id: string, updates: Partial<WorkloadProfile>) => void;
  deleteWorkloadProfile: (id: string) => { success: boolean; error?: string };
  loadScenarioPreset: (scenarioId: string) => boolean;

  // RouterOS Console & Unified Configuration Actions
  routerConsoleState: { isOpen: boolean; deviceId: string | null; initialTab: 'terminal' | 'winbox' | 'backup' };
  openRouterConsole: (deviceId: string, initialTab?: 'terminal' | 'winbox' | 'backup') => void;
  closeRouterConsole: () => void;
  getRouterOsConfig: (deviceId: string) => import('../types/routerOs').RouterOsDeviceConfig | null;
  mutateRouterOsConfig: (
    deviceId: string,
    actionName: string,
    mutationFn: (device: NetworkDevice, config: import('../types/routerOs').RouterOsDeviceConfig) => import('../services/routerOsConfigService').MutationResult
  ) => import('../services/routerOsConfigService').MutationResult;

  // User Guide & Application Help Center Actions
  userGuideState: {
    isOpen: boolean;
    activeSection: GuideSectionId;
    searchQuery: string;
  };
  openUserGuide: (section?: GuideSectionId, searchQuery?: string) => void;
  closeUserGuide: () => void;
  setUserGuideSection: (section: GuideSectionId) => void;
  setUserGuideSearchQuery: (query: string) => void;


  // Phase 6: Event Logs
  addEventLog: (entry: Omit<import('../types/network').NetworkEventLog, 'id' | 'timestamp'>) => void;

  // Custom Device Catalog Actions
  loadCustomDevices: () => Promise<void>;
  openDeviceBuilder: (device?: UnifiedCatalogDevice) => void;
  closeDeviceBuilder: () => void;
  closeUsageProtectionModal: () => void;
  saveCustomDevice: (device: UnifiedCatalogDevice) => Promise<UnifiedCatalogDevice | null>;
  deleteCustomDevice: (id: string, force?: boolean) => Promise<{ success: boolean; error?: string; usage?: any }>;
  duplicateCustomDevice: (id: string) => Promise<UnifiedCatalogDevice | null>;
  exportCustomDeviceJson: (device: UnifiedCatalogDevice) => string;
  exportAllCustomDevicesJson: () => string;
  importCustomDeviceJson: (jsonStr: string) => Promise<{ success: boolean; count?: number; error?: string }>;

  // CLI & Validation
  executeCli: (command: string) => { success: boolean; output: string };
  validateCurrentTopology: () => DiagnosticResult[];
  undo: () => void;
  redo: () => void;
}

// Helper to normalize routerOsVersion on project devices against DEVICE_CATALOG
function normalizeProjectDevices(project: NetworkProject): NetworkProject {
  const normalizedDevices = (project.devices || []).map((dev) => {
    const builtInModel = DEVICE_CATALOG.find((m) => m.id === dev.modelId);
    if (builtInModel && !builtInModel.routerOsVersion && dev.routerOsVersion !== 'none') {
      return { ...dev, routerOsVersion: 'none' as const };
    }
    return dev;
  });
  return { ...project, devices: normalizedDevices };
}

// Helper to push history
function recordHistory(state: NetworkStoreState): { historyPast: NetworkProject[]; historyFuture: NetworkProject[] } {
  const currentSnapshot = JSON.parse(JSON.stringify(state.activeProject));
  const newPast = [...state.historyPast.slice(-25), currentSnapshot];
  return {
    historyPast: newPast,
    historyFuture: [],
  };
}

export const useNetworkStore = create<NetworkStoreState>((set, get) => {
  const initialProject = createDefaultCampusProject();
  const initialDiags = validateTopology(initialProject.devices, initialProject.links, initialProject.vlans);

  return {
    projects: [initialProject],
    activeProject: initialProject,
    isLoading: false,
    selectedDeviceId: null,
    selectedLinkId: null,
    selectedInterfaceId: null,
    connectingFrom: null,
    pendingConnectionModal: null,
    diagnostics: initialDiags,
    auditLogs: [],
    // Custom Device State
    customDevices: [],
    isDeviceBuilderOpen: false,
    editingCustomDevice: null,
    usageProtectionModal: null,

    // Phase 4-6 Initial States
    activePacketTrace: null,
    simulationHistory: [],
    ispServices: createDefaultIspProfiles(),
    trafficStats: {},
    circuitTelemetry: {},
    deviceProcessingMetrics: {},
    workloadSummary: null,
    routerConsoleState: {
      isOpen: false,
      deviceId: null,
      initialTab: 'terminal',
    },
    userGuideState: {
      isOpen: false,
      activeSection: 'getting-started',
      searchQuery: '',
    },
    isTrafficRunning: true,
    trafficTickSeed: 0,
    eventLogs: [
      {
        id: `ev-init-1`,
        timestamp: new Date().toISOString(),
        type: 'device_state',
        severity: 'info',
        title: 'Core Router Bootstrapped',
        message: 'CORE-CCR2116 RouterOS v7 kernel initialized with 16 physical interfaces.',
        targetId: 'dev-core-router-1',
      },
      {
        id: `ev-init-2`,
        timestamp: new Date().toISOString(),
        type: 'link_state',
        severity: 'info',
        title: 'Optical Backbone SFP+ Carrier Sync',
        message: '10Gbps Single-Mode Fiber link negotiated between CORE-CCR2116 and SW-DIST-CRS326.',
        targetId: 'link-fiber-backbone-1',
      },
    ],
    cliHistory: [
      {
        command: 'system init',
        output: 'NETLAB Engine v1.0.0 Initialized.\nTopology model: Kampus Terpadu Core & SFP+ Fiber Ring.\nTraffic Telemetry: RUNNING.\nType "help" for interactive command options.',
        timestamp: new Date().toLocaleTimeString(),
      },
    ],
    historyPast: [],
    historyFuture: [],
    isDarkTheme: true,

    init: async () => {
      set({ isLoading: true });
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const rawProjectsList: NetworkProject[] = await res.json();
          if (rawProjectsList.length > 0) {
            const projectsList = rawProjectsList.map(normalizeProjectDevices);
            const active = projectsList[0];
            const diags = validateTopology(active.devices, active.links, active.vlans);
            set({ projects: projectsList, activeProject: active, diagnostics: diags });
          }
        }
        // Fetch audit logs
        const auditRes = await fetch('/api/audit-logs');
        if (auditRes.ok) {
          const logs = await auditRes.json();
          set({ auditLogs: logs });
        }

        // Fetch custom devices catalog
        await get().loadCustomDevices();

        // Generate initial link traffic telemetry stats
        const { activeProject } = get();
        const initialStats: Record<string, LinkTrafficStats> = {};
        for (const link of activeProject.links) {
          initialStats[link.id] = generateLinkTrafficStats(link, 1);
        }
        set({ trafficStats: initialStats });
      } catch (err) {
        console.warn('API not reachable yet, operating with local storage persistence fallback:', err);
      } finally {
        set({ isLoading: false });
      }
    },

    toggleTheme: () => {
      set((state) => {
        const nextTheme = !state.isDarkTheme;
        if (nextTheme) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        return { isDarkTheme: nextTheme };
      });
    },

    setViewport: (vp) => {
      set((state) => {
        const cur = state.activeProject.viewport;
        if (cur && cur.x === vp.x && cur.y === vp.y && cur.zoom === vp.zoom) {
          return state;
        }
        return {
          activeProject: {
            ...state.activeProject,
            viewport: vp,
          },
        };
      });
    },

    setSelectedDevice: (id) => set({ selectedDeviceId: id, selectedLinkId: null, selectedInterfaceId: null }),
    setSelectedLink: (id) => set({ selectedLinkId: id, selectedDeviceId: null, selectedInterfaceId: null }),
    setSelectedInterface: (id) => set({ selectedInterfaceId: id }),
    setConnectingFrom: (connectingFrom) => set({ connectingFrom }),
    setPendingConnectionModal: (pendingConnectionModal) => set({ pendingConnectionModal }),

    switchProject: (projectId) => {
      const state = get();
      const target = state.projects.find((p) => p.id === projectId);
      if (target) {
        const diags = validateTopology(target.devices, target.links, target.vlans);
        set({
          activeProject: target,
          diagnostics: diags,
          selectedDeviceId: null,
          selectedLinkId: null,
          historyPast: [],
          historyFuture: [],
        });
      }
    },

    createNewProject: (name, description = '') => {
      const state = get();
      const newProj: NetworkProject = {
        id: `project-${Date.now()}`,
        name: name.trim() || 'Untitled Project',
        description,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        devices: [],
        links: [],
        vlans: [
          { id: 1, name: 'DEFAULT', subnet: '192.168.88.0/24', gatewayIp: '192.168.88.1', dhcpEnabled: true, color: '#3b82f6' },
        ],
        ispProviders: [],
        circuits: [],
        cpeAssignments: [],
        workloads: [],
        workloadProfiles: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      };

      const updatedProjects = [...state.projects, newProj];
      set({
        projects: updatedProjects,
        activeProject: newProj,
        diagnostics: [],
        selectedDeviceId: null,
        selectedLinkId: null,
        historyPast: [],
        historyFuture: [],
      });
      get().saveProjectToServer();
    },

    saveProjectToServer: async () => {
      const { activeProject } = get();
      try {
        await fetch(`/api/projects/${activeProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activeProject),
        });
      } catch (err) {
        console.error('Failed to sync project with backend API:', err);
      }
    },

    deleteProject: async (projectId) => {
      const state = get();
      if (state.projects.length <= 1) return;
      const filtered = state.projects.filter((p) => p.id !== projectId);
      const nextActive = filtered[0];
      set({
        projects: filtered,
        activeProject: nextActive,
        diagnostics: validateTopology(nextActive.devices, nextActive.links, nextActive.vlans),
        selectedDeviceId: null,
        selectedLinkId: null,
      });
      try {
        await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete project on backend API:', err);
      }
    },

    importProjectJson: (jsonString) => {
      try {
        const parsed = JSON.parse(jsonString) as NetworkProject;
        if (!parsed.id || !Array.isArray(parsed.devices) || !Array.isArray(parsed.links)) {
          return false;
        }
        const state = get();
        const diags = validateTopology(parsed.devices, parsed.links, parsed.vlans || []);
        const updatedProjects = state.projects.filter((p) => p.id !== parsed.id).concat(parsed);
        set({
          projects: updatedProjects,
          activeProject: parsed,
          diagnostics: diags,
          selectedDeviceId: null,
          selectedLinkId: null,
        });
        get().saveProjectToServer();
        return true;
      } catch {
        return false;
      }
    },

    exportProjectJson: () => {
      return JSON.stringify(get().activeProject, null, 2);
    },

    // ==========================================
    // Custom Device Catalog Actions
    // ==========================================

    loadCustomDevices: async () => {
      try {
        const res = await fetch('/api/custom-devices');
        if (res.ok) {
          const list = await res.json();
          set({ customDevices: list });
        }
      } catch (err) {
        console.error('Failed to load custom devices:', err);
      }
    },

    openDeviceBuilder: (device) => {
      set({
        isDeviceBuilderOpen: true,
        editingCustomDevice: device || null,
      });
    },

    closeDeviceBuilder: () => {
      set({
        isDeviceBuilderOpen: false,
        editingCustomDevice: null,
      });
    },

    closeUsageProtectionModal: () => {
      set({ usageProtectionModal: null });
    },

    saveCustomDevice: async (device) => {
      try {
        const isEditing = Boolean(device.id && get().customDevices.some((d) => d.id === device.id));
        const url = isEditing ? `/api/custom-devices/${device.id}` : '/api/custom-devices';
        const method = isEditing ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(device),
        });

        if (res.ok) {
          const saved: UnifiedCatalogDevice = await res.json();
          set((s) => ({
            customDevices: isEditing
              ? s.customDevices.map((d) => (d.id === saved.id ? saved : d))
              : [...s.customDevices, saved],
            isDeviceBuilderOpen: false,
            editingCustomDevice: null,
          }));

          get().addEventLog({
            type: 'device_state',
            severity: 'info',
            title: isEditing ? 'Custom Device Updated' : 'Custom Device Registered',
            message: `${saved.brand} ${saved.modelNumber} (v${saved.specificationVersion}) saved to catalog.`,
            targetId: saved.id,
          });

          return saved;
        }
        return null;
      } catch (err) {
        console.error('Failed to save custom device:', err);
        return null;
      }
    },

    deleteCustomDevice: async (id, force = false) => {
      try {
        const res = await fetch(`/api/custom-devices/${id}?force=${force ? 'true' : 'false'}`, {
          method: 'DELETE',
        });

        if (res.status === 409) {
          const data = await res.json();
          const target = get().customDevices.find((d) => d.id === id);
          set({
            usageProtectionModal: {
              isOpen: true,
              deviceId: id,
              deviceName: target ? `${target.brand} ${target.modelNumber}` : id,
              usage: data.usage,
            },
          });
          return { success: false, error: data.error, usage: data.usage };
        }

        if (res.ok) {
          const target = get().customDevices.find((d) => d.id === id);
          set((s) => ({
            customDevices: s.customDevices.filter((d) => d.id !== id),
            usageProtectionModal: null,
          }));

          get().addEventLog({
            type: 'device_state',
            severity: 'warning',
            title: 'Custom Device Deleted',
            message: target ? `${target.brand} ${target.modelNumber} removed from catalog.` : `Device ${id} deleted.`,
            targetId: id,
          });

          return { success: true };
        }

        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.error || 'Failed to delete device' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },

    duplicateCustomDevice: async (id) => {
      try {
        const res = await fetch(`/api/custom-devices/${id}/duplicate`, { method: 'POST' });
        if (res.ok) {
          const copy: UnifiedCatalogDevice = await res.json();
          set((s) => ({ customDevices: [...s.customDevices, copy] }));

          get().addEventLog({
            type: 'device_state',
            severity: 'info',
            title: 'Custom Device Duplicated',
            message: `Template duplicated to ${copy.name}.`,
            targetId: copy.id,
          });

          return copy;
        }
        return null;
      } catch (err) {
        console.error('Failed to duplicate custom device:', err);
        return null;
      }
    },

    exportCustomDeviceJson: (device) => {
      return JSON.stringify(device, null, 2);
    },

    exportAllCustomDevicesJson: () => {
      return JSON.stringify(get().customDevices, null, 2);
    },

    importCustomDeviceJson: async (jsonStr) => {
      try {
        const parsed = JSON.parse(jsonStr);
        const devicesToImport = Array.isArray(parsed) ? parsed : [parsed];
        let importedCount = 0;

        for (const dev of devicesToImport) {
          if (!dev.brand || !dev.modelNumber || !dev.ports) continue;
          const existing = get().customDevices.find((d) => d.id === dev.id);
          const deviceToSave = {
            ...dev,
            id: existing ? `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}` : dev.id,
            isCustom: true,
          };

          const res = await fetch('/api/custom-devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deviceToSave),
          });

          if (res.ok) {
            importedCount++;
          }
        }

        await get().loadCustomDevices();
        return { success: importedCount > 0, count: importedCount };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },

    // ==========================================
    // Topology Mutations
    // ==========================================

    addDevice: (modelId, name, x, y) => {
      const state = get();
      const builtInModel = DEVICE_CATALOG.find((m) => m.id === modelId);
      const customModel = !builtInModel ? state.customDevices.find((c) => c.id === modelId) : null;
      if (!builtInModel && !customModel) return null;

      const history = recordHistory(state);
      const newDevId = `dev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      let newDev: NetworkDevice;

      if (customModel) {
        const devName = name || `${customModel.modelNumber}-${state.activeProject.devices.length + 1}`;
        const unifiedInterfaces = createDeviceInterfacesFromUnified(customModel, newDevId);
        const osLower = (customModel.hardware.operatingSystem || '').toLowerCase();
        const brandLower = (customModel.brand || '').toLowerCase();
        const isRos =
          osLower.includes('routeros') ||
          osLower.includes('mikrotik') ||
          osLower === 'v6' ||
          osLower === 'v7' ||
          (brandLower.includes('mikrotik') && !osLower.includes('swos'));
        const resolvedRosVersion: 'v6' | 'v7' | 'none' = isRos
          ? osLower.includes('v6') && !osLower.includes('v7')
            ? 'v6'
            : 'v7'
          : 'none';

        newDev = {
          id: newDevId,
          name: devName,
          modelId: customModel.id,
          modelName: `${customModel.brand} ${customModel.modelNumber}`,
          category: (customModel.category === 'l3-switch' ? 'switch' : (customModel.category.includes('wireless') ? 'wireless' : (customModel.category === 'isp-gateway' ? 'wan' : customModel.category))) as any,
          vendor: customModel.brand,
          routerOsVersion: resolvedRosVersion,
          x: x ?? 200 + Math.random() * 150,
          y: y ?? 150 + Math.random() * 150,
          status: 'RUN',
          specificationVersion: customModel.specificationVersion,
          interfaces: unifiedInterfaces,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      } else {
        const model = builtInModel!;
        const devName = name || `${model.model.split(' ')[0]}-${state.activeProject.devices.length + 1}`;
        const resolvedRosVersion: 'v6' | 'v7' | 'none' = model.routerOsVersion
          ? model.routerOsVersion.startsWith('v7')
            ? 'v7'
            : 'v6'
          : 'none';

        newDev = {
          id: newDevId,
          name: devName,
          modelId: model.id,
          modelName: model.model,
          category: model.category,
          vendor: model.vendor,
          routerOsVersion: resolvedRosVersion,
          x: x ?? 200 + Math.random() * 150,
          y: y ?? 150 + Math.random() * 150,
          status: 'RUN',
          specificationVersion: 1,
          interfaces: model.ports.map((p) => ({
            id: `${newDevId}_${p.id}`,
            deviceId: newDevId,
            name: p.name.split(' ')[0],
            type: p.type,
            adminState: 'up',
            operationalState: 'RUN',
            macAddress: `00:50:56:${Math.floor(Math.random() * 89 + 10)}:${p.id.slice(-2).padStart(2, '0')}:${Math.floor(Math.random() * 89 + 10)}`,
            mode: p.type === 'sfp-plus' || p.type === 'sfp' ? 'trunk' : 'access',
            speed: p.defaultSpeed,
            duplex: 'full',
            mtu: 1500,
            pvid: 1,
            transceiver: p.type === 'sfp-plus' ? 'sfpplus-10g-lr' : (p.type === 'sfp' ? 'sfp-1g-lx' : undefined),
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      const updatedDevices = [...state.activeProject.devices, newDev];
      const updatedProject = {
        ...state.activeProject,
        devices: updatedDevices,
        updatedAt: new Date().toISOString(),
      };
      const diags = validateTopology(updatedDevices, updatedProject.links, updatedProject.vlans);

      set({
        ...history,
        activeProject: updatedProject,
        diagnostics: diags,
        selectedDeviceId: newDevId,
      });

      get().saveProjectToServer();
      return newDev;
    },

    updateDevicePosition: (deviceId, x, y) => {
      set((state) => {
        const target = state.activeProject.devices.find((d) => d.id === deviceId);
        if (!target || (target.x === x && target.y === y)) {
          return state;
        }
        return {
          activeProject: {
            ...state.activeProject,
            devices: state.activeProject.devices.map((d) => (d.id === deviceId ? { ...d, x, y } : d)),
          },
        };
      });
    },

    updateDevice: (deviceId, updates) => {
      const state = get();
      const history = recordHistory(state);
      const updatedDevices = state.activeProject.devices.map((d) => {
        if (d.id !== deviceId) return d;
        const merged = { ...d, ...updates, updatedAt: new Date().toISOString() };
        if (!hasRouterOsSupport(merged, state.customDevices)) {
          return merged;
        }
        return RouterOsConfigService.syncFromDeviceToConfig(merged);
      });
      const updatedProject = { ...state.activeProject, devices: updatedDevices };
      const diags = validateTopology(updatedDevices, updatedProject.links, updatedProject.vlans);

      set({
        ...history,
        activeProject: updatedProject,
        diagnostics: diags,
      });
      get().saveProjectToServer();
    },

    removeDevice: (deviceId) => {
      const state = get();
      const history = recordHistory(state);
      const updatedDevices = state.activeProject.devices.filter((d) => d.id !== deviceId);
      const updatedLinks = state.activeProject.links.filter(
        (l) => l.sourceDeviceId !== deviceId && l.targetDeviceId !== deviceId
      );
      const updatedProject = {
        ...state.activeProject,
        devices: updatedDevices,
        links: updatedLinks,
      };
      const diags = validateTopology(updatedDevices, updatedLinks, updatedProject.vlans);

      set({
        ...history,
        activeProject: updatedProject,
        diagnostics: diags,
        selectedDeviceId: state.selectedDeviceId === deviceId ? null : state.selectedDeviceId,
      });
      get().saveProjectToServer();
    },

    createLink: (
      sourceDeviceId,
      sourceInterfaceId,
      targetDeviceId,
      targetInterfaceId,
      mediaType = 'copper-cat6',
      cableLengthMeters = 5,
      sourceTransceiver,
      targetTransceiver
    ) => {
      const state = get();
      // Check if either port is already connected
      const existingLink = state.activeProject.links.find(
        (l) =>
          l.sourceInterfaceId === sourceInterfaceId ||
          l.targetInterfaceId === sourceInterfaceId ||
          l.sourceInterfaceId === targetInterfaceId ||
          l.targetInterfaceId === targetInterfaceId
      );

      if (existingLink) {
        return null;
      }

      const history = recordHistory(state);
      const isFiber = mediaType === 'fiber-smf' || mediaType === 'fiber-mmf';
      const linkId = `link-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const newLink: NetworkLink = {
        id: linkId,
        sourceDeviceId,
        sourceInterfaceId,
        targetDeviceId,
        targetInterfaceId,
        mediaType,
        cableLengthMeters,
        speed: isFiber ? '10G' : '1G',
        status: 'RUN',
        isFiber,
        sourceTransceiver,
        targetTransceiver,
        color: mediaType === 'fiber-smf' ? '#eab308' : (mediaType === 'fiber-mmf' ? '#06b6d4' : '#3b82f6'),
        createdAt: new Date().toISOString(),
      };

      const updatedLinks = [...state.activeProject.links, newLink];
      const updatedProject = { ...state.activeProject, links: updatedLinks };
      const diags = validateTopology(state.activeProject.devices, updatedLinks, state.activeProject.vlans);

      set({
        ...history,
        activeProject: updatedProject,
        diagnostics: diags,
        connectingFrom: null,
        pendingConnectionModal: null,
        selectedLinkId: linkId,
      });

      get().saveProjectToServer();
      return newLink;
    },

    removeLink: (linkId) => {
      const state = get();
      const history = recordHistory(state);
      const updatedLinks = state.activeProject.links.filter((l) => l.id !== linkId);
      const updatedProject = { ...state.activeProject, links: updatedLinks };
      const diags = validateTopology(state.activeProject.devices, updatedLinks, state.activeProject.vlans);

      set({
        ...history,
        activeProject: updatedProject,
        diagnostics: diags,
        selectedLinkId: state.selectedLinkId === linkId ? null : state.selectedLinkId,
      });
      get().saveProjectToServer();
    },

    updateLink: (linkId, updates) => {
      const state = get();
      const history = recordHistory(state);
      const updatedLinks = state.activeProject.links.map((l) =>
        l.id === linkId ? { ...l, ...updates } : l
      );
      const updatedProject = { ...state.activeProject, links: updatedLinks };
      const diags = validateTopology(state.activeProject.devices, updatedLinks, state.activeProject.vlans);

      set({
        ...history,
        activeProject: updatedProject,
        diagnostics: diags,
      });
      get().saveProjectToServer();
    },

    updateInterface: (deviceId, interfaceId, updates) => {
      const state = get();
      const history = recordHistory(state);
      const updatedDevices = state.activeProject.devices.map((dev) => {
        if (dev.id !== deviceId) return dev;
        const mergedDev = {
          ...dev,
          interfaces: dev.interfaces.map((iface) =>
            iface.id === interfaceId ? { ...iface, ...updates } : iface
          ),
        };
        return RouterOsConfigService.syncFromDeviceToConfig(mergedDev);
      });

      const updatedProject = { ...state.activeProject, devices: updatedDevices };
      const diags = validateTopology(updatedDevices, updatedProject.links, updatedProject.vlans);

      set({
        ...history,
        activeProject: updatedProject,
        diagnostics: diags,
      });
      get().saveProjectToServer();
    },

    addVlan: (vlan) => {
      const state = get();
      const history = recordHistory(state);
      const existing = state.activeProject.vlans.findIndex((v) => v.id === vlan.id);
      let updatedVlans: NetworkVlan[];
      if (existing >= 0) {
        updatedVlans = [...state.activeProject.vlans];
        updatedVlans[existing] = vlan;
      } else {
        updatedVlans = [...state.activeProject.vlans, vlan];
      }
      const updatedProject = { ...state.activeProject, vlans: updatedVlans };
      const diags = validateTopology(state.activeProject.devices, state.activeProject.links, updatedVlans);

      set({
        ...history,
        activeProject: updatedProject,
        diagnostics: diags,
      });
      get().saveProjectToServer();
    },

    updateVlan: (vlanId, updates) => {
      const state = get();
      const history = recordHistory(state);
      const updatedVlans = state.activeProject.vlans.map((v) =>
        v.id === vlanId ? { ...v, ...updates } : v
      );
      const updatedProject = { ...state.activeProject, vlans: updatedVlans };
      const diags = validateTopology(state.activeProject.devices, state.activeProject.links, updatedVlans);

      set({
        ...history,
        activeProject: updatedProject,
        diagnostics: diags,
      });
      get().saveProjectToServer();
    },

    removeVlan: (vlanId) => {
      const state = get();
      const history = recordHistory(state);
      const updatedVlans = state.activeProject.vlans.filter((v) => v.id !== vlanId);
      const updatedProject = { ...state.activeProject, vlans: updatedVlans };
      const diags = validateTopology(state.activeProject.devices, state.activeProject.links, updatedVlans);

      set({
        ...history,
        activeProject: updatedProject,
        diagnostics: diags,
      });
      get().saveProjectToServer();
    },

    // ==========================================
    // Phase 4: Packet Tracer Simulation Action
    // ==========================================
    runPing: (sourceDeviceId, targetIp, protocol = 'ICMP') => {
      const state = get();
      const simResult = simulatePacketTrace(sourceDeviceId, targetIp, protocol, state.activeProject);

      set((s) => ({
        activePacketTrace: simResult,
        simulationHistory: [simResult, ...s.simulationHistory.slice(0, 19)],
      }));

      // Add audit log & event log
      get().addEventLog({
        type: 'simulation',
        severity: simResult.success ? 'info' : 'warning',
        title: `${protocol} Simulation: ${simResult.sourceDeviceName} -> ${targetIp}`,
        message: simResult.summary,
        targetId: sourceDeviceId,
      });

      return simResult;
    },

    clearPacketTrace: () => {
      set({ activePacketTrace: null });
    },

    // ==========================================
    // Phase 5: ISP & Traffic Telemetry
    // ==========================================
    toggleTrafficSimulation: () => {
      set((s) => {
        const next = !s.isTrafficRunning;
        get().addEventLog({
          type: 'simulation',
          severity: 'info',
          title: `Traffic Telemetry Engine ${next ? 'Resumed' : 'Paused'}`,
          message: `Live RX/TX bandwidth calculation and frame counters are ${next ? 'active' : 'halted'}.`,
          targetId: 'engine',
        });
        return { isTrafficRunning: next };
      });
    },

    updateTrafficTick: () => {
      const { activeProject, trafficStats, circuitTelemetry, trafficTickSeed, isTrafficRunning } = get();
      if (!isTrafficRunning) return;

      const nextSeed = trafficTickSeed + 1;
      const simResult = runComprehensiveTrafficSimulation(
        activeProject,
        nextSeed,
        trafficStats,
        circuitTelemetry
      );

      // Emit new events generated by simulator
      for (const ev of simResult.newCongestionEvents) {
        get().addEventLog(ev);
      }

      set({
        trafficTickSeed: nextSeed,
        trafficStats: simResult.linkStats,
        circuitTelemetry: simResult.circuitTelemetry,
        deviceProcessingMetrics: simResult.deviceProcessingMetrics,
        workloadSummary: simResult.summary,
      });
    },

    addIspService: (isp) => {
      set((s) => ({
        ispServices: [...s.ispServices, isp],
      }));
    },

    updateIspService: (id, updates) => {
      set((s) => ({
        ispServices: s.ispServices.map((isp) => (isp.id === id ? { ...isp, ...updates } : isp)),
      }));
    },

    removeIspService: (id) => {
      set((s) => ({
        ispServices: s.ispServices.filter((isp) => isp.id !== id),
      }));
    },

    // Dynamic ISP Providers Actions
    addIspProvider: (providerData) => {
      const state = get();
      const history = recordHistory(state);
      const newProvider: IspProvider = {
        ...providerData,
        id: `isp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: providerData.status || 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updatedProviders = [...(state.activeProject.ispProviders || []), newProvider];
      const updatedProject = { ...state.activeProject, ispProviders: updatedProviders };
      set({
        ...history,
        activeProject: updatedProject,
      });
      get().addEventLog({
        type: 'simulation',
        severity: 'info',
        title: 'ISP Provider Registered',
        message: `Registered ISP provider '${newProvider.name}' (${newProvider.type}).`,
        targetId: newProvider.id,
      });
      get().saveProjectToServer();
      return newProvider;
    },

    updateIspProvider: (id, updates) => {
      const state = get();
      const history = recordHistory(state);
      const updatedProviders = (state.activeProject.ispProviders || []).map((isp) =>
        isp.id === id ? { ...isp, ...updates, updatedAt: new Date().toISOString() } : isp
      );
      const updatedProject = { ...state.activeProject, ispProviders: updatedProviders };
      set({
        ...history,
        activeProject: updatedProject,
      });
      get().saveProjectToServer();
    },

    deleteIspProvider: (id) => {
      const state = get();
      const attachedCircuits = (state.activeProject.circuits || []).filter((c) => c.ispProviderId === id);
      if (attachedCircuits.length > 0) {
        return {
          success: false,
          error: `Cannot delete ISP provider. It has ${attachedCircuits.length} active circuit(s): ${attachedCircuits.map((c) => c.circuitName).join(', ')}. Please delete or reassign them first.`,
        };
      }
      const history = recordHistory(state);
      const updatedProviders = (state.activeProject.ispProviders || []).filter((isp) => isp.id !== id);
      const updatedProject = { ...state.activeProject, ispProviders: updatedProviders };
      set({
        ...history,
        activeProject: updatedProject,
      });
      get().addEventLog({
        type: 'simulation',
        severity: 'warning',
        title: 'ISP Provider Removed',
        message: `Removed ISP provider ID '${id}'.`,
        targetId: id,
      });
      get().saveProjectToServer();
      return { success: true };
    },

    duplicateIspProvider: (id) => {
      const state = get();
      const target = (state.activeProject.ispProviders || []).find((p) => p.id === id);
      if (!target) return null;
      const copy: IspProvider = {
        ...target,
        id: `isp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: `${target.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updatedProviders = [...(state.activeProject.ispProviders || []), copy];
      const updatedProject = { ...state.activeProject, ispProviders: updatedProviders };
      set({
        activeProject: updatedProject,
      });
      get().addEventLog({
        type: 'simulation',
        severity: 'info',
        title: 'ISP Provider Duplicated',
        message: `Duplicated provider '${target.name}' to '${copy.name}'.`,
        targetId: copy.id,
      });
      get().saveProjectToServer();
      return copy;
    },

    toggleIspProviderStatus: (id) => {
      const state = get();
      const target = (state.activeProject.ispProviders || []).find((p) => p.id === id);
      if (!target) return;
      const nextStatus = target.status === 'active' ? 'inactive' : 'active';
      get().updateIspProvider(id, { status: nextStatus });
    },

    // Internet Circuits Actions
    addCircuit: (circuitData) => {
      const state = get();
      const history = recordHistory(state);
      const newCircuit: InternetCircuit = {
        ...circuitData,
        id: `circ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      let updatedCircuits = state.activeProject.circuits || [];
      if (newCircuit.isPrimaryWan) {
        updatedCircuits = updatedCircuits.map((c) => ({ ...c, isPrimaryWan: false }));
      }
      updatedCircuits = [...updatedCircuits, newCircuit];
      const updatedProject = { ...state.activeProject, circuits: updatedCircuits };
      set({
        ...history,
        activeProject: updatedProject,
      });
      get().addEventLog({
        type: 'simulation',
        severity: 'info',
        title: 'Internet Circuit Added',
        message: `Added circuit '${newCircuit.circuitName}' (${newCircuit.downloadBandwidth}${newCircuit.downloadUnit} / ${newCircuit.uploadBandwidth}${newCircuit.uploadUnit}).`,
        targetId: newCircuit.id,
      });
      get().saveProjectToServer();
      return newCircuit;
    },

    updateCircuit: (id, updates) => {
      const state = get();
      const history = recordHistory(state);
      let updatedCircuits = state.activeProject.circuits || [];
      if (updates.isPrimaryWan) {
        updatedCircuits = updatedCircuits.map((c) =>
          c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : { ...c, isPrimaryWan: false }
        );
      } else {
        updatedCircuits = updatedCircuits.map((c) =>
          c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        );
      }
      const updatedProject = { ...state.activeProject, circuits: updatedCircuits };
      set({
        ...history,
        activeProject: updatedProject,
      });
      get().saveProjectToServer();
    },

    deleteCircuit: (id) => {
      const state = get();
      const history = recordHistory(state);
      const updatedCircuits = (state.activeProject.circuits || []).filter((c) => c.id !== id);
      const updatedProject = { ...state.activeProject, circuits: updatedCircuits };
      set({
        ...history,
        activeProject: updatedProject,
      });
      get().addEventLog({
        type: 'simulation',
        severity: 'warning',
        title: 'Circuit Deleted',
        message: `Removed Internet circuit ID '${id}'.`,
        targetId: id,
      });
      get().saveProjectToServer();
    },

    duplicateCircuit: (id) => {
      const state = get();
      const target = (state.activeProject.circuits || []).find((c) => c.id === id);
      if (!target) return null;
      const copy: InternetCircuit = {
        ...target,
        id: `circ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        circuitName: `${target.circuitName} (Copy)`,
        isPrimaryWan: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updatedCircuits = [...(state.activeProject.circuits || []), copy];
      const updatedProject = { ...state.activeProject, circuits: updatedCircuits };
      set({
        activeProject: updatedProject,
      });
      get().addEventLog({
        type: 'simulation',
        severity: 'info',
        title: 'Circuit Duplicated',
        message: `Duplicated circuit '${target.circuitName}' to '${copy.circuitName}'.`,
        targetId: copy.id,
      });
      get().saveProjectToServer();
      return copy;
    },

    setPrimaryCircuit: (id) => {
      const state = get();
      const history = recordHistory(state);
      const updatedCircuits = (state.activeProject.circuits || []).map((c) => ({
        ...c,
        isPrimaryWan: c.id === id,
      }));
      const updatedProject = { ...state.activeProject, circuits: updatedCircuits };
      set({
        ...history,
        activeProject: updatedProject,
      });
      const circ = (state.activeProject.circuits || []).find((c) => c.id === id);
      get().addEventLog({
        type: 'simulation',
        severity: 'info',
        title: 'Primary WAN Updated',
        message: `Circuit '${circ?.circuitName || id}' designated as Primary WAN gateway.`,
        targetId: id,
      });
      get().saveProjectToServer();
    },

    assignCpeToCircuit: (circuitId, assignment, targetRouter, createLinkIfMissing = true) => {
      const state = get();
      const history = recordHistory(state);

      // 1. Update circuit
      const updatedCircuits = (state.activeProject.circuits || []).map((c) => {
        if (c.id !== circuitId) return c;
        return {
          ...c,
          cpeDeviceId: assignment.cpeDeviceId,
          cpeWanInterfaceId: assignment.wanInterfaceId,
          cpeLanInterfaceId: assignment.lanInterfaceId,
          targetRouterDeviceId: targetRouter?.deviceId,
          targetRouterInterfaceId: targetRouter?.interfaceId,
          updatedAt: new Date().toISOString(),
        };
      });

      // 2. Update cpeAssignments
      const existingAssignIdx = (state.activeProject.cpeAssignments || []).findIndex(
        (a) => a.circuitId === circuitId
      );
      const newAssign: CpeAssignment = {
        id: existingAssignIdx >= 0 ? state.activeProject.cpeAssignments![existingAssignIdx].id : `cpe-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        circuitId,
        cpeDeviceId: assignment.cpeDeviceId,
        deviceModel: assignment.deviceModel,
        deviceCategory: assignment.deviceCategory,
        managementIp: assignment.managementIp,
        wanInterfaceId: assignment.wanInterfaceId,
        lanInterfaceId: assignment.lanInterfaceId,
        connectionMode: assignment.connectionMode,
        ipMode: assignment.ipMode,
        pppoeUsername: assignment.pppoeUsername,
        pppoePassword: assignment.pppoePassword,
        physicalStatus: 'RUN',
        notes: assignment.notes,
      };

      let updatedAssignments = [...(state.activeProject.cpeAssignments || [])];
      if (existingAssignIdx >= 0) {
        updatedAssignments[existingAssignIdx] = newAssign;
      } else {
        updatedAssignments.push(newAssign);
      }

      // 3. Update router WAN interface if specified
      let updatedDevices = state.activeProject.devices;
      if (targetRouter?.deviceId && targetRouter?.interfaceId) {
        const circ = (state.activeProject.circuits || []).find((c) => c.id === circuitId);
        updatedDevices = updatedDevices.map((dev) => {
          if (dev.id !== targetRouter.deviceId) return dev;
          return {
            ...dev,
            interfaces: dev.interfaces.map((iface) => {
              if (iface.id !== targetRouter.interfaceId) return iface;
              return {
                ...iface,
                mode: 'wan',
                ipAddress: assignment.ipMode === 'static' && circ?.publicIp ? `${circ.publicIp}/30` : iface.ipAddress,
                comment: `WAN: ${circ?.circuitName || 'Internet'} (${assignment.connectionMode.toUpperCase()})`,
              };
            }),
          };
        });
      }

      // 4. Optionally create physical link between CPE LAN and Router WAN if missing
      let updatedLinks = state.activeProject.links;
      if (
        createLinkIfMissing &&
        assignment.cpeDeviceId &&
        assignment.lanInterfaceId &&
        targetRouter?.deviceId &&
        targetRouter?.interfaceId
      ) {
        const linkExists = updatedLinks.some(
          (l) =>
            (l.sourceInterfaceId === assignment.lanInterfaceId && l.targetInterfaceId === targetRouter.interfaceId) ||
            (l.targetInterfaceId === assignment.lanInterfaceId && l.sourceInterfaceId === targetRouter.interfaceId)
        );
        if (!linkExists) {
          const newLink: NetworkLink = {
            id: `link-wan-${Date.now()}`,
            sourceDeviceId: assignment.cpeDeviceId,
            sourceInterfaceId: assignment.lanInterfaceId,
            targetDeviceId: targetRouter.deviceId,
            targetInterfaceId: targetRouter.interfaceId,
            mediaType: 'copper-cat6',
            cableLengthMeters: 5,
            speed: '1G',
            status: 'RUN',
            isFiber: false,
            color: '#38bdf8',
            createdAt: new Date().toISOString(),
          };
          updatedLinks = [...updatedLinks, newLink];
        }
      }

      const updatedProject = {
        ...state.activeProject,
        circuits: updatedCircuits,
        cpeAssignments: updatedAssignments,
        devices: updatedDevices,
        links: updatedLinks,
      };

      set({
        ...history,
        activeProject: updatedProject,
      });

      get().addEventLog({
        type: 'link_state',
        severity: 'info',
        title: 'CPE & WAN Interface Mapped',
        message: `Circuit '${(state.activeProject.circuits || []).find((c) => c.id === circuitId)?.circuitName}' mapped to CPE ${assignment.deviceModel} and router ${targetRouter?.deviceId || 'unspecified'}.`,
        targetId: circuitId,
      });

      get().saveProjectToServer();
    },

    unassignCpeFromCircuit: (circuitId) => {
      const state = get();
      const history = recordHistory(state);

      const updatedCircuits = (state.activeProject.circuits || []).map((c) => {
        if (c.id !== circuitId) return c;
        return {
          ...c,
          cpeDeviceId: undefined,
          cpeWanInterfaceId: undefined,
          cpeLanInterfaceId: undefined,
          targetRouterDeviceId: undefined,
          targetRouterInterfaceId: undefined,
          updatedAt: new Date().toISOString(),
        };
      });

      const updatedAssignments = (state.activeProject.cpeAssignments || []).filter(
        (a) => a.circuitId !== circuitId
      );

      const updatedProject = {
        ...state.activeProject,
        circuits: updatedCircuits,
        cpeAssignments: updatedAssignments,
      };

      set({
        ...history,
        activeProject: updatedProject,
      });

      get().saveProjectToServer();
    },

    // Workload Profile & Assignment Actions
    addWorkload: (workloadData) => {
      const state = get();
      const history = recordHistory(state);

      // Calculate realistic rates
      const effectiveUsers = Math.max(1, workloadData.activeUsers * Math.min(1.0, Math.max(0.05, workloadData.concurrencyFactor || 0.4)));
      let sumDownKbps = 0;
      let sumUpKbps = 0;
      let sumAvgDownKbps = 0;
      let sumAvgUpKbps = 0;
      let sumPeakDownKbps = 0;
      let sumPeakUpKbps = 0;

      for (const app of workloadData.applications || []) {
        const p = Math.max(0.05, Math.min(1.0, app.activityProbability || 0.5));
        sumDownKbps += app.downloadRateKbps * p * effectiveUsers;
        sumUpKbps += app.uploadRateKbps * p * effectiveUsers;
        sumAvgDownKbps += app.averageBitrateKbps * p * effectiveUsers;
        sumAvgUpKbps += app.averageBitrateKbps * 0.45 * p * effectiveUsers;
        sumPeakDownKbps += app.peakBitrateKbps * Math.min(1.0, p * 1.4) * effectiveUsers;
        sumPeakUpKbps += app.peakBitrateKbps * 0.45 * Math.min(1.0, p * 1.4) * effectiveUsers;
      }

      const newWorkload: DeviceWorkload = {
        ...workloadData,
        id: `workload-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        downloadDemandKbps: Math.round(sumDownKbps),
        uploadDemandKbps: Math.round(sumUpKbps),
        averageDownloadKbps: Math.round(sumAvgDownKbps),
        averageUploadKbps: Math.round(sumAvgUpKbps),
        peakDownloadKbps: Math.round(sumPeakDownKbps),
        peakUploadKbps: Math.round(sumPeakUpKbps),
        enabled: workloadData.enabled ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedWorkloads = [...(state.activeProject.workloads || []), newWorkload];
      const updatedProject = { ...state.activeProject, workloads: updatedWorkloads };

      set({
        ...history,
        activeProject: updatedProject,
      });

      get().addEventLog({
        type: 'simulation',
        severity: 'info',
        title: 'Workload Provisioned',
        message: `Provisioned workload '${newWorkload.name}' (${(newWorkload.downloadDemandKbps / 1000).toFixed(1)} Mbps demand, ${newWorkload.activeUsers} users).`,
        targetId: newWorkload.id,
      });

      get().saveProjectToServer();
      return newWorkload;
    },

    updateWorkload: (id, updates) => {
      const state = get();
      const history = recordHistory(state);

      const updatedWorkloads = (state.activeProject.workloads || []).map((w) => {
        if (w.id !== id) return w;
        const merged = { ...w, ...updates, updatedAt: new Date().toISOString() };

        // Recalculate rates
        const effectiveUsers = Math.max(1, merged.activeUsers * Math.min(1.0, Math.max(0.05, merged.concurrencyFactor || 0.4)));
        let sumDownKbps = 0;
        let sumUpKbps = 0;
        let sumAvgDownKbps = 0;
        let sumAvgUpKbps = 0;
        let sumPeakDownKbps = 0;
        let sumPeakUpKbps = 0;

        for (const app of merged.applications || []) {
          const p = Math.max(0.05, Math.min(1.0, app.activityProbability || 0.5));
          sumDownKbps += app.downloadRateKbps * p * effectiveUsers;
          sumUpKbps += app.uploadRateKbps * p * effectiveUsers;
          sumAvgDownKbps += app.averageBitrateKbps * p * effectiveUsers;
          sumAvgUpKbps += app.averageBitrateKbps * 0.45 * p * effectiveUsers;
          sumPeakDownKbps += app.peakBitrateKbps * Math.min(1.0, p * 1.4) * effectiveUsers;
          sumPeakUpKbps += app.peakBitrateKbps * 0.45 * Math.min(1.0, p * 1.4) * effectiveUsers;
        }

        return {
          ...merged,
          downloadDemandKbps: Math.round(sumDownKbps),
          uploadDemandKbps: Math.round(sumUpKbps),
          averageDownloadKbps: Math.round(sumAvgDownKbps),
          averageUploadKbps: Math.round(sumAvgUpKbps),
          peakDownloadKbps: Math.round(sumPeakDownKbps),
          peakUploadKbps: Math.round(sumPeakUpKbps),
        };
      });

      const updatedProject = { ...state.activeProject, workloads: updatedWorkloads };

      set({
        ...history,
        activeProject: updatedProject,
      });

      get().saveProjectToServer();
    },

    deleteWorkload: (id) => {
      const state = get();
      const history = recordHistory(state);
      const updatedWorkloads = (state.activeProject.workloads || []).filter((w) => w.id !== id);
      const updatedProject = { ...state.activeProject, workloads: updatedWorkloads };

      set({
        ...history,
        activeProject: updatedProject,
      });

      get().addEventLog({
        type: 'simulation',
        severity: 'warning',
        title: 'Workload Removed',
        message: `Decommissioned workload profile ID '${id}'.`,
        targetId: id,
      });

      get().saveProjectToServer();
    },

    duplicateWorkload: (id) => {
      const state = get();
      const target = (state.activeProject.workloads || []).find((w) => w.id === id);
      if (!target) return null;

      const copy: DeviceWorkload = {
        ...target,
        id: `workload-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: `${target.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedWorkloads = [...(state.activeProject.workloads || []), copy];
      const updatedProject = { ...state.activeProject, workloads: updatedWorkloads };

      set({
        activeProject: updatedProject,
      });

      get().addEventLog({
        type: 'simulation',
        severity: 'info',
        title: 'Workload Duplicated',
        message: `Duplicated workload '${target.name}' to '${copy.name}'.`,
        targetId: copy.id,
      });

      get().saveProjectToServer();
      return copy;
    },

    toggleWorkloadEnabled: (id) => {
      const state = get();
      const target = (state.activeProject.workloads || []).find((w) => w.id === id);
      if (!target) return;
      get().updateWorkload(id, { enabled: !target.enabled });
    },

    addWorkloadProfile: (profileData) => {
      const state = get();
      const newProfile: WorkloadProfile = {
        ...profileData,
        id: `profile-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        isCustom: true,
      };

      const updatedProfiles = [...(state.activeProject.workloadProfiles || []), newProfile];
      const updatedProject = { ...state.activeProject, workloadProfiles: updatedProfiles };

      set({ activeProject: updatedProject });
      get().saveProjectToServer();
      return newProfile;
    },

    updateWorkloadProfile: (id, updates) => {
      const state = get();
      const updatedProfiles = (state.activeProject.workloadProfiles || []).map((p) =>
        p.id === id ? { ...p, ...updates } : p
      );
      const updatedProject = { ...state.activeProject, workloadProfiles: updatedProfiles };

      set({ activeProject: updatedProject });
      get().saveProjectToServer();
    },

    deleteWorkloadProfile: (id) => {
      const state = get();
      const inUse = (state.activeProject.workloads || []).some((w) => w.profileId === id);
      if (inUse) {
        return {
          success: false,
          error: 'Cannot delete workload profile. It is currently actively assigned to device workloads in the project.',
        };
      }

      const updatedProfiles = (state.activeProject.workloadProfiles || []).filter((p) => p.id !== id);
      const updatedProject = { ...state.activeProject, workloadProfiles: updatedProfiles };

      set({ activeProject: updatedProject });
      get().saveProjectToServer();
      return { success: true };
    },

    loadScenarioPreset: (scenarioId) => {
      const state = get();
      const preset = WORKLOAD_SCENARIO_PRESETS.find((p) => p.id === scenarioId);
      if (!preset) return false;

      const history = recordHistory(state);

      // Convert template workloads into project workloads
      const newWorkloads: DeviceWorkload[] = preset.workloads.map((w, idx) => ({
        ...w,
        id: `workload-scn-${Date.now()}-${idx}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      // Adjust circuits if scenario requires failover
      let updatedCircuits = state.activeProject.circuits || [];
      if (scenarioId === 'scenario-failover-satellite') {
        updatedCircuits = updatedCircuits.map((c) => {
          if (c.serviceType === 'satellite') {
            return { ...c, isPrimaryWan: true, status: 'active' as const };
          }
          return { ...c, isPrimaryWan: false, status: 'down' as const };
        });
      } else {
        // Restore standard primary
        updatedCircuits = updatedCircuits.map((c) => {
          if (c.id === 'circ-astinet-300m') {
            return { ...c, isPrimaryWan: true, status: 'active' as const };
          }
          return { ...c, isPrimaryWan: false, status: 'active' as const };
        });
      }

      const updatedProject = {
        ...state.activeProject,
        workloads: newWorkloads,
        circuits: updatedCircuits,
        updatedAt: new Date().toISOString(),
      };

      set({
        ...history,
        activeProject: updatedProject,
      });

      get().addEventLog({
        type: 'simulation',
        severity: 'info',
        title: `Simulation Scenario Loaded: ${preset.name}`,
        message: `${preset.description} Expected: ${preset.expectedOutcome}`,
        targetId: preset.id,
      });

      get().updateTrafficTick();
      get().validateCurrentTopology();
      get().saveProjectToServer();
      return true;
    },

    openRouterConsole: (deviceId, initialTab = 'terminal') => {
      const state = get();
      const targetDev = state.activeProject.devices.find((d) => d.id === deviceId);
      if (!hasRouterOsSupport(targetDev, state.customDevices)) {
        return;
      }
      set({
        routerConsoleState: {
          isOpen: true,
          deviceId,
          initialTab,
        },
      });
    },

    closeRouterConsole: () => {
      set({
        routerConsoleState: {
          isOpen: false,
          deviceId: null,
          initialTab: 'terminal',
        },
      });
    },

    getRouterOsConfig: (deviceId) => {
      const state = get();
      const dev = state.activeProject.devices.find((d) => d.id === deviceId);
      if (!dev) return null;
      return RouterOsConfigService.ensureConfig(dev);
    },

    mutateRouterOsConfig: (deviceId, actionName, mutationFn) => {
      const state = get();
      const dev = state.activeProject.devices.find((d) => d.id === deviceId);
      if (!dev) {
        return { success: false, error: `Device '${deviceId}' not found.` };
      }

      const currentConfig = RouterOsConfigService.ensureConfig(dev);
      const res = mutationFn(dev, currentConfig);
      if (!res.success || !res.config) {
        return res;
      }

      const history = recordHistory(state);
      // Synchronize back to physical device interfaces & top-level properties
      const syncedDev = RouterOsConfigService.syncToDeviceInterfaces(dev, res.config);

      const updatedDevices = state.activeProject.devices.map((d) => (d.id === deviceId ? syncedDev : d));
      const updatedProject = {
        ...state.activeProject,
        devices: updatedDevices,
        updatedAt: new Date().toISOString(),
      };

      const isGui = actionName.startsWith('GUI:') || actionName.startsWith('Backup:') || actionName.startsWith('Restore:');

      set((s) => ({
        ...history,
        activeProject: updatedProject,
        auditLogs: [
          {
            id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: new Date().toISOString(),
            actor: 'admin',
            action: `RouterOS: ${actionName}`,
            entityType: 'device',
            entityId: dev.id,
            details: `${syncedDev.name} (${dev.modelName}): ${res.message || actionName}`,
            source: isGui ? 'form' : 'cli',
          },
          ...s.auditLogs.slice(0, 99),
        ],
      }));

      get().addEventLog({
        type: 'device_state',
        severity: 'info',
        title: `RouterOS Config (${isGui ? 'Winbox GUI' : 'CLI'}): ${syncedDev.name}`,
        message: `${actionName}${res.message ? ` — ${res.message}` : ''}`,
        targetId: dev.id,
      });

      // Trigger simulation & diagnostics update
      get().updateTrafficTick();
      get().validateCurrentTopology();
      get().saveProjectToServer();

      return res;
    },

    // ==========================================
    // User Guide & Application Help Center Actions
    // ==========================================
    openUserGuide: (section = 'getting-started', searchQuery = '') => {
      set({
        userGuideState: {
          isOpen: true,
          activeSection: section,
          searchQuery,
        },
      });
    },

    closeUserGuide: () => {
      set((s) => ({
        userGuideState: {
          ...s.userGuideState,
          isOpen: false,
        },
      }));
    },

    setUserGuideSection: (section) => {
      set((s) => ({
        userGuideState: {
          ...s.userGuideState,
          activeSection: section,
          searchQuery: '',
        },
      }));
    },

    setUserGuideSearchQuery: (searchQuery) => {
      set((s) => ({
        userGuideState: {
          ...s.userGuideState,
          searchQuery,
        },
      }));
    },




    // ==========================================
    // Phase 6: Event Logs
    // ==========================================
    addEventLog: (entry) => {
      const newLog: NetworkEventLog = {
        id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        ...entry,
      };
      set((s) => ({
        eventLogs: [newLog, ...s.eventLogs.slice(0, 99)],
      }));
    },

    executeCli: (rawCommand) => {
      const state = get();
      const trimmed = rawCommand.trim();
      const parts = trimmed.split(/\s+/);
      const cmd = parts[0]?.toLowerCase();

      // Intercept ping and traceroute
      if (cmd === 'ping' || cmd === 'traceroute') {
        const targetIp = parts[1];
        if (!targetIp) {
          const out = `Usage: ${cmd} <destination_ip> [from=<device_name>]`;
          set((s) => ({ cliHistory: [...s.cliHistory.slice(-50), { command: rawCommand, output: out, timestamp: new Date().toLocaleTimeString(), isError: true }] }));
          return { success: false, output: out };
        }

        let srcDev = state.selectedDeviceId ? state.activeProject.devices.find((d) => d.id === state.selectedDeviceId) : undefined;
        const fromParam = parts.find((p) => p.startsWith('from='))?.split('=')[1];
        if (fromParam) {
          srcDev = state.activeProject.devices.find((d) => d.name.toLowerCase() === fromParam.toLowerCase());
        }
        if (!srcDev) {
          srcDev = state.activeProject.devices.find((d) => d.category === 'endpoint') || state.activeProject.devices[0];
        }

        if (!srcDev) {
          const out = 'Error: No devices exist in topology to originate packet trace.';
          set((s) => ({ cliHistory: [...s.cliHistory.slice(-50), { command: rawCommand, output: out, timestamp: new Date().toLocaleTimeString(), isError: true }] }));
          return { success: false, output: out };
        }

        const sim = get().runPing(srcDev.id, targetIp, cmd === 'traceroute' ? 'UDP' : 'ICMP');
        const hopLines = sim.hops.map(
          (h) => `  ${h.hopNumber}. [${h.action}] ${h.deviceName}${h.ingressInterfaceName ? ` (in:${h.ingressInterfaceName})` : ''}${h.egressInterfaceName ? ` (out:${h.egressInterfaceName})` : ''} -> ${h.details} [${h.latencyMs.toFixed(2)}ms]`
        );
        const out = `${cmd.toUpperCase()} ${targetIp} from ${srcDev.name} (${sim.sourceIp}):\n${hopLines.join('\n')}\n\n[RESULT] ${sim.summary}`;

        set((s) => ({
          cliHistory: [
            ...s.cliHistory.slice(-50),
            { command: rawCommand, output: out, timestamp: new Date().toLocaleTimeString(), isError: !sim.success },
          ],
        }));
        return { success: sim.success, output: out };
      }

      // Intercept show traffic
      if (cmd === 'show' && parts[1]?.toLowerCase() === 'traffic') {
        const stats = state.trafficStats;
        const lines = state.activeProject.links.map((l) => {
          const st = stats[l.id];
          const rxMb = st ? (st.rxBps / 1_000_000).toFixed(1) : '0.0';
          const txMb = st ? (st.txBps / 1_000_000).toFixed(1) : '0.0';
          const util = st ? st.utilizationPercent : 0;
          return `  • ${l.id.padEnd(22)} | ${l.speed.padEnd(4)} | RX: ${rxMb.padStart(6)} Mbps | TX: ${txMb.padStart(6)} Mbps | Util: ${util}% ${st?.isCongested ? '[CONGESTED]' : ''}`;
        });
        const out = `--- LIVE LINK TRAFFIC TELEMETRY ---\n` + (lines.length > 0 ? lines.join('\n') : '  No links configured.');
        set((s) => ({ cliHistory: [...s.cliHistory.slice(-50), { command: rawCommand, output: out, timestamp: new Date().toLocaleTimeString() }] }));
        return { success: true, output: out };
      }

      // Intercept show isp
      if (cmd === 'show' && parts[1]?.toLowerCase() === 'isp') {
        const lines = state.ispServices.map(
          (isp) => `  • [${isp.status}] ${isp.providerName} | Down/Up: ${isp.bandwidthDownMbps}/${isp.bandwidthUpMbps} Mbps | CIR: ${isp.cirDownMbps}/${isp.cirUpMbps} Mbps | Ratio: ${isp.contentionRatio} | IP: ${isp.publicIp}`
        );
        const out = `--- CONFIGURED ISP WAN PROFILES ---\n` + (lines.length > 0 ? lines.join('\n') : '  No ISP services found.');
        set((s) => ({ cliHistory: [...s.cliHistory.slice(-50), { command: rawCommand, output: out, timestamp: new Date().toLocaleTimeString() }] }));
        return { success: true, output: out };
      }

      // Intercept show events
      if (cmd === 'show' && parts[1]?.toLowerCase() === 'events') {
        const lines = state.eventLogs.slice(0, 8).map(
          (e) => `  • [${e.timestamp.slice(11, 19)}] [${e.severity.toUpperCase()}] ${e.title}: ${e.message}`
        );
        const out = `--- RECENT NETWORK EVENT LOGS ---\n` + lines.join('\n');
        set((s) => ({ cliHistory: [...s.cliHistory.slice(-50), { command: rawCommand, output: out, timestamp: new Date().toLocaleTimeString() }] }));
        return { success: true, output: out };
      }

      const result = parseNetlabCommand(rawCommand, {
        devices: state.activeProject.devices,
        links: state.activeProject.links,
        vlans: state.activeProject.vlans,
      });

      if (result.output === '__CLEAR__') {
        set({ cliHistory: [] });
        return { success: true, output: '' };
      }

      // If command performed an action, execute it in store
      if (result.actionTaken) {
        const act = result.actionTaken;
        if (act.type === 'ADD_DEVICE') {
          const p = act.payload as any;
          get().addDevice(p.modelId, p.name, p.x, p.y);
        } else if (act.type === 'REMOVE_DEVICE') {
          const p = act.payload as any;
          get().removeDevice(p.id);
        } else if (act.type === 'ADD_LINK') {
          const p = act.payload as any;
          get().createLink(
            p.sourceDeviceId,
            p.sourceInterfaceId,
            p.targetDeviceId,
            p.targetInterfaceId,
            p.mediaType,
            p.cableLengthMeters
          );
        } else if (act.type === 'SET_INTERFACE') {
          const p = act.payload as any;
          get().updateInterface(p.deviceId, p.interfaceId, p.updates);
        } else if (act.type === 'ADD_VLAN') {
          const p = act.payload as any;
          get().addVlan(p);
        }
      }

      // Append to CLI history
      set((s) => ({
        cliHistory: [
          ...s.cliHistory.slice(-50),
          {
            command: rawCommand,
            output: result.output,
            timestamp: result.timestamp,
            isError: !result.success,
          },
        ],
      }));

      return { success: result.success, output: result.output };
    },

    validateCurrentTopology: () => {
      const state = get();
      const diags = validateTopology(
        state.activeProject.devices,
        state.activeProject.links,
        state.activeProject.vlans,
        state.activeProject.circuits,
        state.activeProject.workloads,
        state.circuitTelemetry,
        state.deviceProcessingMetrics
      );
      set({ diagnostics: diags });
      return diags;
    },

    undo: () => {
      const { historyPast, historyFuture, activeProject } = get();
      if (historyPast.length === 0) return;
      const previous = historyPast[historyPast.length - 1];
      const newPast = historyPast.slice(0, -1);
      const newFuture = [JSON.parse(JSON.stringify(activeProject)), ...historyFuture];
      const diags = validateTopology(previous.devices, previous.links, previous.vlans);

      set({
        activeProject: previous,
        historyPast: newPast,
        historyFuture: newFuture,
        diagnostics: diags,
      });
      get().saveProjectToServer();
    },

    redo: () => {
      const { historyPast, historyFuture, activeProject } = get();
      if (historyFuture.length === 0) return;
      const next = historyFuture[0];
      const newFuture = historyFuture.slice(1);
      const newPast = [...historyPast, JSON.parse(JSON.stringify(activeProject))];
      const diags = validateTopology(next.devices, next.links, next.vlans);

      set({
        activeProject: next,
        historyPast: newPast,
        historyFuture: newFuture,
        diagnostics: diags,
      });
      get().saveProjectToServer();
    },
  };
});
