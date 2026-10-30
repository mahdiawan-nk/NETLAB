import fs from 'fs';
import path from 'path';
import {
  NetworkProject,
  NetworkDevice,
  NetworkLink,
  NetworkVlan,
  AuditLogEntry,
} from '../types/network';
import { createDefaultCampusProject } from '../data/defaultCampusProject';
import { DEFAULT_ISP_PROVIDERS, DEFAULT_INTERNET_CIRCUITS } from '../data/defaultIspData';
import { DEFAULT_WORKLOAD_PROFILES } from '../data/defaultWorkloadProfiles';


const DATA_DIR = path.resolve(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const AUDIT_LOGS_FILE = path.join(DATA_DIR, 'audit_logs.json');
const CUSTOM_DEVICES_FILE = path.join(DATA_DIR, 'custom_devices.json');

// Helper for atomic file write
function atomicWriteJson<T>(filePath: string, data: T): void {
  const tempPath = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      atomicWriteJson(filePath, fallback);
      return fallback;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return fallback;
  }
}

export class JsonStorageRepository {
  public getProjects(): NetworkProject[] {
    const list = readJsonFile<NetworkProject[]>(PROJECTS_FILE, []);
    if (list.length === 0) {
      const defaultProject = createDefaultCampusProject();
      list.push(defaultProject);
      atomicWriteJson(PROJECTS_FILE, list);
    } else {
      let needsSave = false;
      for (const p of list) {
        if (!p.ispProviders || p.ispProviders.length === 0) {
          p.ispProviders = DEFAULT_ISP_PROVIDERS;
          needsSave = true;
        }
        if (!p.circuits || p.circuits.length === 0) {
          p.circuits = DEFAULT_INTERNET_CIRCUITS;
          needsSave = true;
        }
        if (!p.workloadProfiles || p.workloadProfiles.length === 0) {
          p.workloadProfiles = DEFAULT_WORKLOAD_PROFILES;
          needsSave = true;
        }
        if (!p.workloads) {
          p.workloads = [];
          needsSave = true;
        }
        if (!p.cpeAssignments) {
          p.cpeAssignments = [];
          needsSave = true;
        }
      }
      if (needsSave) {
        atomicWriteJson(PROJECTS_FILE, list);
      }
    }
    return list;
  }

  public getProject(id: string): NetworkProject | null {
    const list = this.getProjects();
    return list.find((p) => p.id === id) || null;
  }

  public saveProject(project: NetworkProject): NetworkProject {
    const list = this.getProjects();
    const index = list.findIndex((p) => p.id === project.id);
    project.updatedAt = new Date().toISOString();

    if (index >= 0) {
      list[index] = project;
    } else {
      list.push(project);
    }

    atomicWriteJson(PROJECTS_FILE, list);
    return project;
  }

  public deleteProject(id: string): boolean {
    let list = this.getProjects();
    const initLen = list.length;
    list = list.filter((p) => p.id !== id);
    if (list.length < initLen) {
      atomicWriteJson(PROJECTS_FILE, list);
      return true;
    }
    return false;
  }

  // ==========================================
  // Custom Device Catalog Storage
  // ==========================================

  public getCustomDevices(): import('../types/network').UnifiedCatalogDevice[] {
    return readJsonFile<import('../types/network').UnifiedCatalogDevice[]>(CUSTOM_DEVICES_FILE, []);
  }

  public getCustomDevice(id: string): import('../types/network').UnifiedCatalogDevice | null {
    const list = this.getCustomDevices();
    return list.find((d) => d.id === id) || null;
  }

  public saveCustomDevice(device: import('../types/network').UnifiedCatalogDevice): import('../types/network').UnifiedCatalogDevice {
    const list = this.getCustomDevices();
    const index = list.findIndex((d) => d.id === device.id);
    const now = new Date().toISOString();

    if (index >= 0) {
      const existing = list[index];
      // Increment specification version if existing
      device.specificationVersion = (existing.specificationVersion || 1) + 1;
      device.updatedAt = now;
      device.createdAt = existing.createdAt || now;
      list[index] = device;
    } else {
      device.specificationVersion = device.specificationVersion || 1;
      device.createdAt = device.createdAt || now;
      device.updatedAt = now;
      list.push(device);
    }

    atomicWriteJson(CUSTOM_DEVICES_FILE, list);
    return device;
  }

  public deleteCustomDevice(id: string): boolean {
    let list = this.getCustomDevices();
    const initLen = list.length;
    list = list.filter((d) => d.id !== id);
    if (list.length < initLen) {
      atomicWriteJson(CUSTOM_DEVICES_FILE, list);
      return true;
    }
    return false;
  }

  public duplicateCustomDevice(id: string): import('../types/network').UnifiedCatalogDevice | null {
    const target = this.getCustomDevice(id);
    if (!target) return null;

    const copy = JSON.parse(JSON.stringify(target)) as import('../types/network').UnifiedCatalogDevice;
    const now = new Date().toISOString();
    copy.id = `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    copy.name = `${copy.name} (Copy)`;
    copy.modelNumber = `${copy.modelNumber}-COPY`;
    copy.specificationVersion = 1;
    copy.verificationStatus = 'UNVERIFIED';
    copy.createdAt = now;
    copy.updatedAt = now;

    return this.saveCustomDevice(copy);
  }

  public checkDeviceUsage(modelId: string): {
    inUse: boolean;
    totalDeviceCount: number;
    projects: { id: string; name: string; deviceCount: number }[];
  } {
    const projects = this.getProjects();
    const matchingProjects: { id: string; name: string; deviceCount: number }[] = [];
    let totalDeviceCount = 0;

    for (const proj of projects) {
      const occurrences = proj.devices.filter((d) => d.modelId === modelId);
      if (occurrences.length > 0) {
        matchingProjects.push({
          id: proj.id,
          name: proj.name,
          deviceCount: occurrences.length,
        });
        totalDeviceCount += occurrences.length;
      }
    }

    return {
      inUse: totalDeviceCount > 0,
      totalDeviceCount,
      projects: matchingProjects,
    };
  }

  // ==========================================
  // Audit Logs Storage
  // ==========================================

  public getAuditLogs(): AuditLogEntry[] {
    return readJsonFile<AuditLogEntry[]>(AUDIT_LOGS_FILE, []);
  }

  public addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const logs = this.getAuditLogs();
    const newLog: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    logs.unshift(newLog); // latest first
    // Keep max 500 logs
    const trimmed = logs.slice(0, 500);
    atomicWriteJson(AUDIT_LOGS_FILE, trimmed);
    return newLog;
  }
}

export const storage = new JsonStorageRepository();
