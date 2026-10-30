import React, { useEffect, useState } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { TopologyCanvas } from './TopologyCanvas';
import { DeviceInspector } from './DeviceInspector';
import { BottomPanel } from './BottomPanel';
import { ConnectionModal } from './ConnectionModal';
import { CustomDeviceWizardModal } from './CustomDeviceBuilder/CustomDeviceWizardModal';
import { DeviceUsageProtectionModal } from './CustomDeviceBuilder/DeviceUsageProtectionModal';
import { RouterConsoleModal } from './RouterConsole/RouterConsoleModal';
import { UserGuideModal } from './UserGuide/UserGuideModal';
import { WelcomeOnboardingModal } from './UserGuide/WelcomeOnboardingModal';

export const WorkspaceApp: React.FC = () => {
  const { init, isTrafficRunning, updateTrafficTick } = useNetworkStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!isTrafficRunning) return;
    const interval = setInterval(() => {
      updateTrafficTick();
    }, 2500);
    return () => clearInterval(interval);
  }, [isTrafficRunning, updateTrafficTick]);

  const handleToggleFullCanvas = () => {
    if (!isSidebarOpen && !isInspectorOpen) {
      setIsSidebarOpen(true);
      setIsInspectorOpen(true);
    } else {
      setIsSidebarOpen(false);
      setIsInspectorOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* 1. Header & Navigation Top Bar */}
      <TopBar />

      {/* 2. Central Workspace with Collapsible Sidebar, Interactive Canvas & Collapsible Inspector */}
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
        />
        <TopologyCanvas
          isSidebarOpen={isSidebarOpen}
          isInspectorOpen={isInspectorOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
          onToggleFullCanvas={handleToggleFullCanvas}
        />
        <DeviceInspector
          isOpen={isInspectorOpen}
          onToggle={() => setIsInspectorOpen((prev) => !prev)}
        />
      </div>

      {/* 3. NOC Console Bottom Panel (CLI, Diagnostics, VLANs, Audit) */}
      <BottomPanel />

      {/* 4. Connection Modal (Physical Link & Optics Negotiator) */}
      <ConnectionModal />

      {/* 5. Custom Device Builder Wizard & Protection Modals */}
      <CustomDeviceWizardModal />
      <DeviceUsageProtectionModal />

      {/* 6. MikroTik RouterOS Console & Winbox Manager */}
      <RouterConsoleModal />

      {/* 7. NETLAB User Guide & Application Help Center + First-Time Welcome Modal */}
      <UserGuideModal />
      <WelcomeOnboardingModal />
    </div>
  );
};
