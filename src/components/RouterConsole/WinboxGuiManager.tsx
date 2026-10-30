import React, { useState } from 'react';
import { NetworkDevice, NetworkProject } from '../../types/network';
import {
  RouterOsDeviceConfig,
} from '../../types/routerOs';
import { RouterOsConfigService, MutationResult } from '../../services/routerOsConfigService';
import { simulatePacketTrace } from '../../services/simulationEngine';
import { useNetworkStore } from '../../store/useNetworkStore';
import {
  Network,
  Layers,
  Globe,
  Route as RouteIcon,
  Server,
  Shield,
  Zap,
  Sliders,
  Terminal,
  Activity,
  Cpu,
  Plus,
  X,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Play,
  Info,
} from 'lucide-react';

interface WinboxGuiManagerProps {
  device: NetworkDevice;
  project: NetworkProject;
  mutateConfig: (
    actionName: string,
    mutationFn: (dev: NetworkDevice, cfg: RouterOsDeviceConfig) => MutationResult
  ) => MutationResult;
}

type WinboxMenu =
  | 'quick-set'
  | 'interfaces'
  | 'bridge'
  | 'vlan'
  | 'ip-addresses'
  | 'ip-routes'
  | 'ip-dhcp'
  | 'ip-dns'
  | 'ip-firewall'
  | 'ip-nat'
  | 'queues'
  | 'system'
  | 'tools'
  | 'logs';

export const WinboxGuiManager: React.FC<WinboxGuiManagerProps> = ({
  device,
  project,
  mutateConfig,
}) => {
  const { auditLogs } = useNetworkStore();
  const config = RouterOsConfigService.ensureConfig(device);
  const [activeMenu, setActiveMenu] = useState<WinboxMenu>('interfaces');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addSubType, setAddSubType] = useState<'default' | 'bridgePort' | 'ipPool' | 'dnsStatic'>('default');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ type: string; id: string; label?: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states for Add / Edit
  const [ipForm, setIpForm] = useState({ address: '', interface: device.interfaces[0]?.name || 'ether1', comment: '' });
  const [routeForm, setRouteForm] = useState({ dstAddress: '0.0.0.0/0', gateway: '', distance: 1, comment: '' });
  const [bridgeForm, setBridgeForm] = useState({ name: 'bridge1', vlanFiltering: true, comment: '' });
  const [bridgePortForm, setBridgePortForm] = useState({ bridge: config.bridges[0]?.name || 'bridge1', interface: device.interfaces[0]?.name || 'ether1', pvid: 1 });
  const [vlanForm, setVlanForm] = useState({ name: 'vlan10', vlanId: 10, interface: device.interfaces[0]?.name || 'ether1', comment: '' });
  const [dhcpForm, setDhcpForm] = useState({ name: 'dhcp1', interface: device.interfaces[0]?.name || 'ether1', addressPool: config.ipPools[0]?.name || 'dhcp-pool-lan', leaseTime: '10m' });
  const [poolForm, setPoolForm] = useState({ name: 'pool-vlan', ranges: '192.168.10.100-192.168.10.200' });
  const [dnsServersInput, setDnsServersInput] = useState(config.dns.servers.join(', '));
  const [dnsRemoteReq, setDnsRemoteReq] = useState(config.dns.allowRemoteRequests);
  const [dnsStaticForm, setDnsStaticForm] = useState({ name: 'host.lan', address: '192.168.88.10', ttl: '1d' });
  const [firewallForm, setFirewallForm] = useState({ chain: 'forward' as 'input' | 'forward' | 'output', action: 'drop' as 'accept' | 'drop' | 'reject', protocol: 'all', srcAddress: '', dstAddress: '', inInterface: '', outInterface: '', comment: '' });
  const [natForm, setNatForm] = useState({ chain: 'srcnat' as 'srcnat' | 'dstnat', action: 'masquerade' as 'masquerade' | 'src-nat' | 'dst-nat', outInterface: device.interfaces.find((i) => i.mode === 'wan')?.name || device.interfaces[0]?.name || 'ether1', toAddresses: '', comment: '' });
  const [queueForm, setQueueForm] = useState({ name: 'queue-lan', target: '192.168.88.0/24', maxLimitUpMbps: 10, maxLimitDownMbps: 20, priority: 8, comment: '' });
  const [ifaceEditForm, setIfaceEditForm] = useState({ mtu: 1500, comment: '' });
  const [identityInput, setIdentityInput] = useState(config.identity.name);

  // Tools state
  const [toolMode, setToolMode] = useState<'ping' | 'traceroute'>('ping');
  const [pingTarget, setPingTarget] = useState('8.8.8.8');
  const [pingLogs, setPingLogs] = useState<string[]>([]);
  const [isPinging, setIsPinging] = useState(false);

  // Available hardware + logical interfaces on this device
  const availableInterfaces = [
    ...device.interfaces.map((i) => ({ name: i.name, label: `${i.name} (${i.type} - ${i.speed})` })),
    ...config.bridges.map((b) => ({ name: b.name, label: `${b.name} (bridge)` })),
    ...config.vlans.map((v) => ({ name: v.name, label: `${v.name} (vlan ${v.vlanId})` })),
  ];

  // ==========================================
  // ACTION HANDLERS
  // ==========================================

  const handleToggleEnable = (type: string, id: string) => {
    if (type === 'ip') {
      const item = config.ipAddresses.find((a) => a.id === id);
      if (!item) return;
      mutateConfig('Toggle IP Address', (dev) =>
        RouterOsConfigService.setIpAddress(dev, id, { disabled: !item.disabled })
      );
    } else if (type === 'interface') {
      const item = config.interfaces.find((i) => i.id === id);
      if (!item) return;
      mutateConfig('Toggle Interface Admin State', (_, cfg) => {
        const updated = cfg.interfaces.map((i) => (i.id === id ? { ...i, disabled: !i.disabled } : i));
        return { success: true, config: { ...cfg, interfaces: updated } };
      });
    } else if (type === 'route') {
      const item = config.routes.find((r) => r.id === id);
      if (!item) return;
      mutateConfig('Toggle Route State', (_, cfg) => {
        const updated = cfg.routes.map((r) => (r.id === id ? { ...r, disabled: !r.disabled } : r));
        return { success: true, config: { ...cfg, routes: updated } };
      });
    } else if (type === 'bridge') {
      const item = config.bridges.find((b) => b.id === id);
      if (!item) return;
      mutateConfig('Toggle Bridge State', (_, cfg) => {
        const updated = cfg.bridges.map((b) => (b.id === id ? { ...b, disabled: !b.disabled } : b));
        return { success: true, config: { ...cfg, bridges: updated } };
      });
    } else if (type === 'vlan') {
      const item = config.vlans.find((v) => v.id === id);
      if (!item) return;
      mutateConfig('Toggle VLAN State', (_, cfg) => {
        const updated = cfg.vlans.map((v) => (v.id === id ? { ...v, disabled: !v.disabled } : v));
        return { success: true, config: { ...cfg, vlans: updated } };
      });
    } else if (type === 'dhcp') {
      const item = config.dhcpServers.find((d) => d.id === id);
      if (!item) return;
      mutateConfig('Toggle DHCP Server', (_, cfg) => {
        const updated = cfg.dhcpServers.map((d) => (d.id === id ? { ...d, disabled: !d.disabled } : d));
        return { success: true, config: { ...cfg, dhcpServers: updated } };
      });
    } else if (type === 'queue') {
      const item = config.queues.find((q) => q.id === id);
      if (!item) return;
      mutateConfig('Toggle Queue State', (_, cfg) => {
        const updated = cfg.queues.map((q) => (q.id === id ? { ...q, disabled: !q.disabled } : q));
        return { success: true, config: { ...cfg, queues: updated } };
      });
    } else if (type === 'filter') {
      const item = config.firewall.filterRules.find((f) => f.id === id);
      if (!item) return;
      mutateConfig('Toggle Filter Rule', (_, cfg) => {
        const updated = cfg.firewall.filterRules.map((f) => (f.id === id ? { ...f, disabled: !f.disabled } : f));
        return { success: true, config: { ...cfg, firewall: { ...cfg.firewall, filterRules: updated } } };
      });
    } else if (type === 'nat') {
      const item = config.firewall.natRules.find((n) => n.id === id);
      if (!item) return;
      mutateConfig('Toggle NAT Rule', (_, cfg) => {
        const updated = cfg.firewall.natRules.map((n) => (n.id === id ? { ...n, disabled: !n.disabled } : n));
        return { success: true, config: { ...cfg, firewall: { ...cfg.firewall, natRules: updated } } };
      });
    }
  };

  const confirmAndDeleteItem = () => {
    if (!pendingDelete) return;
    const { type, id } = pendingDelete;
    if (type === 'ip') {
      mutateConfig('Remove IP Address', (dev) => RouterOsConfigService.removeIpAddress(dev, id));
    } else if (type === 'route') {
      mutateConfig('Remove Route', (dev) => RouterOsConfigService.removeRoute(dev, id));
    } else if (type === 'bridge') {
      mutateConfig('Remove Bridge', (dev) => RouterOsConfigService.removeBridge(dev, id));
    } else if (type === 'bridgePort') {
      mutateConfig('Remove Bridge Port', (dev) => RouterOsConfigService.removeBridgePort(dev, id));
    } else if (type === 'vlan') {
      mutateConfig('Remove VLAN Interface', (dev) => RouterOsConfigService.removeVlan(dev, id));
    } else if (type === 'dhcp') {
      mutateConfig('Remove DHCP Server', (dev) => RouterOsConfigService.removeDhcpServer(dev, id));
    } else if (type === 'ipPool') {
      mutateConfig('Remove IP Pool', (dev) => RouterOsConfigService.removeIpPool(dev, id));
    } else if (type === 'dnsStatic') {
      mutateConfig('Remove Static DNS', (dev) => RouterOsConfigService.removeDnsStatic(dev, id));
    } else if (type === 'filter') {
      mutateConfig('Remove Firewall Filter', (dev) => RouterOsConfigService.removeFirewallRule(dev, id));
    } else if (type === 'nat') {
      mutateConfig('Remove NAT Rule', (dev) => RouterOsConfigService.removeNatRule(dev, id));
    } else if (type === 'queue') {
      mutateConfig('Remove Simple Queue', (dev) => RouterOsConfigService.removeSimpleQueue(dev, id));
    }
    setPendingDelete(null);
    setSelectedRowId(null);
  };

  // Open Edit Modal pre-populated with selected item
  const handleOpenEditModal = () => {
    if (!selectedRowId) return;
    setFormError(null);

    if (activeMenu === 'interfaces') {
      const item = config.interfaces.find((i) => i.id === selectedRowId);
      if (!item) return;
      setIfaceEditForm({ mtu: item.mtu || 1500, comment: item.comment || '' });
      setIsEditModalOpen(true);
    } else if (activeMenu === 'ip-addresses') {
      const item = config.ipAddresses.find((a) => a.id === selectedRowId);
      if (!item) return;
      setIpForm({ address: item.address, interface: item.interface, comment: item.comment || '' });
      setIsEditModalOpen(true);
    } else if (activeMenu === 'ip-routes') {
      const item = config.routes.find((r) => r.id === selectedRowId);
      if (!item) return;
      setRouteForm({ dstAddress: item.dstAddress, gateway: item.gateway, distance: item.distance, comment: item.comment || '' });
      setIsEditModalOpen(true);
    } else if (activeMenu === 'queues') {
      const item = config.queues.find((q) => q.id === selectedRowId);
      if (!item) return;
      setQueueForm({
        name: item.name,
        target: item.target,
        maxLimitUpMbps: Math.round(item.maxLimitUploadBps / 1_000_000),
        maxLimitDownMbps: Math.round(item.maxLimitDownloadBps / 1_000_000),
        priority: item.priority || 8,
        comment: item.comment || '',
      });
      setIsEditModalOpen(true);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRowId) return;
    setFormError(null);

    if (activeMenu === 'interfaces') {
      mutateConfig('Edit Interface (Winbox)', (_, cfg) => {
        const updated = cfg.interfaces.map((i) =>
          i.id === selectedRowId ? { ...i, mtu: Number(ifaceEditForm.mtu) || 1500, actualMtu: Number(ifaceEditForm.mtu) || 1500, comment: ifaceEditForm.comment } : i
        );
        return { success: true, config: { ...cfg, interfaces: updated } };
      });
    } else if (activeMenu === 'ip-addresses') {
      const res = mutateConfig('Edit IP Address (Winbox)', (dev) =>
        RouterOsConfigService.setIpAddress(dev, selectedRowId, {
          address: ipForm.address.trim(),
          interface: ipForm.interface,
          comment: ipForm.comment.trim() || undefined,
        })
      );
      if (!res.success) {
        setFormError(res.error || 'Failed to update IP address');
        return;
      }
    } else if (activeMenu === 'ip-routes') {
      mutateConfig('Edit Route (Winbox)', (_, cfg) => {
        const updated = cfg.routes.map((r) =>
          r.id === selectedRowId
            ? { ...r, dstAddress: routeForm.dstAddress.trim(), gateway: routeForm.gateway.trim(), distance: Number(routeForm.distance) || 1, comment: routeForm.comment.trim() || undefined }
            : r
        );
        return { success: true, config: { ...cfg, routes: updated } };
      });
    } else if (activeMenu === 'queues') {
      mutateConfig('Edit Simple Queue (Winbox)', (_, cfg) => {
        const updated = cfg.queues.map((q) =>
          q.id === selectedRowId
            ? {
                ...q,
                name: queueForm.name.trim(),
                target: queueForm.target.trim(),
                maxLimitUploadBps: queueForm.maxLimitUpMbps * 1_000_000,
                maxLimitDownloadBps: queueForm.maxLimitDownMbps * 1_000_000,
                priority: Number(queueForm.priority) || 8,
                comment: queueForm.comment.trim() || undefined,
              }
            : q
        );
        return { success: true, config: { ...cfg, queues: updated } };
      });
    }

    setIsEditModalOpen(false);
  };

  // Submit Add modal form
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (activeMenu === 'ip-addresses') {
      const res = mutateConfig('Add IP Address (Winbox)', (dev) =>
        RouterOsConfigService.addIpAddress(dev, {
          address: ipForm.address.trim(),
          interface: ipForm.interface,
          comment: ipForm.comment.trim() || undefined,
        })
      );
      if (!res.success) {
        setFormError(res.error || 'Failed to add IP address');
        return;
      }
      setIpForm({ address: '', interface: device.interfaces[0]?.name || 'ether1', comment: '' });
    } else if (activeMenu === 'ip-routes') {
      const res = mutateConfig('Add Route (Winbox)', (dev) =>
        RouterOsConfigService.addRoute(dev, {
          dstAddress: routeForm.dstAddress.trim(),
          gateway: routeForm.gateway.trim(),
          distance: Number(routeForm.distance) || 1,
          comment: routeForm.comment.trim() || undefined,
        })
      );
      if (!res.success) {
        setFormError(res.error || 'Failed to add route');
        return;
      }
      setRouteForm({ dstAddress: '0.0.0.0/0', gateway: '', distance: 1, comment: '' });
    } else if (activeMenu === 'bridge') {
      if (addSubType === 'bridgePort') {
        const res = mutateConfig('Add Bridge Port (Winbox)', (dev) =>
          RouterOsConfigService.addBridgePort(dev, {
            bridge: bridgePortForm.bridge,
            interface: bridgePortForm.interface,
            pvid: Number(bridgePortForm.pvid) || 1,
          })
        );
        if (!res.success) {
          setFormError(res.error || 'Failed to add bridge port');
          return;
        }
      } else {
        const res = mutateConfig('Add Bridge (Winbox)', (dev) =>
          RouterOsConfigService.addBridge(dev, {
            name: bridgeForm.name.trim(),
            vlanFiltering: bridgeForm.vlanFiltering,
            comment: bridgeForm.comment.trim() || undefined,
          })
        );
        if (!res.success) {
          setFormError(res.error || 'Failed to add bridge');
          return;
        }
      }
    } else if (activeMenu === 'vlan') {
      const res = mutateConfig('Add VLAN (Winbox)', (dev) =>
        RouterOsConfigService.addVlan(dev, {
          name: vlanForm.name.trim(),
          vlanId: Number(vlanForm.vlanId),
          interface: vlanForm.interface,
          comment: vlanForm.comment.trim() || undefined,
        })
      );
      if (!res.success) {
        setFormError(res.error || 'Failed to add VLAN interface');
        return;
      }
    } else if (activeMenu === 'ip-dhcp') {
      if (addSubType === 'ipPool') {
        const res = mutateConfig('Add IP Pool (Winbox)', (dev) =>
          RouterOsConfigService.addIpPool(dev, {
            name: poolForm.name.trim(),
            ranges: poolForm.ranges.trim(),
          })
        );
        if (!res.success) {
          setFormError(res.error || 'Failed to add IP pool');
          return;
        }
      } else {
        const res = mutateConfig('Add DHCP Server (Winbox)', (dev) =>
          RouterOsConfigService.addDhcpServer(dev, {
            name: dhcpForm.name.trim(),
            interface: dhcpForm.interface,
            addressPool: dhcpForm.addressPool,
            leaseTime: dhcpForm.leaseTime,
          })
        );
        if (!res.success) {
          setFormError(res.error || 'Failed to add DHCP server');
          return;
        }
      }
    } else if (activeMenu === 'ip-dns') {
      const res = mutateConfig('Add Static DNS (Winbox)', (dev) =>
        RouterOsConfigService.addDnsStatic(dev, {
          name: dnsStaticForm.name.trim(),
          address: dnsStaticForm.address.trim(),
          ttl: dnsStaticForm.ttl,
        })
      );
      if (!res.success) {
        setFormError(res.error || 'Failed to add DNS static entry');
        return;
      }
    } else if (activeMenu === 'ip-firewall') {
      const res = mutateConfig('Add Firewall Filter (Winbox)', (dev) =>
        RouterOsConfigService.addFirewallRule(dev, {
          chain: firewallForm.chain,
          action: firewallForm.action,
          protocol: firewallForm.protocol === 'all' ? undefined : (firewallForm.protocol as any),
          srcAddress: firewallForm.srcAddress.trim() || undefined,
          dstAddress: firewallForm.dstAddress.trim() || undefined,
          inInterface: firewallForm.inInterface || undefined,
          outInterface: firewallForm.outInterface || undefined,
          disabled: false,
          comment: firewallForm.comment.trim() || undefined,
        })
      );
      if (!res.success) {
        setFormError(res.error || 'Failed to add filter rule');
        return;
      }
    } else if (activeMenu === 'ip-nat') {
      const res = mutateConfig('Add NAT Rule (Winbox)', (dev) =>
        RouterOsConfigService.addNatRule(dev, {
          chain: natForm.chain,
          action: natForm.action,
          outInterface: natForm.outInterface || undefined,
          toAddresses: natForm.toAddresses.trim() || undefined,
          disabled: false,
          comment: natForm.comment.trim() || undefined,
        })
      );
      if (!res.success) {
        setFormError(res.error || 'Failed to add NAT rule');
        return;
      }
    } else if (activeMenu === 'queues') {
      const res = mutateConfig('Add Simple Queue (Winbox)', (dev) =>
        RouterOsConfigService.addSimpleQueue(dev, {
          name: queueForm.name.trim(),
          target: queueForm.target.trim(),
          maxLimitUploadBps: queueForm.maxLimitUpMbps * 1_000_000,
          maxLimitDownloadBps: queueForm.maxLimitDownMbps * 1_000_000,
          comment: queueForm.comment.trim() || undefined,
        })
      );
      if (!res.success) {
        setFormError(res.error || 'Failed to add simple queue');
        return;
      }
    }

    setIsAddModalOpen(false);
  };

  // Run diagnostic Ping / Traceroute using NETLAB simulation engine
  const handleRunDiagnosticTool = () => {
    setIsPinging(true);
    const trace = simulatePacketTrace(device.id, pingTarget.trim(), 'ICMP', project);
    if (toolMode === 'ping') {
      const lines: string[] = [`PING ${pingTarget} (${pingTarget}) 56(84) bytes of data from ${device.name}:`];
      if (trace.success) {
        const baseLat = trace.totalLatencyMs || 1.4;
        for (let i = 1; i <= 4; i++) {
          const jitter = (Math.sin(i * 7) * 0.25).toFixed(2);
          const rtt = Math.max(0.2, baseLat + Number(jitter)).toFixed(2);
          lines.push(`64 bytes from ${pingTarget}: icmp_seq=${i} ttl=${64 - trace.hops.length} time=${rtt} ms`);
        }
        lines.push(`--- ${pingTarget} ping statistics ---`);
        lines.push(`4 packets transmitted, 4 received, 0% packet loss, avg rtt ${baseLat.toFixed(2)}ms`);
      } else {
        lines.push(`From ${device.name}: Destination Host Unreachable (${trace.summary})`);
        lines.push(`--- ${pingTarget} ping statistics ---`);
        lines.push(`4 packets transmitted, 0 received, 100% packet loss`);
      }
      setPingLogs(lines);
    } else {
      const lines: string[] = [`traceroute to ${pingTarget}, 30 hops max, 60 byte packets:`];
      trace.hops.forEach((hop, idx) => {
        lines.push(` ${idx + 1}  ${hop.deviceName} [${hop.action}]  ${hop.latencyMs.toFixed(2)} ms  (${hop.status}) - ${hop.details}`);
      });
      setPingLogs(lines);
    }
    setIsPinging(false);
  };

  return (
    <div className="flex h-full bg-slate-950 text-slate-200 font-sans select-none overflow-hidden">
      {/* 1. Left Winbox Sidebar */}
      <div className="w-48 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 text-xs">
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/60 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div className="truncate">
            <span className="font-bold text-white block text-[11px] truncate">{config.identity.name}</span>
            <span className="text-[9.5px] text-slate-400 font-mono block truncate">
              Winbox • ROS {device.routerOsVersion}
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {[
            { id: 'quick-set', label: 'Quick Set', icon: Zap },
            { id: 'interfaces', label: `Interfaces (${config.interfaces.length})`, icon: Network },
            { id: 'bridge', label: `Bridge (${config.bridges.length})`, icon: Layers },
            { id: 'vlan', label: `VLAN (${config.vlans.length})`, icon: Layers },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveMenu(item.id as WinboxMenu);
                  setSelectedRowId(null);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11.5px] font-medium transition-colors ${
                  activeMenu === item.id
                    ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="pt-2 pb-1 px-2.5 text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">
            IP & Security
          </div>

          {[
            { id: 'ip-addresses', label: `IP Addresses (${config.ipAddresses.length})`, icon: Globe },
            { id: 'ip-routes', label: `Routes (${config.routes.length})`, icon: RouteIcon },
            { id: 'ip-dhcp', label: `DHCP Server (${config.dhcpServers.length})`, icon: Server },
            { id: 'ip-dns', label: 'DNS', icon: Globe },
            { id: 'ip-firewall', label: `Firewall (${config.firewall.filterRules.length})`, icon: Shield },
            { id: 'ip-nat', label: `NAT (${config.firewall.natRules.length})`, icon: Shield },
            { id: 'queues', label: `Queues (${config.queues.length})`, icon: Sliders },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveMenu(item.id as WinboxMenu);
                  setSelectedRowId(null);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11.5px] font-medium transition-colors ${
                  activeMenu === item.id
                    ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="pt-2 pb-1 px-2.5 text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">
            System & Diagnostics
          </div>

          {[
            { id: 'system', label: 'System', icon: Cpu },
            { id: 'tools', label: 'Tools (Ping/Trace)', icon: Activity },
            { id: 'logs', label: 'Logs', icon: Terminal },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveMenu(item.id as WinboxMenu);
                  setSelectedRowId(null);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11.5px] font-medium transition-colors ${
                  activeMenu === item.id
                    ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 2. Workspace Content View */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/70">
        {/* Top Winbox Window Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white uppercase text-[11px] tracking-wider font-mono">
              {activeMenu.replace('-', ' ')}
            </span>

            {/* Standard CRUD Toolbar Buttons */}
            {['ip-addresses', 'ip-routes', 'bridge', 'vlan', 'ip-dhcp', 'ip-dns', 'ip-firewall', 'ip-nat', 'queues'].includes(activeMenu) && (
              <div className="flex items-center gap-1.5 ml-3 border-l border-slate-700/80 pl-3">
                <button
                  onClick={() => {
                    setFormError(null);
                    setAddSubType('default');
                    setIsAddModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {activeMenu === 'bridge'
                      ? 'Add Bridge'
                      : activeMenu === 'ip-dhcp'
                      ? 'Add DHCP Server'
                      : activeMenu === 'ip-dns'
                      ? 'Add Static DNS'
                      : 'Add'}
                  </span>
                </button>

                {activeMenu === 'bridge' && (
                  <button
                    onClick={() => {
                      setFormError(null);
                      setAddSubType('bridgePort');
                      setIsAddModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Bridge Port</span>
                  </button>
                )}

                {activeMenu === 'ip-dhcp' && (
                  <button
                    onClick={() => {
                      setFormError(null);
                      setAddSubType('ipPool');
                      setIsAddModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add IP Pool</span>
                  </button>
                )}
              </div>
            )}

            {selectedRowId && ['interfaces', 'ip-addresses', 'ip-routes', 'queues'].includes(activeMenu) && (
              <button
                onClick={handleOpenEditModal}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit Selected</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Simulation Behavior Classification Badge */}
            {['interfaces', 'bridge', 'vlan', 'ip-addresses', 'ip-routes', 'ip-dns', 'ip-firewall', 'ip-nat', 'queues', 'tools'].includes(activeMenu) ? (
              <span
                title="Active in simulatePacketTrace, trafficEngine, and validationEngine"
                className="px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-700/60 text-emerald-300 font-mono text-[10px] font-bold"
              >
                ENGINE: SIMULATED
              </span>
            ) : activeMenu === 'ip-dhcp' ? (
              <span
                title="Validated against IP pools and interface subnets in validationEngine"
                className="px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-700/60 text-cyan-300 font-mono text-[10px] font-bold"
              >
                ENGINE: VALIDATED
              </span>
            ) : (
              <span
                title="Stored in Unified Configuration State, Audit Log, and .rsc Export"
                className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px] font-bold"
              >
                ENGINE: CONFIGURED
              </span>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter rows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded pl-7 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Window Body Grid / Data Table */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* VIEW 1: QUICK SET */}
          {activeMenu === 'quick-set' && (
            <div className="max-w-3xl space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Quick Set — CPE / Enterprise Router Summary
                </h4>
                <p className="text-xs text-slate-400">
                  Simulated RouterOS Quick Set panel. Changes made here update the unified RouterOS configuration state and synchronize with the CLI terminal.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-mono text-xs">
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">System Identity (Hostname)</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={identityInput}
                        onChange={(e) => setIdentityInput(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:border-cyan-500"
                      />
                      <button
                        onClick={() => mutateConfig('Update System Identity', (dev) => RouterOsConfigService.setIdentity(dev, identityInput))}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-sans text-xs font-semibold"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Active Default Gateway</label>
                    <input
                      type="text"
                      disabled
                      value={device.defaultGateway || 'None (Configure in Routes)'}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-400"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">HARDWARE PORTS</span>
                  <span className="text-lg font-bold text-cyan-400">{device.interfaces.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">IPv4 ADDRESSES</span>
                  <span className="text-lg font-bold text-emerald-400">{config.ipAddresses.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">STATIC ROUTES</span>
                  <span className="text-lg font-bold text-amber-400">{config.routes.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">FIREWALL & NAT</span>
                  <span className="text-lg font-bold text-purple-400">
                    {config.firewall.filterRules.length + config.firewall.natRules.length}
                  </span>
                </div>
              </div>

              {/* RouterOS Simulation Engine Integration Matrix (Feature 5) */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    NETLAB Simulation Engine Integration Matrix
                  </h5>
                  <span className="text-[10px] font-mono text-slate-400">
                    Distinguishes Simulated, Validated, Configured & Unsupported Behaviors
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-300 font-mono text-[11px]">SIMULATED</span>
                      <span className="text-[10px] text-emerald-400/80 font-mono">Active in Packet & Traffic Engine</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      <strong>IP Addresses</strong>, <strong>Bridge & PVID</strong>, <strong>802.1Q VLAN</strong>,{' '}
                      <strong>Static Routing (LPM)</strong>, <strong>DNS Resolver & Static</strong>,{' '}
                      <strong>NAT (masquerade/src-nat)</strong>, <strong>Firewall Filter (input/forward)</strong>,{' '}
                      <strong>Simple Queues (QoS shaping & CPU load)</strong>.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-800/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300 font-mono text-[11px]">VALIDATED</span>
                      <span className="text-[10px] text-cyan-400/80 font-mono">Active in Topology Diagnostics</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      <strong>DHCP Server & IP Pools</strong> (validates pool existence & interface subnet assignment),{' '}
                      <strong>Hardware Interface Guard</strong> (enforces physical port count per device model).
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 font-mono text-[11px]">CONFIGURED</span>
                      <span className="text-[10px] text-slate-400 font-mono">Persisted & Exported (.rsc)</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      <strong>System Identity</strong>, <strong>Backup Snapshots</strong>,{' '}
                      <strong>Rule Comments</strong>, <strong>DHCP Networks Options</strong>.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-rose-950/25 border border-rose-800/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-300 font-mono text-[11px]">UNSUPPORTED</span>
                      <span className="text-[10px] text-rose-400/80 font-mono">Rejected by CLI Parser</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      <strong>BGP / OSPF Dynamic Routing</strong>, <strong>MPLS / VPLS</strong>,{' '}
                      <strong>IPsec / WireGuard Crypto Tunnels</strong>, <strong>Hotspot Captive Portal</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: INTERFACES */}
          {activeMenu === 'interfaces' && (
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
              <table className="w-full text-left">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="p-2.5">Flags</th>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">MTU</th>
                    <th className="p-2.5">MAC Address</th>
                    <th className="p-2.5">Comment</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {config.interfaces
                    .filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((iface) => (
                      <tr
                        key={iface.id}
                        onClick={() => setSelectedRowId(iface.id)}
                        className={`hover:bg-slate-800/50 cursor-pointer ${
                          selectedRowId === iface.id ? 'bg-cyan-950/40 text-cyan-200' : ''
                        } ${iface.disabled ? 'opacity-50' : ''}`}
                      >
                        <td className="p-2.5 font-bold">
                          {iface.disabled ? (
                            <span className="text-rose-400">X (Disabled)</span>
                          ) : iface.running ? (
                            <span className="text-emerald-400">R (Running)</span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="p-2.5 font-bold text-white">{iface.name}</td>
                        <td className="p-2.5 text-cyan-300 uppercase">{iface.type}</td>
                        <td className="p-2.5">{iface.actualMtu}</td>
                        <td className="p-2.5 text-slate-400">{iface.macAddress}</td>
                        <td className="p-2.5 text-slate-400 italic">{iface.comment || '-'}</td>
                        <td className="p-2.5 text-right font-sans space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRowId(iface.id);
                              setIfaceEditForm({ mtu: iface.mtu || 1500, comment: iface.comment || '' });
                              setIsEditModalOpen(true);
                            }}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-cyan-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleEnable('interface', iface.id);
                            }}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            {iface.disabled ? 'Enable' : 'Disable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 3: IP ADDRESSES */}
          {activeMenu === 'ip-addresses' && (
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
              <table className="w-full text-left">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="p-2.5">Flags</th>
                    <th className="p-2.5">Address</th>
                    <th className="p-2.5">Network</th>
                    <th className="p-2.5">Interface</th>
                    <th className="p-2.5">Comment</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {config.ipAddresses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500 italic">
                        No IP addresses configured. Click "+ Add" above to assign an IP to an interface.
                      </td>
                    </tr>
                  ) : (
                    config.ipAddresses
                      .filter((a) => a.address.includes(searchQuery) || a.interface.includes(searchQuery))
                      .map((ip) => (
                        <tr
                          key={ip.id}
                          onClick={() => setSelectedRowId(ip.id)}
                          className={`hover:bg-slate-800/50 cursor-pointer ${
                            selectedRowId === ip.id ? 'bg-cyan-950/40 text-cyan-200' : ''
                          } ${ip.disabled ? 'opacity-50' : ''}`}
                        >
                          <td className="p-2.5 font-bold">
                            {ip.disabled ? <span className="text-rose-400">X</span> : <span className="text-emerald-400">✓</span>}
                          </td>
                          <td className="p-2.5 font-bold text-white">{ip.address}</td>
                          <td className="p-2.5 text-slate-300">{ip.network}</td>
                          <td className="p-2.5 text-cyan-300">{ip.interface}</td>
                          <td className="p-2.5 text-slate-400 italic">{ip.comment || '-'}</td>
                          <td className="p-2.5 text-right font-sans space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRowId(ip.id);
                                setIpForm({ address: ip.address, interface: ip.interface, comment: ip.comment || '' });
                                setIsEditModalOpen(true);
                              }}
                              className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-cyan-300"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleEnable('ip', ip.id);
                              }}
                              className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              {ip.disabled ? 'Enable' : 'Disable'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete({ type: 'ip', id: ip.id, label: `${ip.address} on ${ip.interface}` });
                              }}
                              className="px-2 py-0.5 rounded text-[10px] bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/50"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 4: IP ROUTES */}
          {activeMenu === 'ip-routes' && (
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
              <table className="w-full text-left">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="p-2.5">Flags</th>
                    <th className="p-2.5">Dst. Address</th>
                    <th className="p-2.5">Gateway</th>
                    <th className="p-2.5">Distance</th>
                    <th className="p-2.5">Comment</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {config.routes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500 italic">
                        No static routes configured. Click "+ Add" above to add a default gateway route (0.0.0.0/0).
                      </td>
                    </tr>
                  ) : (
                    config.routes
                      .filter((r) => r.dstAddress.includes(searchQuery) || r.gateway.includes(searchQuery))
                      .map((route) => (
                        <tr
                          key={route.id}
                          onClick={() => setSelectedRowId(route.id)}
                          className={`hover:bg-slate-800/50 cursor-pointer ${
                            selectedRowId === route.id ? 'bg-cyan-950/40 text-cyan-200' : ''
                          } ${route.disabled ? 'opacity-50' : ''}`}
                        >
                          <td className="p-2.5 font-bold">
                            {route.disabled ? (
                              <span className="text-rose-400">X</span>
                            ) : (
                              <span className="text-emerald-400">AS</span>
                            )}
                          </td>
                          <td className="p-2.5 font-bold text-white">{route.dstAddress}</td>
                          <td className="p-2.5 text-cyan-300">{route.gateway}</td>
                          <td className="p-2.5">{route.distance}</td>
                          <td className="p-2.5 text-slate-400 italic">{route.comment || '-'}</td>
                          <td className="p-2.5 text-right font-sans space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRowId(route.id);
                                setRouteForm({ dstAddress: route.dstAddress, gateway: route.gateway, distance: route.distance, comment: route.comment || '' });
                                setIsEditModalOpen(true);
                              }}
                              className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-cyan-300"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleEnable('route', route.id);
                              }}
                              className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              {route.disabled ? 'Enable' : 'Disable'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete({ type: 'route', id: route.id, label: `Route ${route.dstAddress} via ${route.gateway}` });
                              }}
                              className="px-2 py-0.5 rounded text-[10px] bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/50"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 5: BRIDGE & BRIDGE PORTS */}
          {activeMenu === 'bridge' && (
            <div className="space-y-4">
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
                <div className="p-2.5 bg-slate-950 border-b border-slate-800 font-bold text-white flex items-center justify-between">
                  <span>Bridges ({config.bridges.length})</span>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="p-2.5">Flags</th>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">VLAN Filtering</th>
                      <th className="p-2.5">MTU</th>
                      <th className="p-2.5">MAC Address</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {config.bridges.map((b) => (
                      <tr key={b.id} className={`hover:bg-slate-800/50 ${b.disabled ? 'opacity-50' : ''}`}>
                        <td className="p-2.5 font-bold">{b.disabled ? <span className="text-rose-400">X</span> : <span className="text-emerald-400">R</span>}</td>
                        <td className="p-2.5 font-bold text-cyan-300">{b.name}</td>
                        <td className="p-2.5">{b.vlanFiltering ? 'yes' : 'no'}</td>
                        <td className="p-2.5">{b.mtu}</td>
                        <td className="p-2.5 text-slate-400">{b.macAddress}</td>
                        <td className="p-2.5 text-right font-sans space-x-1">
                          <button
                            onClick={() => handleToggleEnable('bridge', b.id)}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300"
                          >
                            {b.disabled ? 'Enable' : 'Disable'}
                          </button>
                          <button
                            onClick={() => setPendingDelete({ type: 'bridge', id: b.id, label: `Bridge ${b.name}` })}
                            className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800/50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bridge Ports */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
                <div className="p-2.5 bg-slate-950 border-b border-slate-800 font-bold text-white flex items-center justify-between">
                  <span>Bridge Ports ({config.bridgePorts.length})</span>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="p-2.5">Interface</th>
                      <th className="p-2.5">Bridge</th>
                      <th className="p-2.5">PVID (802.1Q)</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {config.bridgePorts.map((bp) => (
                      <tr key={bp.id} className="hover:bg-slate-800/50">
                        <td className="p-2.5 font-bold text-white">{bp.interface}</td>
                        <td className="p-2.5 text-cyan-300">{bp.bridge}</td>
                        <td className="p-2.5 font-bold text-amber-300">{bp.pvid}</td>
                        <td className="p-2.5 text-right font-sans">
                          <button
                            onClick={() => setPendingDelete({ type: 'bridgePort', id: bp.id, label: `Bridge port ${bp.interface}` })}
                            className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800/50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 6: VLAN INTERFACES */}
          {activeMenu === 'vlan' && (
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
              <table className="w-full text-left">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="p-2.5">Flags</th>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">VLAN ID</th>
                    <th className="p-2.5">Parent Interface</th>
                    <th className="p-2.5">Comment</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {config.vlans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500 italic">
                        No 802.1Q VLAN interfaces configured. Click "+ Add" above to create a VLAN interface.
                      </td>
                    </tr>
                  ) : (
                    config.vlans.map((v) => (
                      <tr key={v.id} className={`hover:bg-slate-800/50 ${v.disabled ? 'opacity-50' : ''}`}>
                        <td className="p-2.5 font-bold">{v.disabled ? <span className="text-rose-400">X</span> : <span className="text-emerald-400">R</span>}</td>
                        <td className="p-2.5 font-bold text-white">{v.name}</td>
                        <td className="p-2.5 text-cyan-300 font-bold">{v.vlanId}</td>
                        <td className="p-2.5">{v.interface}</td>
                        <td className="p-2.5 text-slate-400 italic">{v.comment || '-'}</td>
                        <td className="p-2.5 text-right font-sans space-x-1">
                          <button
                            onClick={() => handleToggleEnable('vlan', v.id)}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300"
                          >
                            {v.disabled ? 'Enable' : 'Disable'}
                          </button>
                          <button
                            onClick={() => setPendingDelete({ type: 'vlan', id: v.id, label: `VLAN ${v.name} (ID ${v.vlanId})` })}
                            className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800/50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 7: DHCP SERVER & IP POOLS */}
          {activeMenu === 'ip-dhcp' && (
            <div className="space-y-4">
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
                <div className="p-2.5 bg-slate-950 border-b border-slate-800 font-bold text-white flex items-center justify-between">
                  <span>DHCP Servers ({config.dhcpServers.length})</span>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="p-2.5">Flags</th>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Interface</th>
                      <th className="p-2.5">Address Pool</th>
                      <th className="p-2.5">Lease Time</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {config.dhcpServers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-5 text-center text-slate-500 italic">
                          No DHCP Server instances configured. Click "+ Add DHCP Server" above.
                        </td>
                      </tr>
                    ) : (
                      config.dhcpServers.map((ds) => (
                        <tr key={ds.id} className={`hover:bg-slate-800/50 ${ds.disabled ? 'opacity-50' : ''}`}>
                          <td className="p-2.5 font-bold">{ds.disabled ? <span className="text-rose-400">X</span> : <span className="text-emerald-400">✓</span>}</td>
                          <td className="p-2.5 font-bold text-white">{ds.name}</td>
                          <td className="p-2.5 text-cyan-300">{ds.interface}</td>
                          <td className="p-2.5 text-amber-300">{ds.addressPool}</td>
                          <td className="p-2.5">{ds.leaseTime}</td>
                          <td className="p-2.5 text-right font-sans space-x-1">
                            <button
                              onClick={() => handleToggleEnable('dhcp', ds.id)}
                              className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300"
                            >
                              {ds.disabled ? 'Enable' : 'Disable'}
                            </button>
                            <button
                              onClick={() => setPendingDelete({ type: 'dhcp', id: ds.id, label: `DHCP Server ${ds.name}` })}
                              className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800/50"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
                <div className="p-2.5 bg-slate-950 border-b border-slate-800 font-bold text-white flex items-center justify-between">
                  <span>IP Address Pools ({config.ipPools.length})</span>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="p-2.5">Pool Name</th>
                      <th className="p-2.5">Address Ranges</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {config.ipPools.map((pool) => (
                      <tr key={pool.id} className="hover:bg-slate-800/50">
                        <td className="p-2.5 font-bold text-white">{pool.name}</td>
                        <td className="p-2.5 text-emerald-400">{pool.ranges}</td>
                        <td className="p-2.5 text-right font-sans">
                          <button
                            onClick={() => setPendingDelete({ type: 'ipPool', id: pool.id, label: `Pool ${pool.name}` })}
                            className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800/50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 8: IP DNS */}
          {activeMenu === 'ip-dns' && (
            <div className="space-y-4 max-w-3xl">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  DNS Resolver Settings (/ip dns)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Upstream DNS Servers (comma separated)</label>
                    <input
                      type="text"
                      value={dnsServersInput}
                      onChange={(e) => setDnsServersInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-sans">
                      <input
                        type="checkbox"
                        checked={dnsRemoteReq}
                        onChange={(e) => setDnsRemoteReq(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-800 text-cyan-600"
                      />
                      <span>Allow Remote Requests (Act as DNS Cache)</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end pt-2 border-t border-slate-800">
                  <button
                    onClick={() => {
                      const servers = dnsServersInput.split(',').map((s) => s.trim()).filter(Boolean);
                      mutateConfig('Update DNS Settings (Winbox)', (dev) =>
                        RouterOsConfigService.setDns(dev, { servers, allowRemoteRequests: dnsRemoteReq })
                      );
                    }}
                    className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold"
                  >
                    Apply DNS Settings
                  </button>
                </div>
              </div>

              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
                <div className="p-2.5 bg-slate-950 border-b border-slate-800 font-bold text-white">
                  Static DNS Entries ({config.dns.staticEntries.length})
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="p-2.5">Hostname (FQDN)</th>
                      <th className="p-2.5">IP Address</th>
                      <th className="p-2.5">TTL</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {config.dns.staticEntries.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-800/50">
                        <td className="p-2.5 font-bold text-white">{st.name}</td>
                        <td className="p-2.5 text-cyan-300">{st.address}</td>
                        <td className="p-2.5 text-slate-400">{st.ttl || '1d'}</td>
                        <td className="p-2.5 text-right font-sans">
                          <button
                            onClick={() => setPendingDelete({ type: 'dnsStatic', id: st.id, label: `DNS ${st.name}` })}
                            className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800/50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 9: FIREWALL FILTER */}
          {activeMenu === 'ip-firewall' && (
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
              <table className="w-full text-left">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="p-2.5">Flags</th>
                    <th className="p-2.5">Chain</th>
                    <th className="p-2.5">Action</th>
                    <th className="p-2.5">Protocol</th>
                    <th className="p-2.5">Src. Address</th>
                    <th className="p-2.5">Dst. Address</th>
                    <th className="p-2.5">Comment</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {config.firewall.filterRules.map((f) => (
                    <tr key={f.id} className={`hover:bg-slate-800/50 ${f.disabled ? 'opacity-50' : ''}`}>
                      <td className="p-2.5 font-bold">{f.disabled ? <span className="text-rose-400">X</span> : <span className="text-emerald-400">✓</span>}</td>
                      <td className="p-2.5 uppercase font-bold text-white">{f.chain}</td>
                      <td className="p-2.5">
                        <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[10px] ${
                          f.action === 'accept' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}>
                          {f.action}
                        </span>
                      </td>
                      <td className="p-2.5 text-cyan-300">{f.protocol || 'all'}</td>
                      <td className="p-2.5 text-slate-300">{f.srcAddress || '*'}</td>
                      <td className="p-2.5 text-slate-300">{f.dstAddress || '*'}</td>
                      <td className="p-2.5 text-slate-400 italic">{f.comment || '-'}</td>
                      <td className="p-2.5 text-right font-sans space-x-1">
                        <button
                          onClick={() => handleToggleEnable('filter', f.id)}
                          className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300"
                        >
                          {f.disabled ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          onClick={() => setPendingDelete({ type: 'filter', id: f.id, label: `Filter rule (${f.chain} ${f.action})` })}
                          className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800/50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 10: FIREWALL NAT */}
          {activeMenu === 'ip-nat' && (
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
              <table className="w-full text-left">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="p-2.5">Flags</th>
                    <th className="p-2.5">Chain</th>
                    <th className="p-2.5">Action</th>
                    <th className="p-2.5">Out. Interface</th>
                    <th className="p-2.5">To Addresses</th>
                    <th className="p-2.5">Comment</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {config.firewall.natRules.map((n) => (
                    <tr key={n.id} className={`hover:bg-slate-800/50 ${n.disabled ? 'opacity-50' : ''}`}>
                      <td className="p-2.5 font-bold">{n.disabled ? <span className="text-rose-400">X</span> : <span className="text-emerald-400">✓</span>}</td>
                      <td className="p-2.5 uppercase font-bold text-white">{n.chain}</td>
                      <td className="p-2.5">
                        <span className="px-1.5 py-0.2 rounded font-bold uppercase text-[10px] bg-amber-950 text-amber-300 border border-amber-800">
                          {n.action}
                        </span>
                      </td>
                      <td className="p-2.5 text-cyan-300">{n.outInterface || '*'}</td>
                      <td className="p-2.5 text-slate-300">{n.toAddresses || '*'}</td>
                      <td className="p-2.5 text-slate-400 italic">{n.comment || '-'}</td>
                      <td className="p-2.5 text-right font-sans space-x-1">
                        <button
                          onClick={() => handleToggleEnable('nat', n.id)}
                          className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300"
                        >
                          {n.disabled ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          onClick={() => setPendingDelete({ type: 'nat', id: n.id, label: `NAT rule (${n.chain} ${n.action})` })}
                          className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800/50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 11: SIMPLE QUEUES */}
          {activeMenu === 'queues' && (
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
              <table className="w-full text-left">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="p-2.5">Flags</th>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Target</th>
                    <th className="p-2.5">Max Limit (Up/Down)</th>
                    <th className="p-2.5">Priority</th>
                    <th className="p-2.5">Comment</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {config.queues.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                        No simple queues configured. Click "+ Add" above to define bandwidth shaping limits.
                      </td>
                    </tr>
                  ) : (
                    config.queues.map((q) => (
                      <tr
                        key={q.id}
                        onClick={() => setSelectedRowId(q.id)}
                        className={`hover:bg-slate-800/50 cursor-pointer ${
                          selectedRowId === q.id ? 'bg-cyan-950/40 text-cyan-200' : ''
                        } ${q.disabled ? 'opacity-50' : ''}`}
                      >
                        <td className="p-2.5 font-bold">{q.disabled ? <span className="text-rose-400">X</span> : <span className="text-emerald-400">✓</span>}</td>
                        <td className="p-2.5 font-bold text-white">{q.name}</td>
                        <td className="p-2.5 text-cyan-300">{q.target}</td>
                        <td className="p-2.5 font-bold text-emerald-400">
                          {(q.maxLimitUploadBps / 1_000_000).toFixed(0)}M / {(q.maxLimitDownloadBps / 1_000_000).toFixed(0)}M
                        </td>
                        <td className="p-2.5">{q.priority || 8}</td>
                        <td className="p-2.5 text-slate-400 italic">{q.comment || '-'}</td>
                        <td className="p-2.5 text-right font-sans space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRowId(q.id);
                              setQueueForm({
                                name: q.name,
                                target: q.target,
                                maxLimitUpMbps: Math.round(q.maxLimitUploadBps / 1_000_000),
                                maxLimitDownMbps: Math.round(q.maxLimitDownloadBps / 1_000_000),
                                priority: q.priority || 8,
                                comment: q.comment || '',
                              });
                              setIsEditModalOpen(true);
                            }}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-cyan-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleEnable('queue', q.id);
                            }}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300"
                          >
                            {q.disabled ? 'Enable' : 'Disable'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDelete({ type: 'queue', id: q.id, label: `Simple Queue ${q.name}` });
                            }}
                            className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800/50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 12: SYSTEM RESOURCES */}
          {activeMenu === 'system' && (
            <div className="max-w-xl space-y-4 font-mono text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-bold text-white font-sans flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  RouterOS Hardware Resource Metrics
                </h4>

                {(() => {
                  const res = RouterOsConfigService.getSystemResource(device);
                  return (
                    <div className="space-y-2.5">
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Board Model</span>
                        <span className="text-white font-bold">{res.boardName}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">RouterOS Version</span>
                        <span className="text-cyan-300">{res.version}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">CPU Architecture</span>
                        <span className="text-slate-200">{res.architecture} ({res.cpuCount} Cores @ {res.cpuFrequencyMhz} MHz)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Memory</span>
                        <span className="text-emerald-400">
                          {(res.freeMemoryBytes / (1024 * 1024)).toFixed(0)} MB Free / {(res.totalMemoryBytes / (1024 * 1024)).toFixed(0)} MB Total
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-500">Storage</span>
                        <span className="text-slate-200">
                          {(res.freeHddSpaceBytes / (1024 * 1024)).toFixed(0)} MB Free
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* VIEW 13: TOOLS (PING & TRACEROUTE) */}
          {activeMenu === 'tools' && (
            <div className="max-w-2xl space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Network Diagnostic Tools (Simulated Packet Trace)
                  </h4>
                  <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                    <button
                      onClick={() => setToolMode('ping')}
                      className={`px-2.5 py-1 rounded-md font-semibold ${toolMode === 'ping' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
                    >
                      Ping
                    </button>
                    <button
                      onClick={() => setToolMode('traceroute')}
                      className={`px-2.5 py-1 rounded-md font-semibold ${toolMode === 'traceroute' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
                    >
                      Traceroute
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pingTarget}
                    onChange={(e) => setPingTarget(e.target.value)}
                    placeholder="Enter target IP (e.g. 8.8.8.8 or 10.20.0.1)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <button
                    onClick={handleRunDiagnosticTool}
                    disabled={isPinging}
                    className="px-3.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{toolMode === 'ping' ? 'Run Ping' : 'Run Traceroute'}</span>
                  </button>
                </div>

                {pingLogs.length > 0 && (
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 font-mono text-xs space-y-1">
                    {pingLogs.map((log, idx) => (
                      <div key={idx} className="text-slate-300">
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 14: ROUTER LOGS */}
          {activeMenu === 'logs' && (
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
              <div className="p-2.5 bg-slate-950 border-b border-slate-800 font-bold text-white flex items-center justify-between">
                <span>Device Configuration & System Audit Log</span>
                <span className="text-[10px] text-slate-400">Real-time CLI & Winbox mutations</span>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="p-2.5">Time</th>
                    <th className="p-2.5">Topic / Action</th>
                    <th className="p-2.5">Message Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {auditLogs.filter((l) => l.entityId === device.id || l.details.includes(device.name)).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-500 italic">
                        No recent configuration logs for {device.name}. Add or modify items via CLI or Winbox to see audit logs.
                      </td>
                    </tr>
                  ) : (
                    auditLogs
                      .filter((l) => l.entityId === device.id || l.details.includes(device.name))
                      .map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/50">
                          <td className="p-2.5 text-slate-400 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="p-2.5 text-cyan-300 font-bold">{log.action}</td>
                          <td className="p-2.5 text-slate-200">{log.details}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* DETAIL INSPECTOR DRAWER FOR SELECTED ROW */}
          {selectedRowId && (
            <div className="p-3 rounded-xl bg-slate-900/95 border border-cyan-500/30 text-xs font-mono flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-slate-300">
                  Selected Item ID: <strong className="text-white">{selectedRowId}</strong> in{' '}
                  <span className="text-cyan-300 uppercase">{activeMenu}</span>
                </span>
              </div>
              <button
                onClick={() => setSelectedRowId(null)}
                className="text-slate-400 hover:text-white text-[11px] font-sans"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. INLINE DELETE CONFIRMATION MODAL */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirm Configuration Removal</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Are you sure you want to remove{' '}
              <strong className="text-white font-mono">{pendingDelete.label || pendingDelete.id}</strong> from{' '}
              <strong className="text-cyan-300">{device.name}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndDeleteItem}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
              >
                Remove Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. EDIT MODAL DIALOG */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Edit {activeMenu.replace('-', ' ')}
              </h4>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2 rounded bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              {activeMenu === 'interfaces' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">MTU (Bytes)</label>
                    <input
                      type="number"
                      value={ifaceEditForm.mtu}
                      onChange={(e) => setIfaceEditForm({ ...ifaceEditForm, mtu: parseInt(e.target.value, 10) || 1500 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Comment</label>
                    <input
                      type="text"
                      value={ifaceEditForm.comment}
                      onChange={(e) => setIfaceEditForm({ ...ifaceEditForm, comment: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white"
                    />
                  </div>
                </>
              )}

              {activeMenu === 'ip-addresses' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">IP Address & CIDR Subnet</label>
                    <input
                      type="text"
                      required
                      value={ipForm.address}
                      onChange={(e) => setIpForm({ ...ipForm, address: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Target Interface</label>
                    <select
                      value={ipForm.interface}
                      onChange={(e) => setIpForm({ ...ipForm, interface: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    >
                      {availableInterfaces.map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Comment</label>
                    <input
                      type="text"
                      value={ipForm.comment}
                      onChange={(e) => setIpForm({ ...ipForm, comment: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white"
                    />
                  </div>
                </>
              )}

              {activeMenu === 'ip-routes' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">Dst. Address (CIDR)</label>
                    <input
                      type="text"
                      required
                      value={routeForm.dstAddress}
                      onChange={(e) => setRouteForm({ ...routeForm, dstAddress: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Gateway</label>
                    <input
                      type="text"
                      required
                      value={routeForm.gateway}
                      onChange={(e) => setRouteForm({ ...routeForm, gateway: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Distance</label>
                    <input
                      type="number"
                      min={1}
                      max={255}
                      value={routeForm.distance}
                      onChange={(e) => setRouteForm({ ...routeForm, distance: parseInt(e.target.value, 10) || 1 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                </>
              )}

              {activeMenu === 'queues' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">Queue Name</label>
                    <input
                      type="text"
                      required
                      value={queueForm.name}
                      onChange={(e) => setQueueForm({ ...queueForm, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Target Subnet / IP</label>
                    <input
                      type="text"
                      required
                      value={queueForm.target}
                      onChange={(e) => setQueueForm({ ...queueForm, target: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Max Upload (Mbps)</label>
                      <input
                        type="number"
                        min={1}
                        value={queueForm.maxLimitUpMbps}
                        onChange={(e) => setQueueForm({ ...queueForm, maxLimitUpMbps: parseInt(e.target.value, 10) || 1 })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Max Download (Mbps)</label>
                      <input
                        type="number"
                        min={1}
                        value={queueForm.maxLimitDownMbps}
                        onChange={(e) => setQueueForm({ ...queueForm, maxLimitDownMbps: parseInt(e.target.value, 10) || 1 })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. ADD MODAL FORM DIALOG */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                {addSubType === 'bridgePort'
                  ? 'Add Bridge Port'
                  : addSubType === 'ipPool'
                  ? 'Add IP Pool'
                  : `Add ${activeMenu.replace('-', ' ')}`}
              </h4>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2 rounded bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              {activeMenu === 'ip-addresses' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">IP Address & CIDR Subnet</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 192.168.10.1/24"
                      value={ipForm.address}
                      onChange={(e) => setIpForm({ ...ipForm, address: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Target Interface</label>
                    <select
                      value={ipForm.interface}
                      onChange={(e) => setIpForm({ ...ipForm, interface: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    >
                      {availableInterfaces.map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Comment (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. LAN Gateway"
                      value={ipForm.comment}
                      onChange={(e) => setIpForm({ ...ipForm, comment: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white"
                    />
                  </div>
                </>
              )}

              {activeMenu === 'ip-routes' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">Dst. Address (CIDR)</label>
                    <input
                      type="text"
                      required
                      placeholder="0.0.0.0/0"
                      value={routeForm.dstAddress}
                      onChange={(e) => setRouteForm({ ...routeForm, dstAddress: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Gateway (IP or Interface)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 192.168.1.1 or ether1"
                      value={routeForm.gateway}
                      onChange={(e) => setRouteForm({ ...routeForm, gateway: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Distance Metric</label>
                    <input
                      type="number"
                      min={1}
                      max={255}
                      value={routeForm.distance}
                      onChange={(e) => setRouteForm({ ...routeForm, distance: parseInt(e.target.value, 10) || 1 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                </>
              )}

              {activeMenu === 'bridge' && addSubType === 'default' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">Bridge Name</label>
                    <input
                      type="text"
                      required
                      value={bridgeForm.name}
                      onChange={(e) => setBridgeForm({ ...bridgeForm, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="vlanFilteringCheck"
                      checked={bridgeForm.vlanFiltering}
                      onChange={(e) => setBridgeForm({ ...bridgeForm, vlanFiltering: e.target.checked })}
                      className="rounded bg-slate-950 border-slate-800 text-cyan-600"
                    />
                    <label htmlFor="vlanFilteringCheck" className="text-slate-300">Enable 802.1Q VLAN Filtering</label>
                  </div>
                </>
              )}

              {activeMenu === 'bridge' && addSubType === 'bridgePort' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">Target Bridge</label>
                    <select
                      value={bridgePortForm.bridge}
                      onChange={(e) => setBridgePortForm({ ...bridgePortForm, bridge: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    >
                      {config.bridges.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Hardware Interface</label>
                    <select
                      value={bridgePortForm.interface}
                      onChange={(e) => setBridgePortForm({ ...bridgePortForm, interface: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    >
                      {device.interfaces.map((i) => (
                        <option key={i.id} value={i.name}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">PVID (1-4094)</label>
                    <input
                      type="number"
                      min={1}
                      max={4094}
                      value={bridgePortForm.pvid}
                      onChange={(e) => setBridgePortForm({ ...bridgePortForm, pvid: parseInt(e.target.value, 10) || 1 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                </>
              )}

              {activeMenu === 'vlan' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">VLAN Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. vlan20-staff"
                      value={vlanForm.name}
                      onChange={(e) => setVlanForm({ ...vlanForm, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">VLAN ID (1-4094)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={4094}
                      value={vlanForm.vlanId}
                      onChange={(e) => setVlanForm({ ...vlanForm, vlanId: parseInt(e.target.value, 10) || 1 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Parent Interface</label>
                    <select
                      value={vlanForm.interface}
                      onChange={(e) => setVlanForm({ ...vlanForm, interface: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    >
                      {device.interfaces.map((i) => (
                        <option key={i.id} value={i.name}>
                          {i.name}
                        </option>
                      ))}
                      {config.bridges.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name} (Bridge)
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {activeMenu === 'ip-dhcp' && addSubType === 'default' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">DHCP Server Name</label>
                    <input
                      type="text"
                      required
                      value={dhcpForm.name}
                      onChange={(e) => setDhcpForm({ ...dhcpForm, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Interface</label>
                    <select
                      value={dhcpForm.interface}
                      onChange={(e) => setDhcpForm({ ...dhcpForm, interface: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    >
                      {availableInterfaces.map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Address Pool</label>
                    <select
                      value={dhcpForm.addressPool}
                      onChange={(e) => setDhcpForm({ ...dhcpForm, addressPool: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    >
                      {config.ipPools.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name} ({p.ranges})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Lease Time</label>
                    <input
                      type="text"
                      value={dhcpForm.leaseTime}
                      onChange={(e) => setDhcpForm({ ...dhcpForm, leaseTime: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                </>
              )}

              {activeMenu === 'ip-dhcp' && addSubType === 'ipPool' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">Pool Name</label>
                    <input
                      type="text"
                      required
                      value={poolForm.name}
                      onChange={(e) => setPoolForm({ ...poolForm, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">IP Range (start-end)</label>
                    <input
                      type="text"
                      required
                      placeholder="192.168.10.100-192.168.10.200"
                      value={poolForm.ranges}
                      onChange={(e) => setPoolForm({ ...poolForm, ranges: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                </>
              )}

              {activeMenu === 'ip-dns' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">Hostname (FQDN)</label>
                    <input
                      type="text"
                      required
                      placeholder="server.campus.lan"
                      value={dnsStaticForm.name}
                      onChange={(e) => setDnsStaticForm({ ...dnsStaticForm, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">IPv4 Address</label>
                    <input
                      type="text"
                      required
                      placeholder="10.10.0.50"
                      value={dnsStaticForm.address}
                      onChange={(e) => setDnsStaticForm({ ...dnsStaticForm, address: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                </>
              )}

              {activeMenu === 'ip-firewall' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Chain</label>
                      <select
                        value={firewallForm.chain}
                        onChange={(e) => setFirewallForm({ ...firewallForm, chain: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      >
                        <option value="forward">forward</option>
                        <option value="input">input</option>
                        <option value="output">output</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Action</label>
                      <select
                        value={firewallForm.action}
                        onChange={(e) => setFirewallForm({ ...firewallForm, action: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      >
                        <option value="accept">accept</option>
                        <option value="drop">drop</option>
                        <option value="reject">reject</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Protocol</label>
                    <select
                      value={firewallForm.protocol}
                      onChange={(e) => setFirewallForm({ ...firewallForm, protocol: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    >
                      <option value="all">all</option>
                      <option value="icmp">icmp</option>
                      <option value="tcp">tcp</option>
                      <option value="udp">udp</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Src. Address (optional)</label>
                      <input
                        type="text"
                        placeholder="10.20.0.0/24"
                        value={firewallForm.srcAddress}
                        onChange={(e) => setFirewallForm({ ...firewallForm, srcAddress: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Dst. Address (optional)</label>
                      <input
                        type="text"
                        placeholder="8.8.8.8"
                        value={firewallForm.dstAddress}
                        onChange={(e) => setFirewallForm({ ...firewallForm, dstAddress: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Comment</label>
                    <input
                      type="text"
                      placeholder="Block Guest VLAN to Core"
                      value={firewallForm.comment}
                      onChange={(e) => setFirewallForm({ ...firewallForm, comment: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white"
                    />
                  </div>
                </>
              )}

              {activeMenu === 'ip-nat' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Chain</label>
                      <select
                        value={natForm.chain}
                        onChange={(e) => setNatForm({ ...natForm, chain: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      >
                        <option value="srcnat">srcnat</option>
                        <option value="dstnat">dstnat</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Action</label>
                      <select
                        value={natForm.action}
                        onChange={(e) => setNatForm({ ...natForm, action: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      >
                        <option value="masquerade">masquerade</option>
                        <option value="src-nat">src-nat</option>
                        <option value="dst-nat">dst-nat</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Out. Interface</label>
                    <select
                      value={natForm.outInterface}
                      onChange={(e) => setNatForm({ ...natForm, outInterface: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    >
                      {availableInterfaces.map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Comment</label>
                    <input
                      type="text"
                      placeholder="WAN Masquerade"
                      value={natForm.comment}
                      onChange={(e) => setNatForm({ ...natForm, comment: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white"
                    />
                  </div>
                </>
              )}

              {activeMenu === 'queues' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">Queue Name</label>
                    <input
                      type="text"
                      required
                      value={queueForm.name}
                      onChange={(e) => setQueueForm({ ...queueForm, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Target IP / CIDR Subnet</label>
                    <input
                      type="text"
                      required
                      placeholder="192.168.88.0/24"
                      value={queueForm.target}
                      onChange={(e) => setQueueForm({ ...queueForm, target: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Max Upload (Mbps)</label>
                      <input
                        type="number"
                        min={1}
                        value={queueForm.maxLimitUpMbps}
                        onChange={(e) => setQueueForm({ ...queueForm, maxLimitUpMbps: parseInt(e.target.value, 10) || 1 })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Max Download (Mbps)</label>
                      <input
                        type="number"
                        min={1}
                        value={queueForm.maxLimitDownMbps}
                        onChange={(e) => setQueueForm({ ...queueForm, maxLimitDownMbps: parseInt(e.target.value, 10) || 1 })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-sm"
                >
                  Apply & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
