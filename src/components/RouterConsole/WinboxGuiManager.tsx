import React, { useState } from 'react';
import { NetworkDevice, NetworkProject } from '../../types/network';
import {
  MangleAction,
  MangleChain,
  MangleRule,
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
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Check,
  Ban,
  Tag,
  GitBranch,
} from 'lucide-react';
import { MultiWanManagerPanel } from './MultiWanManagerPanel';

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
  | 'ip-mangle'
  | 'ip-multiwan'
  | 'ip-address-list'
  | 'ip-connections'
  | 'queues'
  | 'system'
  | 'tools'
  | 'logs';

type MangleModalTab = 'general' | 'advanced' | 'action' | 'extra';

type MangleFormState = Omit<MangleRule, 'id' | 'order' | 'invalid' | 'createdAt' | 'updatedAt' | 'bytes' | 'packets'>;

const DEFAULT_MANGLE_FORM: MangleFormState = {
  chain: 'prerouting',
  action: 'mark-connection',
  srcAddress: '',
  dstAddress: '',
  protocol: undefined,
  srcPort: '',
  dstPort: '',
  inInterface: '',
  outInterface: '',
  inInterfaceList: '',
  outInterfaceList: '',
  srcAddressList: '',
  dstAddressList: '',
  connectionState: '',
  connectionMark: '',
  packetMark: '',
  routingMark: '',
  packetLength: '',
  dscp: undefined,
  priority: undefined,
  pcc: '',
  limit: '',
  time: '',
  layer7Protocol: '',
  connectionBytes: '',
  connectionRate: '',
  newConnectionMark: '',
  newPacketMark: '',
  newRoutingMark: '',
  addressList: '',
  addressListTimeout: '',
  newDscp: undefined,
  newMss: undefined,
  newTtl: '',
  logPrefix: '',
  passthrough: true,
  disabled: false,
  comment: '',
};

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
  const [addSubType, setAddSubType] = useState<'default' | 'bridgePort' | 'ipPool' | 'dnsStatic' | 'routingTable' | 'queueTree'>('default');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ type: string; id: string; label?: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Mangle Modal states
  const [isMangleModalOpen, setIsMangleModalOpen] = useState(false);
  const [mangleModalMode, setMangleModalMode] = useState<'add' | 'edit'>('add');
  const [mangleModalTab, setMangleModalTab] = useState<MangleModalTab>('general');
  const [mangleForm, setMangleForm] = useState<MangleFormState>(DEFAULT_MANGLE_FORM);

  // Form states for Add / Edit
  const [ipForm, setIpForm] = useState({ address: '', interface: device.interfaces[0]?.name || 'ether1', comment: '' });
  const [routeForm, setRouteForm] = useState({ dstAddress: '0.0.0.0/0', gateway: '', distance: 1, routingTable: 'main', comment: '' });
  const [routingTableForm, setRoutingTableForm] = useState({ name: 'ke-isp2', fib: true, comment: '' });
  const [bridgeForm, setBridgeForm] = useState({ name: 'bridge1', vlanFiltering: true, comment: '' });
  const [bridgePortForm, setBridgePortForm] = useState({ bridge: config.bridges[0]?.name || 'bridge1', interface: device.interfaces[0]?.name || 'ether1', pvid: 1 });
  const [vlanForm, setVlanForm] = useState({ name: 'vlan10', vlanId: 10, interface: device.interfaces[0]?.name || 'ether1', comment: '' });
  const [dhcpForm, setDhcpForm] = useState({ name: 'dhcp1', interface: device.interfaces[0]?.name || 'ether1', addressPool: config.ipPools[0]?.name || 'dhcp-pool-lan', leaseTime: '10m' });
  const [poolForm, setPoolForm] = useState({ name: 'pool-vlan', ranges: '192.168.10.100-192.168.10.200' });
  const [dnsServersInput, setDnsServersInput] = useState(config.dns.servers.join(', '));
  const [dnsRemoteReq, setDnsRemoteReq] = useState(config.dns.allowRemoteRequests);
  const [dnsStaticForm, setDnsStaticForm] = useState({ name: 'host.lan', address: '192.168.88.10', ttl: '1d' });
  const [firewallForm, setFirewallForm] = useState({ chain: 'forward' as 'input' | 'forward' | 'output', action: 'drop' as 'accept' | 'drop' | 'reject', protocol: 'all', srcAddress: '', dstAddress: '', inInterface: '', outInterface: '', connectionMark: '', packetMark: '', comment: '' });
  const [natForm, setNatForm] = useState({ chain: 'srcnat' as 'srcnat' | 'dstnat', action: 'masquerade' as 'masquerade' | 'src-nat' | 'dst-nat', outInterface: device.interfaces.find((i) => i.mode === 'wan')?.name || device.interfaces[0]?.name || 'ether1', toAddresses: '', comment: '' });
  const [addressListForm, setAddressListForm] = useState({ list: 'CIVITAS_UNIV', address: '10.10.0.0/24', timeout: '', comment: '' });
  const [queueForm, setQueueForm] = useState({ name: 'queue-lan', target: '192.168.88.0/24', maxLimitUpMbps: 10, maxLimitDownMbps: 20, packetMarks: '', priority: 8, comment: '' });
  const [queueTreeForm, setQueueTreeForm] = useState({ name: 'QT-HTTP-PRIO', parent: 'global', packetMark: 'pkt-http', maxLimitMbps: 50, priority: 2, comment: '' });
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

  // Existing marks & lists for autocomplete / dropdown helpers
  const existingConnectionMarks = Array.from(
    new Set(
      (config.firewall.mangleRules || [])
        .map((m) => m.newConnectionMark)
        .filter((v): v is string => !!v)
    )
  );
  const existingPacketMarks = Array.from(
    new Set(
      (config.firewall.mangleRules || [])
        .map((m) => m.newPacketMark)
        .filter((v): v is string => !!v)
    )
  );
  const existingRoutingTables = Array.from(
    new Set([
      'main',
      ...(config.routingTables || []).map((t) => t.name),
      ...(config.firewall.mangleRules || [])
        .map((m) => m.newRoutingMark)
        .filter((v): v is string => !!v),
    ])
  );
  const existingAddressLists = Array.from(
    new Set([
      ...(config.firewall.addressLists || []).map((a) => a.list),
      ...(config.firewall.mangleRules || [])
        .map((m) => m.addressList)
        .filter((v): v is string => !!v),
    ])
  );

  // ==========================================
  // MANGLE HANDLERS
  // ==========================================

  const handleOpenAddMangleModal = () => {
    setFormError(null);
    setMangleModalMode('add');
    setMangleModalTab('general');
    setMangleForm({ ...DEFAULT_MANGLE_FORM });
    setIsMangleModalOpen(true);
  };

  const handleOpenEditMangleModal = (ruleId?: string) => {
    const targetId = ruleId || selectedRowId;
    if (!targetId) return;
    const rule = (config.firewall.mangleRules || []).find((m) => m.id === targetId);
    if (!rule) return;

    setSelectedRowId(rule.id);
    setFormError(null);
    setMangleModalMode('edit');
    setMangleModalTab('general');
    setMangleForm({
      chain: rule.chain,
      action: rule.action,
      srcAddress: rule.srcAddress || '',
      dstAddress: rule.dstAddress || '',
      protocol: rule.protocol,
      srcPort: rule.srcPort || '',
      dstPort: rule.dstPort || '',
      inInterface: rule.inInterface || '',
      outInterface: rule.outInterface || '',
      inInterfaceList: rule.inInterfaceList || '',
      outInterfaceList: rule.outInterfaceList || '',
      srcAddressList: rule.srcAddressList || '',
      dstAddressList: rule.dstAddressList || '',
      connectionState: rule.connectionState || '',
      connectionMark: rule.connectionMark || '',
      packetMark: rule.packetMark || '',
      routingMark: rule.routingMark || '',
      packetLength: rule.packetLength || '',
      dscp: rule.dscp,
      priority: rule.priority,
      pcc: rule.pcc || '',
      limit: rule.limit || '',
      time: rule.time || '',
      layer7Protocol: rule.layer7Protocol || '',
      connectionBytes: rule.connectionBytes || '',
      connectionRate: rule.connectionRate || '',
      newConnectionMark: rule.newConnectionMark || '',
      newPacketMark: rule.newPacketMark || '',
      newRoutingMark: rule.newRoutingMark || '',
      addressList: rule.addressList || '',
      addressListTimeout: rule.addressListTimeout || '',
      newDscp: rule.newDscp,
      newMss: rule.newMss,
      newTtl: rule.newTtl || '',
      logPrefix: rule.logPrefix || '',
      passthrough: rule.passthrough !== false,
      disabled: !!rule.disabled,
      comment: rule.comment || '',
    });
    setIsMangleModalOpen(true);
  };

  const handleMangleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload: MangleFormState = {
      chain: mangleForm.chain,
      action: mangleForm.action,
      srcAddress: mangleForm.srcAddress?.trim() || undefined,
      dstAddress: mangleForm.dstAddress?.trim() || undefined,
      protocol: mangleForm.protocol || undefined,
      srcPort: mangleForm.srcPort?.trim() || undefined,
      dstPort: mangleForm.dstPort?.trim() || undefined,
      inInterface: mangleForm.inInterface?.trim() || undefined,
      outInterface: mangleForm.outInterface?.trim() || undefined,
      inInterfaceList: mangleForm.inInterfaceList?.trim() || undefined,
      outInterfaceList: mangleForm.outInterfaceList?.trim() || undefined,
      srcAddressList: mangleForm.srcAddressList?.trim() || undefined,
      dstAddressList: mangleForm.dstAddressList?.trim() || undefined,
      connectionState: mangleForm.connectionState?.trim() || undefined,
      connectionMark: mangleForm.connectionMark?.trim() || undefined,
      packetMark: mangleForm.packetMark?.trim() || undefined,
      routingMark: mangleForm.routingMark?.trim() || undefined,
      packetLength: mangleForm.packetLength?.trim() || undefined,
      dscp: mangleForm.dscp !== undefined && !isNaN(Number(mangleForm.dscp)) ? Number(mangleForm.dscp) : undefined,
      priority: mangleForm.priority !== undefined && !isNaN(Number(mangleForm.priority)) ? Number(mangleForm.priority) : undefined,
      pcc: mangleForm.pcc?.trim() || undefined,
      limit: mangleForm.limit?.trim() || undefined,
      time: mangleForm.time?.trim() || undefined,
      layer7Protocol: mangleForm.layer7Protocol?.trim() || undefined,
      connectionBytes: mangleForm.connectionBytes?.trim() || undefined,
      connectionRate: mangleForm.connectionRate?.trim() || undefined,
      newConnectionMark: mangleForm.action === 'mark-connection' ? mangleForm.newConnectionMark?.trim() : undefined,
      newPacketMark: mangleForm.action === 'mark-packet' ? mangleForm.newPacketMark?.trim() : undefined,
      newRoutingMark: mangleForm.action === 'mark-routing' ? mangleForm.newRoutingMark?.trim() : undefined,
      addressList:
        mangleForm.action === 'add-src-to-address-list' || mangleForm.action === 'add-dst-to-address-list'
          ? mangleForm.addressList?.trim()
          : undefined,
      addressListTimeout:
        mangleForm.action === 'add-src-to-address-list' || mangleForm.action === 'add-dst-to-address-list'
          ? mangleForm.addressListTimeout?.trim() || undefined
          : undefined,
      newDscp:
        mangleForm.action === 'change-dscp' && mangleForm.newDscp !== undefined
          ? Number(mangleForm.newDscp)
          : undefined,
      newMss:
        mangleForm.action === 'change-mss' && mangleForm.newMss !== undefined
          ? Number(mangleForm.newMss)
          : undefined,
      newTtl: mangleForm.action === 'change-ttl' && mangleForm.newTtl !== undefined ? String(mangleForm.newTtl).trim() || undefined : undefined,
      logPrefix: mangleForm.action === 'log' ? mangleForm.logPrefix?.trim() : undefined,
      passthrough: mangleForm.passthrough,
      disabled: mangleForm.disabled,
      comment: mangleForm.comment?.trim() || undefined,
    };

    if (mangleModalMode === 'add') {
      const res = mutateConfig(`Add Mangle Rule (${payload.chain} -> ${payload.action})`, (dev) =>
        RouterOsConfigService.addMangleRule(dev, payload)
      );
      if (!res.success) {
        setFormError(res.error || 'Failed to add Mangle rule');
        return;
      }
    } else {
      if (!selectedRowId) return;
      const res = mutateConfig(`Edit Mangle Rule (${payload.chain} -> ${payload.action})`, (dev) =>
        RouterOsConfigService.updateMangleRule(dev, selectedRowId, payload)
      );
      if (!res.success) {
        setFormError(res.error || 'Failed to update Mangle rule');
        return;
      }
    }

    setIsMangleModalOpen(false);
  };

  const handleMoveMangleRule = (direction: 'up' | 'down') => {
    if (!selectedRowId) return;
    const rules = config.firewall.mangleRules || [];
    const currentIdx = rules.findIndex((m) => m.id === selectedRowId);
    if (currentIdx === -1) return;
    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= rules.length) return;

    mutateConfig(`Move Mangle Rule ${direction === 'up' ? 'Up' : 'Down'}`, (dev) =>
      RouterOsConfigService.moveMangleRule(dev, selectedRowId, targetIdx)
    );
  };

  const handleResetMangleCounters = (all: boolean) => {
    if (all) {
      mutateConfig('Reset All Mangle Counters (Winbox)', (dev) =>
        RouterOsConfigService.resetMangleCounters(dev)
      );
    } else if (selectedRowId) {
      mutateConfig('Reset Mangle Rule Counters (Winbox)', (dev) =>
        RouterOsConfigService.resetMangleCounters(dev, selectedRowId)
      );
    }
  };

  // ==========================================
  // ACTION HANDLERS
  // ==========================================

  const handleToggleEnable = (type: string, id: string, explicitDisabled?: boolean) => {
    if (type === 'ip') {
      const item = config.ipAddresses.find((a) => a.id === id);
      if (!item) return;
      mutateConfig('Toggle IP Address', (dev) =>
        RouterOsConfigService.setIpAddress(dev, id, { disabled: explicitDisabled ?? !item.disabled })
      );
    } else if (type === 'interface') {
      const item = config.interfaces.find((i) => i.id === id);
      if (!item) return;
      mutateConfig('Toggle Interface Admin State', (_, cfg) => {
        const updated = cfg.interfaces.map((i) => (i.id === id ? { ...i, disabled: explicitDisabled ?? !i.disabled } : i));
        return { success: true, config: { ...cfg, interfaces: updated } };
      });
    } else if (type === 'route') {
      const item = config.routes.find((r) => r.id === id);
      if (!item) return;
      mutateConfig('Toggle Route State', (_, cfg) => {
        const updated = cfg.routes.map((r) => (r.id === id ? { ...r, disabled: explicitDisabled ?? !r.disabled } : r));
        return { success: true, config: { ...cfg, routes: updated } };
      });
    } else if (type === 'bridge') {
      const item = config.bridges.find((b) => b.id === id);
      if (!item) return;
      mutateConfig('Toggle Bridge State', (_, cfg) => {
        const updated = cfg.bridges.map((b) => (b.id === id ? { ...b, disabled: explicitDisabled ?? !b.disabled } : b));
        return { success: true, config: { ...cfg, bridges: updated } };
      });
    } else if (type === 'vlan') {
      const item = config.vlans.find((v) => v.id === id);
      if (!item) return;
      mutateConfig('Toggle VLAN State', (_, cfg) => {
        const updated = cfg.vlans.map((v) => (v.id === id ? { ...v, disabled: explicitDisabled ?? !v.disabled } : v));
        return { success: true, config: { ...cfg, vlans: updated } };
      });
    } else if (type === 'dhcp') {
      const item = config.dhcpServers.find((d) => d.id === id);
      if (!item) return;
      mutateConfig('Toggle DHCP Server', (_, cfg) => {
        const updated = cfg.dhcpServers.map((d) => (d.id === id ? { ...d, disabled: explicitDisabled ?? !d.disabled } : d));
        return { success: true, config: { ...cfg, dhcpServers: updated } };
      });
    } else if (type === 'queue') {
      const item = config.queues.find((q) => q.id === id);
      if (!item) return;
      mutateConfig('Toggle Queue State', (_, cfg) => {
        const updated = cfg.queues.map((q) => (q.id === id ? { ...q, disabled: explicitDisabled ?? !q.disabled } : q));
        return { success: true, config: { ...cfg, queues: updated } };
      });
    } else if (type === 'filter') {
      const item = config.firewall.filterRules.find((f) => f.id === id);
      if (!item) return;
      mutateConfig('Toggle Filter Rule', (_, cfg) => {
        const updated = cfg.firewall.filterRules.map((f) => (f.id === id ? { ...f, disabled: explicitDisabled ?? !f.disabled } : f));
        return { success: true, config: { ...cfg, firewall: { ...cfg.firewall, filterRules: updated } } };
      });
    } else if (type === 'nat') {
      const item = config.firewall.natRules.find((n) => n.id === id);
      if (!item) return;
      mutateConfig('Toggle NAT Rule', (_, cfg) => {
        const updated = cfg.firewall.natRules.map((n) => (n.id === id ? { ...n, disabled: explicitDisabled ?? !n.disabled } : n));
        return { success: true, config: { ...cfg, firewall: { ...cfg.firewall, natRules: updated } } };
      });
    } else if (type === 'mangle') {
      const item = (config.firewall.mangleRules || []).find((m) => m.id === id);
      if (!item) return;
      const targetDisabled = explicitDisabled !== undefined ? explicitDisabled : !item.disabled;
      mutateConfig(`${targetDisabled ? 'Disable' : 'Enable'} Mangle Rule (Winbox)`, (dev) =>
        RouterOsConfigService.setMangleRuleDisabled(dev, id, targetDisabled)
      );
    }
  };

  const confirmAndDeleteItem = () => {
    if (!pendingDelete) return;
    const { type, id } = pendingDelete;
    if (type === 'ip') {
      mutateConfig('Remove IP Address', (dev) => RouterOsConfigService.removeIpAddress(dev, id));
    } else if (type === 'route') {
      mutateConfig('Remove Route', (dev) => RouterOsConfigService.removeRoute(dev, id));
    } else if (type === 'routingTable') {
      mutateConfig('Remove Routing Table', (dev) => RouterOsConfigService.removeRoutingTable(dev, id));
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
    } else if (type === 'mangle') {
      mutateConfig('Remove Mangle Rule (Winbox)', (dev) => RouterOsConfigService.removeMangleRule(dev, id));
    } else if (type === 'addressList') {
      mutateConfig('Remove Address List Entry', (dev) => RouterOsConfigService.removeAddressListEntry(dev, id));
    } else if (type === 'queue') {
      mutateConfig('Remove Simple Queue', (dev) => RouterOsConfigService.removeSimpleQueue(dev, id));
    } else if (type === 'queueTree') {
      mutateConfig('Remove Queue Tree', (dev) => RouterOsConfigService.removeQueueTree(dev, id));
    }
    setPendingDelete(null);
    setSelectedRowId(null);
  };

  // Open Edit Modal pre-populated with selected item
  const handleOpenEditModal = () => {
    if (!selectedRowId) return;
    setFormError(null);

    if (activeMenu === 'ip-mangle') {
      handleOpenEditMangleModal(selectedRowId);
      return;
    }

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
      setRouteForm({ dstAddress: item.dstAddress, gateway: item.gateway, distance: item.distance, routingTable: item.routingTable || 'main', comment: item.comment || '' });
      setIsEditModalOpen(true);
    } else if (activeMenu === 'queues') {
      const item = config.queues.find((q) => q.id === selectedRowId);
      if (!item) return;
      setQueueForm({
        name: item.name,
        target: item.target,
        maxLimitUpMbps: Math.round(item.maxLimitUploadBps / 1_000_000),
        maxLimitDownMbps: Math.round(item.maxLimitDownloadBps / 1_000_000),
        packetMarks: item.packetMarks || '',
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
            ? {
                ...r,
                dstAddress: routeForm.dstAddress.trim(),
                gateway: routeForm.gateway.trim(),
                distance: Number(routeForm.distance) || 1,
                routingTable: routeForm.routingTable || 'main',
                routingMark: routeForm.routingTable !== 'main' ? routeForm.routingTable : undefined,
                comment: routeForm.comment.trim() || undefined,
              }
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
                packetMarks: queueForm.packetMarks.trim() || undefined,
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
      if (addSubType === 'routingTable') {
        const res = mutateConfig('Add Routing Table (Winbox)', (dev) =>
          RouterOsConfigService.addRoutingTable(dev, {
            name: routingTableForm.name.trim(),
            fib: routingTableForm.fib,
            comment: routingTableForm.comment.trim() || undefined,
          })
        );
        if (!res.success) {
          setFormError(res.error || 'Failed to add routing table');
          return;
        }
      } else {
        const res = mutateConfig('Add Route (Winbox)', (dev) =>
          RouterOsConfigService.addRoute(dev, {
            dstAddress: routeForm.dstAddress.trim(),
            gateway: routeForm.gateway.trim(),
            distance: Number(routeForm.distance) || 1,
            routingTable: routeForm.routingTable || 'main',
            routingMark: routeForm.routingTable !== 'main' ? routeForm.routingTable : undefined,
            comment: routeForm.comment.trim() || undefined,
          })
        );
        if (!res.success) {
          setFormError(res.error || 'Failed to add route');
          return;
        }
        setRouteForm({ dstAddress: '0.0.0.0/0', gateway: '', distance: 1, routingTable: 'main', comment: '' });
      }
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
          connectionMark: firewallForm.connectionMark.trim() || undefined,
          packetMark: firewallForm.packetMark.trim() || undefined,
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
    } else if (activeMenu === 'ip-address-list') {
      const res = mutateConfig('Add Address List Entry (Winbox)', (dev) =>
        RouterOsConfigService.addAddressListEntry(dev, {
          list: addressListForm.list.trim(),
          address: addressListForm.address.trim(),
          timeout: addressListForm.timeout.trim() || undefined,
          comment: addressListForm.comment.trim() || undefined,
        })
      );
      if (!res.success) {
        setFormError(res.error || 'Failed to add address list entry');
        return;
      }
    } else if (activeMenu === 'queues') {
      if (addSubType === 'queueTree') {
        const res = mutateConfig('Add Queue Tree (Winbox)', (dev) =>
          RouterOsConfigService.addQueueTree(dev, {
            name: queueTreeForm.name.trim(),
            parent: queueTreeForm.parent.trim() || 'global',
            packetMark: queueTreeForm.packetMark.trim() || 'no-mark',
            maxLimitBps: (Number(queueTreeForm.maxLimitMbps) || 10) * 1_000_000,
            priority: Number(queueTreeForm.priority) || 8,
            comment: queueTreeForm.comment.trim() || undefined,
          })
        );
        if (!res.success) {
          setFormError(res.error || 'Failed to add queue tree');
          return;
        }
      } else {
        const res = mutateConfig('Add Simple Queue (Winbox)', (dev) =>
          RouterOsConfigService.addSimpleQueue(dev, {
            name: queueForm.name.trim(),
            target: queueForm.target.trim(),
            maxLimitUploadBps: queueForm.maxLimitUpMbps * 1_000_000,
            maxLimitDownloadBps: queueForm.maxLimitDownMbps * 1_000_000,
            packetMarks: queueForm.packetMarks.trim() || undefined,
            priority: Number(queueForm.priority) || 8,
            comment: queueForm.comment.trim() || undefined,
          })
        );
        if (!res.success) {
          setFormError(res.error || 'Failed to add simple queue');
          return;
        }
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

  const isFirewallSubMenu = ['ip-firewall', 'ip-nat', 'ip-mangle', 'ip-address-list', 'ip-connections'].includes(activeMenu);
  const selectedMangleRule = (config.firewall.mangleRules || []).find((m) => m.id === selectedRowId);
  const selectedMangleIdx = (config.firewall.mangleRules || []).findIndex((m) => m.id === selectedRowId);

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
            { id: 'ip-mangle', label: `Mangle (${(config.firewall.mangleRules || []).length})`, icon: Tag },
            { id: 'ip-multiwan', label: 'Multi-WAN Manager', icon: GitBranch },
            { id: 'queues', label: `Queues (${config.queues.length + (config.queueTree || []).length})`, icon: Sliders },
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
        {/* IP -> Firewall Sub-Navigation Bar when inside Firewall / NAT / Mangle / Address Lists / Connections */}
        {isFirewallSubMenu && (
          <div className="flex items-center gap-1 px-4 pt-2 bg-slate-900 border-b border-slate-800 text-xs shrink-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mr-2">
              IP → Firewall:
            </span>
            {[
              { id: 'ip-firewall', label: `Filter Rules (${config.firewall.filterRules.length})` },
              { id: 'ip-nat', label: `NAT (${config.firewall.natRules.length})` },
              { id: 'ip-mangle', label: `Mangle (${(config.firewall.mangleRules || []).length})` },
              { id: 'ip-address-list', label: `Address Lists (${(config.firewall.addressLists || []).length})` },
              { id: 'ip-connections', label: `Connections (${(config.connectionTracking || []).length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveMenu(tab.id as WinboxMenu);
                  setSelectedRowId(null);
                }}
                className={`px-3 py-1.5 rounded-t-lg font-mono text-[11px] font-bold border-t border-x transition-colors ${
                  activeMenu === tab.id
                    ? 'bg-slate-950 text-cyan-400 border-slate-700'
                    : 'bg-slate-900/50 text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Top Winbox Window Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-white uppercase text-[11px] tracking-wider font-mono">
              {activeMenu === 'ip-mangle'
                ? 'IP → FIREWALL → MANGLE'
                : activeMenu === 'ip-address-list'
                ? 'IP → FIREWALL → ADDRESS LISTS'
                : activeMenu === 'ip-connections'
                ? 'IP → FIREWALL → CONNECTIONS'
                : activeMenu.replace('-', ' ')}
            </span>

            {/* Complete Mangle Toolbar (Add, Edit, Remove, Enable, Disable, Move Up, Move Down, Reset Counters, Reset All Counters) */}
            {activeMenu === 'ip-mangle' && (
              <div className="flex flex-wrap items-center gap-1 ml-2 border-l border-slate-700/80 pl-2.5">
                <button
                  onClick={handleOpenAddMangleModal}
                  className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
                <button
                  disabled={!selectedMangleRule}
                  onClick={() => handleOpenEditMangleModal()}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-cyan-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
                <button
                  disabled={!selectedMangleRule}
                  onClick={() => {
                    if (selectedMangleRule) {
                      setPendingDelete({
                        type: 'mangle',
                        id: selectedMangleRule.id,
                        label: `Mangle Rule #${selectedMangleIdx} (${selectedMangleRule.chain} -> ${selectedMangleRule.action})`,
                      });
                    }
                  }}
                  className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 disabled:opacity-40 text-rose-300 border border-rose-800/60 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>
                <button
                  disabled={!selectedMangleRule || !selectedMangleRule.disabled}
                  onClick={() => selectedMangleRule && handleToggleEnable('mangle', selectedMangleRule.id, false)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-emerald-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <Check className="w-3 h-3" />
                  <span>Enable</span>
                </button>
                <button
                  disabled={!selectedMangleRule || !!selectedMangleRule.disabled}
                  onClick={() => selectedMangleRule && handleToggleEnable('mangle', selectedMangleRule.id, true)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <Ban className="w-3 h-3" />
                  <span>Disable</span>
                </button>
                <button
                  disabled={!selectedMangleRule || selectedMangleIdx <= 0}
                  onClick={() => handleMoveMangleRule('up')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                  title="Move Selected Rule Up"
                >
                  <ArrowUp className="w-3 h-3" />
                  <span>Move Up</span>
                </button>
                <button
                  disabled={!selectedMangleRule || selectedMangleIdx >= (config.firewall.mangleRules || []).length - 1}
                  onClick={() => handleMoveMangleRule('down')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                  title="Move Selected Rule Down"
                >
                  <ArrowDown className="w-3 h-3" />
                  <span>Move Down</span>
                </button>
                <button
                  disabled={!selectedMangleRule}
                  onClick={() => handleResetMangleCounters(false)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Counters</span>
                </button>
                <button
                  disabled={(config.firewall.mangleRules || []).length === 0}
                  onClick={() => handleResetMangleCounters(true)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset All Counters</span>
                </button>
              </div>
            )}

            {/* Standard CRUD Toolbar Buttons for other menus */}
            {['ip-addresses', 'ip-routes', 'bridge', 'vlan', 'ip-dhcp', 'ip-dns', 'ip-firewall', 'ip-nat', 'ip-address-list', 'queues'].includes(activeMenu) && (
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
                      : activeMenu === 'queues'
                      ? 'Add Simple Queue'
                      : 'Add'}
                  </span>
                </button>

                {activeMenu === 'ip-routes' && (
                  <button
                    onClick={() => {
                      setFormError(null);
                      setAddSubType('routingTable');
                      setIsAddModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Routing Table</span>
                  </button>
                )}

                {activeMenu === 'queues' && (
                  <button
                    onClick={() => {
                      setFormError(null);
                      setAddSubType('queueTree');
                      setIsAddModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Queue Tree</span>
                  </button>
                )}

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
            {['interfaces', 'bridge', 'vlan', 'ip-addresses', 'ip-routes', 'ip-dns', 'ip-firewall', 'ip-nat', 'ip-mangle', 'ip-address-list', 'ip-connections', 'queues', 'tools'].includes(activeMenu) ? (
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
        {activeMenu === 'ip-multiwan' ? (
          <div className="flex-1 overflow-hidden">
            <MultiWanManagerPanel
              device={device}
              project={project}
              mutateConfig={mutateConfig}
            />
          </div>
        ) : (
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
                  <span className="text-slate-500 text-[10px] block">FIREWALL, NAT & MANGLE</span>
                  <span className="text-lg font-bold text-purple-400">
                    {config.firewall.filterRules.length + config.firewall.natRules.length + (config.firewall.mangleRules || []).length}
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
                      <strong>Static & Policy Routing (LPM + PBR)</strong>, <strong>DNS Resolver & Static</strong>,{' '}
                      <strong>NAT (masquerade/src-nat)</strong>, <strong>Firewall Filter (input/forward)</strong>,{' '}
                      <strong>Firewall Mangle (mark-connection, mark-packet, mark-routing, PCC, passthrough)</strong>,{' '}
                      <strong>Simple Queues & Queue Tree (QoS shaping & CPU load)</strong>.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-800/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300 font-mono text-[11px]">VALIDATED</span>
                      <span className="text-[10px] text-cyan-400/80 font-mono">Active in Topology Diagnostics</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      <strong>DHCP Server & IP Pools</strong> (validates pool existence & interface subnet assignment),{' '}
                      <strong>RouterOS v7 Routing Table Guard</strong> (validates Mangle mark-routing against /routing table),{' '}
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

          {/* VIEW 4: IP ROUTES & ROUTING TABLES */}
          {activeMenu === 'ip-routes' && (
            <div className="space-y-4">
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
                <div className="p-2.5 bg-slate-950 border-b border-slate-800 font-bold text-white flex items-center justify-between">
                  <span>Route List ({config.routes.length})</span>
                  <span className="text-[10px] text-slate-400">
                    Supports Main FIB & Policy Based Routing ({config.version === 'v7' ? 'routing-table' : 'routing-mark'})
                  </span>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="p-2.5">Flags</th>
                      <th className="p-2.5">Dst. Address</th>
                      <th className="p-2.5">Gateway</th>
                      <th className="p-2.5">Distance</th>
                      <th className="p-2.5">{config.version === 'v7' ? 'Routing Table' : 'Routing Mark'}</th>
                      <th className="p-2.5">Comment</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {config.routes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-500 italic">
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
                            <td className="p-2.5">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-[10px]">
                                {route.routingTable || route.routingMark || 'main'}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-400 italic">{route.comment || '-'}</td>
                            <td className="p-2.5 text-right font-sans space-x-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRowId(route.id);
                                  setRouteForm({
                                    dstAddress: route.dstAddress,
                                    gateway: route.gateway,
                                    distance: route.distance,
                                    routingTable: route.routingTable || route.routingMark || 'main',
                                    comment: route.comment || '',
                                  });
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

              {/* Routing Tables (/routing table) */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
                <div className="p-2.5 bg-slate-950 border-b border-slate-800 font-bold text-white flex items-center justify-between">
                  <span>Routing Tables (/routing table) — ({(config.routingTables || []).length})</span>
                  <span className="text-[10px] text-amber-300">
                    {config.version === 'v7'
                      ? 'RouterOS v7: Required for Mangle action=mark-routing'
                      : 'RouterOS v6: Optional (v6 creates routing-marks dynamically)'}
                  </span>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="p-2.5">Flags</th>
                      <th className="p-2.5">Table Name</th>
                      <th className="p-2.5">FIB</th>
                      <th className="p-2.5">Comment</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(config.routingTables || []).map((rt) => (
                      <tr key={rt.id} className="hover:bg-slate-800/50">
                        <td className="p-2.5 font-bold text-emerald-400">{rt.fib ? 'F' : '-'}</td>
                        <td className="p-2.5 font-bold text-white">{rt.name}</td>
                        <td className="p-2.5 text-cyan-300">{rt.fib ? 'yes' : 'no'}</td>
                        <td className="p-2.5 text-slate-400 italic">{rt.comment || '-'}</td>
                        <td className="p-2.5 text-right font-sans">
                          {rt.name !== 'main' && (
                            <button
                              onClick={() => setPendingDelete({ type: 'routingTable', id: rt.id, label: `Routing Table ${rt.name}` })}
                              className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800/50"
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

          {/* VIEW 10B: FIREWALL MANGLE (/ip firewall mangle) */}
          {activeMenu === 'ip-mangle' && (
            <div className="space-y-3">
              <div className="border border-slate-800 rounded-lg overflow-x-auto bg-slate-900/90 text-xs font-mono">
                <table className="w-full text-left min-w-[1150px]">
                  <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="p-2.5 w-16"># / Flags</th>
                      <th className="p-2.5">Action</th>
                      <th className="p-2.5">Chain</th>
                      <th className="p-2.5">Src. Address</th>
                      <th className="p-2.5">Dst. Address</th>
                      <th className="p-2.5">Protocol</th>
                      <th className="p-2.5">Src. Port</th>
                      <th className="p-2.5">Dst. Port</th>
                      <th className="p-2.5">In. Interface</th>
                      <th className="p-2.5">Out. Interface</th>
                      <th className="p-2.5 text-right">Bytes</th>
                      <th className="p-2.5 text-right">Packets</th>
                      <th className="p-2.5">Comment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(config.firewall.mangleRules || []).length === 0 ? (
                      <tr>
                        <td colSpan={13} className="p-8 text-center text-slate-500 italic">
                          No Firewall Mangle rules configured. Click "+ Add" above or use CLI `/ip firewall mangle add` to configure packet marking, PCC Multi-WAN, or Policy Based Routing.
                        </td>
                      </tr>
                    ) : (
                      (config.firewall.mangleRules || [])
                        .filter((m) => {
                          if (!searchQuery.trim()) return true;
                          const q = searchQuery.toLowerCase();
                          return (
                            m.chain.toLowerCase().includes(q) ||
                            m.action.toLowerCase().includes(q) ||
                            (m.srcAddress || '').toLowerCase().includes(q) ||
                            (m.dstAddress || '').toLowerCase().includes(q) ||
                            (m.newConnectionMark || '').toLowerCase().includes(q) ||
                            (m.newPacketMark || '').toLowerCase().includes(q) ||
                            (m.newRoutingMark || '').toLowerCase().includes(q) ||
                            (m.comment || '').toLowerCase().includes(q)
                          );
                        })
                        .map((m, idx) => {
                          const flagStr = `${m.disabled ? 'X' : ''}${m.invalid ? 'I' : ''}${m.dynamic ? 'D' : ''}`;
                          const markBadge =
                            m.action === 'mark-connection'
                              ? `→ conn:${m.newConnectionMark}`
                              : m.action === 'mark-packet'
                              ? `→ pkt:${m.newPacketMark}`
                              : m.action === 'mark-routing'
                              ? `→ route:${m.newRoutingMark}`
                              : m.action === 'add-src-to-address-list' || m.action === 'add-dst-to-address-list'
                              ? `→ list:${m.addressList}`
                              : m.action === 'change-dscp'
                              ? `→ dscp:${m.newDscp}`
                              : m.action === 'change-mss'
                              ? `→ mss:${m.newMss}`
                              : m.action === 'change-ttl'
                              ? `→ ttl:${m.newTtl}`
                              : '';

                          return (
                            <tr
                              key={m.id}
                              onClick={() => setSelectedRowId(m.id)}
                              onDoubleClick={() => handleOpenEditMangleModal(m.id)}
                              title={m.invalidReason ? `Invalid Rule: ${m.invalidReason}` : 'Double-click to edit Mangle rule'}
                              className={`hover:bg-slate-800/60 cursor-pointer transition-colors ${
                                selectedRowId === m.id ? 'bg-cyan-950/50 text-cyan-100' : ''
                              } ${m.disabled ? 'opacity-50' : ''} ${m.invalid ? 'bg-rose-950/25 text-rose-300' : ''}`}
                            >
                              <td className="p-2.5 font-bold whitespace-nowrap">
                                <span className="text-slate-500 mr-1.5">{idx}</span>
                                {flagStr ? (
                                  <span
                                    className={`px-1 py-0.5 rounded text-[10px] ${
                                      m.invalid
                                        ? 'bg-rose-950 text-rose-300 border border-rose-700/60'
                                        : 'bg-slate-800 text-amber-300'
                                    }`}
                                  >
                                    {flagStr}
                                  </span>
                                ) : (
                                  <span className="text-emerald-400">✓</span>
                                )}
                              </td>
                              <td className="p-2.5 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-purple-950/90 text-purple-300 border border-purple-700/60">
                                    {m.action}
                                  </span>
                                  {markBadge && (
                                    <span className="text-[10px] text-cyan-300 font-semibold">{markBadge}</span>
                                  )}
                                  {['mark-connection', 'mark-packet', 'mark-routing'].includes(m.action) && (
                                    <span
                                      className={`text-[9px] px-1 rounded ${
                                        m.passthrough !== false
                                          ? 'bg-emerald-950/70 text-emerald-300'
                                          : 'bg-amber-950/70 text-amber-300'
                                      }`}
                                      title="Passthrough behavior"
                                    >
                                      {m.passthrough !== false ? 'PT:yes' : 'PT:no'}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2.5 font-bold text-white">{m.chain}</td>
                              <td className="p-2.5 text-slate-300">
                                {m.srcAddress || (m.srcAddressList ? `@${m.srcAddressList}` : '*')}
                              </td>
                              <td className="p-2.5 text-slate-300">
                                {m.dstAddress || (m.dstAddressList ? `@${m.dstAddressList}` : '*')}
                              </td>
                              <td className="p-2.5 text-cyan-300">{m.protocol || '*'}</td>
                              <td className="p-2.5 text-slate-300">{m.srcPort || '*'}</td>
                              <td className="p-2.5 text-slate-300">{m.dstPort || '*'}</td>
                              <td className="p-2.5 text-cyan-300">
                                {m.inInterface || (m.inInterfaceList ? `!list:${m.inInterfaceList}` : '*')}
                              </td>
                              <td className="p-2.5 text-cyan-300">
                                {m.outInterface || (m.outInterfaceList ? `!list:${m.outInterfaceList}` : '*')}
                              </td>
                              <td className="p-2.5 text-right text-emerald-300 font-semibold">
                                {(m.bytes || 0).toLocaleString()} B
                              </td>
                              <td className="p-2.5 text-right text-amber-300 font-semibold">
                                {(m.packets || 0).toLocaleString()}
                              </td>
                              <td className="p-2.5 text-slate-400 italic">
                                {m.comment || '-'}
                                {m.perConnectionClassifier && (
                                  <span className="ml-1.5 not-italic px-1 py-0.5 rounded bg-cyan-950/80 text-cyan-300 text-[10px]">
                                    PCC:{m.perConnectionClassifier}
                                  </span>
                                )}
                                {m.invalid && m.invalidReason && (
                                  <div className="text-[10px] text-rose-400 not-italic mt-0.5">
                                    ⚠ {m.invalidReason}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
                <span>
                  Flags: <strong className="text-rose-400">X</strong> - disabled,{' '}
                  <strong className="text-rose-400">I</strong> - invalid,{' '}
                  <strong className="text-cyan-400">D</strong> - dynamic | Chains evaluated in top-down order: prerouting → input / forward → output → postrouting
                </span>
                <span>Double-click any rule to open 4-Tab Winbox Mangle Editor</span>
              </div>
            </div>
          )}

          {/* VIEW 10C: FIREWALL ADDRESS LISTS (/ip firewall address-list) */}
          {activeMenu === 'ip-address-list' && (
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
              <div className="p-2.5 bg-slate-950 border-b border-slate-800 font-bold text-white flex items-center justify-between">
                <span>Firewall Address Lists ({(config.firewall.addressLists || []).length})</span>
                <span className="text-[10px] text-slate-400">
                  Used by Mangle src-address-list / dst-address-list & add-src/dst-to-address-list
                </span>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="p-2.5">Flags</th>
                    <th className="p-2.5">List Name</th>
                    <th className="p-2.5">Address / Subnet</th>
                    <th className="p-2.5">Timeout</th>
                    <th className="p-2.5">Comment</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(config.firewall.addressLists || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500 italic">
                        No address-list entries configured. Click "+ Add" above or let Mangle dynamically populate entries.
                      </td>
                    </tr>
                  ) : (
                    (config.firewall.addressLists || []).map((al) => (
                      <tr key={al.id} className="hover:bg-slate-800/50">
                        <td className="p-2.5 font-bold">
                          {al.disabled ? (
                            <span className="text-rose-400">X</span>
                          ) : al.dynamic ? (
                            <span className="text-cyan-400">D</span>
                          ) : (
                            <span className="text-emerald-400">✓</span>
                          )}
                        </td>
                        <td className="p-2.5 font-bold text-amber-300">{al.list}</td>
                        <td className="p-2.5 font-bold text-white">{al.address}</td>
                        <td className="p-2.5 text-slate-400">{al.timeout || 'static'}</td>
                        <td className="p-2.5 text-slate-400 italic">{al.comment || '-'}</td>
                        <td className="p-2.5 text-right font-sans">
                          <button
                            onClick={() =>
                              setPendingDelete({
                                type: 'addressList',
                                id: al.id,
                                label: `${al.list}: ${al.address}`,
                              })
                            }
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

          {/* VIEW 10D: FIREWALL CONNECTION TRACKING (/ip firewall connection) */}
          {activeMenu === 'ip-connections' && (
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
              <div className="p-2.5 bg-slate-950 border-b border-slate-800 font-bold text-white flex items-center justify-between">
                <span>Active Connection Tracking Table ({(config.connectionTracking || []).length})</span>
                <span className="text-[10px] text-emerald-400">
                  Populated dynamically during Ping/Traceroute & Mangle mark-connection evaluation
                </span>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="p-2.5">Protocol</th>
                    <th className="p-2.5">Src. Address</th>
                    <th className="p-2.5">Dst. Address</th>
                    <th className="p-2.5">Connection State</th>
                    <th className="p-2.5">Connection Mark</th>
                    <th className="p-2.5 text-right">Bytes</th>
                    <th className="p-2.5 text-right">Packets</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(config.connectionTracking || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                        No tracked connections yet. Run Ping or Traceroute from Tools or CLI to observe connection tracking and Mangle connection marks.
                      </td>
                    </tr>
                  ) : (
                    (config.connectionTracking || []).map((conn) => (
                      <tr key={conn.id} className="hover:bg-slate-800/50">
                        <td className="p-2.5 uppercase text-cyan-300 font-bold">{conn.protocol}</td>
                        <td className="p-2.5 text-white">{conn.srcAddress}</td>
                        <td className="p-2.5 text-white">{conn.dstAddress}</td>
                        <td className="p-2.5">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px]">
                            {conn.connectionState}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-purple-300">{conn.connectionMark || 'no-mark'}</td>
                        <td className="p-2.5 text-right text-slate-300">{conn.bytes.toLocaleString()} B</td>
                        <td className="p-2.5 text-right text-slate-300">{conn.packets}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 11: SIMPLE QUEUES & QUEUE TREE */}
          {activeMenu === 'queues' && (
            <div className="space-y-4">
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
                <div className="p-2.5 bg-slate-950 border-b border-slate-800 font-bold text-white flex items-center justify-between">
                  <span>Simple Queues ({config.queues.length})</span>
                  <span className="text-[10px] text-slate-400">Matches Target Subnet/IP & Mangle Packet Marks</span>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="p-2.5">Flags</th>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Target</th>
                      <th className="p-2.5">Packet Marks</th>
                      <th className="p-2.5">Max Limit (Up/Down)</th>
                      <th className="p-2.5">Priority</th>
                      <th className="p-2.5">Comment</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {config.queues.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-500 italic">
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
                          <td className="p-2.5 text-purple-300">{q.packetMarks || '*'}</td>
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
                                  packetMarks: q.packetMarks || '',
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

              {/* Queue Tree (/queue tree) */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/90 text-xs font-mono">
                <div className="p-2.5 bg-slate-950 border-b border-slate-800 font-bold text-white flex items-center justify-between">
                  <span>Queue Tree (/queue tree) — ({(config.queueTree || []).length})</span>
                  <span className="text-[10px] text-purple-300">HTB QoS Shaping driven by Mangle Packet Marks</span>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="p-2.5">Flags</th>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Parent</th>
                      <th className="p-2.5">Packet Mark</th>
                      <th className="p-2.5">Max Limit</th>
                      <th className="p-2.5">Priority</th>
                      <th className="p-2.5">Comment</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(config.queueTree || []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-5 text-center text-slate-500 italic">
                          No Queue Tree entries configured. Click "+ Add Queue Tree" above to shape traffic marked by Mangle (`mark-packet`).
                        </td>
                      </tr>
                    ) : (
                      (config.queueTree || []).map((qt) => (
                        <tr key={qt.id} className="hover:bg-slate-800/50">
                          <td className="p-2.5 font-bold">{qt.disabled ? <span className="text-rose-400">X</span> : <span className="text-emerald-400">✓</span>}</td>
                          <td className="p-2.5 font-bold text-white">{qt.name}</td>
                          <td className="p-2.5 text-cyan-300">{qt.parent}</td>
                          <td className="p-2.5 font-bold text-purple-300">{qt.packetMark || '*'}</td>
                          <td className="p-2.5 font-bold text-emerald-400">
                            {qt.maxLimitBps ? `${(qt.maxLimitBps / 1_000_000).toFixed(0)}M` : 'unlimited'}
                          </td>
                          <td className="p-2.5">{qt.priority || 8}</td>
                          <td className="p-2.5 text-slate-400 italic">{qt.comment || '-'}</td>
                          <td className="p-2.5 text-right font-sans">
                            <button
                              onClick={() => setPendingDelete({ type: 'queueTree', id: qt.id, label: `Queue Tree ${qt.name}` })}
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
        )}
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
                  <div className="grid grid-cols-2 gap-2">
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
                    <div>
                      <label className="text-slate-400 block mb-1">
                        {config.version === 'v7' ? 'Routing Table' : 'Routing Mark'}
                      </label>
                      <input
                        type="text"
                        placeholder="main"
                        value={routeForm.routingTable}
                        onChange={(e) => setRouteForm({ ...routeForm, routingTable: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
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
                  <div className="grid grid-cols-2 gap-2">
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
                    <div>
                      <label className="text-slate-400 block mb-1">Packet Marks (Mangle)</label>
                      <input
                        type="text"
                        placeholder="e.g. student_pkt"
                        value={queueForm.packetMarks}
                        onChange={(e) => setQueueForm({ ...queueForm, packetMarks: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
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
                  : addSubType === 'routingTable'
                  ? 'Add Routing Table (/routing table)'
                  : addSubType === 'queueTree'
                  ? 'Add Queue Tree (/queue tree)'
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

              {activeMenu === 'ip-routes' && addSubType === 'default' && (
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
                  <div className="grid grid-cols-2 gap-2">
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
                    <div>
                      <label className="text-slate-400 block mb-1">
                        {config.version === 'v7' ? 'Routing Table' : 'Routing Mark'}
                      </label>
                      <input
                        type="text"
                        placeholder="main"
                        value={routeForm.routingTable}
                        onChange={(e) => setRouteForm({ ...routeForm, routingTable: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>
                </>
              )}

              {activeMenu === 'ip-routes' && addSubType === 'routingTable' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">Routing Table Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. to_wan1 or to_isp2"
                      value={routingTableForm.name}
                      onChange={(e) => setRoutingTableForm({ ...routingTableForm, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="fibCheck"
                      checked={routingTableForm.fib}
                      onChange={(e) => setRoutingTableForm({ ...routingTableForm, fib: e.target.checked })}
                      className="rounded bg-slate-950 border-slate-800 text-cyan-600"
                    />
                    <label htmlFor="fibCheck" className="text-slate-300">Enable FIB (Forwarding Information Base)</label>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Comment</label>
                    <input
                      type="text"
                      placeholder="Policy Routing Table for WAN 1"
                      value={routingTableForm.comment}
                      onChange={(e) => setRoutingTableForm({ ...routingTableForm, comment: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white"
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

              {activeMenu === 'ip-address-list' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">Address List Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CIVITAS_LIST or BLOCKED_IPS"
                      value={addressListForm.list}
                      onChange={(e) => setAddressListForm({ ...addressListForm, list: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">IP Address or CIDR Subnet</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 10.10.20.0/24"
                      value={addressListForm.address}
                      onChange={(e) => setAddressListForm({ ...addressListForm, address: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Timeout (optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. 1d 00:00:00"
                        value={addressListForm.timeout}
                        onChange={(e) => setAddressListForm({ ...addressListForm, timeout: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Comment</label>
                      <input
                        type="text"
                        placeholder="Student Subnet"
                        value={addressListForm.comment}
                        onChange={(e) => setAddressListForm({ ...addressListForm, comment: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {activeMenu === 'queues' && addSubType === 'default' && (
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
                  <div className="grid grid-cols-2 gap-2">
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
                    <div>
                      <label className="text-slate-400 block mb-1">Packet Marks (Mangle)</label>
                      <input
                        type="text"
                        placeholder="e.g. student_pkt"
                        value={queueForm.packetMarks}
                        onChange={(e) => setQueueForm({ ...queueForm, packetMarks: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
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

              {activeMenu === 'queues' && addSubType === 'queueTree' && (
                <>
                  <div>
                    <label className="text-slate-400 block mb-1">Queue Tree Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. QT-Student-Down"
                      value={queueTreeForm.name}
                      onChange={(e) => setQueueTreeForm({ ...queueTreeForm, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Parent (Interface or global)</label>
                      <select
                        value={queueTreeForm.parent}
                        onChange={(e) => setQueueTreeForm({ ...queueTreeForm, parent: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      >
                        <option value="global">global</option>
                        {availableInterfaces.map((item) => (
                          <option key={item.name} value={item.name}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Packet Mark (from Mangle)</label>
                      <input
                        type="text"
                        placeholder="e.g. student_pkt"
                        value={queueTreeForm.packetMark}
                        onChange={(e) => setQueueTreeForm({ ...queueTreeForm, packetMark: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Max Limit (Mbps)</label>
                      <input
                        type="number"
                        min={1}
                        value={queueTreeForm.maxLimitMbps}
                        onChange={(e) => setQueueTreeForm({ ...queueTreeForm, maxLimitMbps: parseInt(e.target.value, 10) || 1 })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Priority (1-8)</label>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={queueTreeForm.priority}
                        onChange={(e) => setQueueTreeForm({ ...queueTreeForm, priority: parseInt(e.target.value, 10) || 8 })}
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

      {/* 6. WINBOX 4-TAB FIREWALL MANGLE ADD/EDIT MODAL */}
      {isMangleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Title Bar */}
            <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-white font-mono tracking-wide">
                  {mangleModalMode === 'add' ? 'New Firewall Mangle Rule' : `Firewall Mangle Rule <${selectedRowId}>`}
                </h4>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-cyan-300">
                  RouterOS {config.version}
                </span>
              </div>
              <button onClick={() => setIsMangleModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Winbox 4-Tab Header: GENERAL | ADVANCED | ACTION | EXTRA */}
            <div className="px-5 pt-2.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1">
                {(['general', 'advanced', 'action', 'extra'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setMangleModalTab(tab)}
                    className={`px-4 py-1.5 rounded-t-lg text-xs font-bold uppercase tracking-wider font-mono border-t border-x transition-colors ${
                      mangleModalTab === tab
                        ? 'bg-slate-900 text-cyan-300 border-slate-700'
                        : 'bg-slate-950/40 text-slate-400 border-transparent hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer pb-1.5 font-mono">
                <input
                  type="checkbox"
                  checked={!mangleForm.disabled}
                  onChange={(e) => setMangleForm({ ...mangleForm, disabled: !e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                />
                <span>Enabled</span>
              </label>
            </div>

            {formError && (
              <div className="mx-5 mt-3 p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleMangleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* TAB 1: GENERAL */}
              {mangleModalTab === 'general' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1 font-semibold">Chain</label>
                      <select
                        value={mangleForm.chain}
                        onChange={(e) => setMangleForm({ ...mangleForm, chain: e.target.value as MangleChain })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      >
                        <option value="prerouting">prerouting</option>
                        <option value="input">input</option>
                        <option value="forward">forward</option>
                        <option value="output">output</option>
                        <option value="postrouting">postrouting</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 font-semibold">Protocol</label>
                      <select
                        value={mangleForm.protocol}
                        onChange={(e) => setMangleForm({ ...mangleForm, protocol: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      >
                        <option value="">any (all)</option>
                        <option value="tcp">6 (tcp)</option>
                        <option value="udp">17 (udp)</option>
                        <option value="icmp">1 (icmp)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Src. Address (IP / CIDR / !IP)</label>
                      <input
                        type="text"
                        placeholder="e.g. 192.168.10.0/24 or !10.0.0.1"
                        value={mangleForm.srcAddress}
                        onChange={(e) => setMangleForm({ ...mangleForm, srcAddress: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Dst. Address (IP / CIDR / !IP)</label>
                      <input
                        type="text"
                        placeholder="e.g. 8.8.8.8 or !192.168.0.0/16"
                        value={mangleForm.dstAddress}
                        onChange={(e) => setMangleForm({ ...mangleForm, dstAddress: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Src. Port (TCP/UDP)</label>
                      <input
                        type="text"
                        placeholder="e.g. 80,443 or 1024-65535"
                        value={mangleForm.srcPort}
                        onChange={(e) => setMangleForm({ ...mangleForm, srcPort: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Dst. Port (TCP/UDP)</label>
                      <input
                        type="text"
                        placeholder="e.g. 80,443,8080"
                        value={mangleForm.dstPort}
                        onChange={(e) => setMangleForm({ ...mangleForm, dstPort: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">
                        In. Interface
                        {['output', 'postrouting'].includes(mangleForm.chain) && (
                          <span className="ml-1 text-[10px] text-amber-400">(N/A in {mangleForm.chain})</span>
                        )}
                      </label>
                      <select
                        disabled={['output', 'postrouting'].includes(mangleForm.chain)}
                        value={mangleForm.inInterface}
                        onChange={(e) => setMangleForm({ ...mangleForm, inInterface: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono disabled:opacity-40"
                      >
                        <option value="">* (any)</option>
                        {availableInterfaces.map((item) => (
                          <option key={item.name} value={item.name}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">
                        Out. Interface
                        {['prerouting', 'input'].includes(mangleForm.chain) && (
                          <span className="ml-1 text-[10px] text-amber-400">(N/A in {mangleForm.chain})</span>
                        )}
                      </label>
                      <select
                        disabled={['prerouting', 'input'].includes(mangleForm.chain)}
                        value={mangleForm.outInterface}
                        onChange={(e) => setMangleForm({ ...mangleForm, outInterface: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono disabled:opacity-40"
                      >
                        <option value="">* (any)</option>
                        {availableInterfaces.map((item) => (
                          <option key={item.name} value={item.name}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">In. Interface List</label>
                      <select
                        disabled={['output', 'postrouting'].includes(mangleForm.chain)}
                        value={mangleForm.inInterfaceList}
                        onChange={(e) => setMangleForm({ ...mangleForm, inInterfaceList: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono disabled:opacity-40"
                      >
                        <option value="">none</option>
                        {(config.interfaceLists || []).map((il) => (
                          <option key={il.id} value={il.name}>
                            {il.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Out. Interface List</label>
                      <select
                        disabled={['prerouting', 'input'].includes(mangleForm.chain)}
                        value={mangleForm.outInterfaceList}
                        onChange={(e) => setMangleForm({ ...mangleForm, outInterfaceList: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono disabled:opacity-40"
                      >
                        <option value="">none</option>
                        {(config.interfaceLists || []).map((il) => (
                          <option key={il.id} value={il.name}>
                            {il.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ADVANCED */}
              {mangleModalTab === 'advanced' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Src. Address List</label>
                      <input
                        type="text"
                        placeholder="e.g. CIVITAS_LIST or STUDENT_SUBNET"
                        value={mangleForm.srcAddressList}
                        onChange={(e) => setMangleForm({ ...mangleForm, srcAddressList: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Dst. Address List</label>
                      <input
                        type="text"
                        placeholder="e.g. LOCAL_NETS or YOUTUBE_SERVERS"
                        value={mangleForm.dstAddressList}
                        onChange={(e) => setMangleForm({ ...mangleForm, dstAddressList: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Connection State</label>
                      <select
                        value={mangleForm.connectionState}
                        onChange={(e) => setMangleForm({ ...mangleForm, connectionState: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      >
                        <option value="">any</option>
                        <option value="new">new</option>
                        <option value="established">established</option>
                        <option value="related">related</option>
                        <option value="established,related">established,related</option>
                        <option value="invalid">invalid</option>
                        <option value="untracked">untracked</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Connection Mark (Match)</label>
                      <input
                        type="text"
                        placeholder="e.g. no-mark, wan1_conn, student_conn"
                        value={mangleForm.connectionMark}
                        onChange={(e) => setMangleForm({ ...mangleForm, connectionMark: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Packet Mark (Match)</label>
                      <input
                        type="text"
                        placeholder="e.g. no-mark, voip_pkt"
                        value={mangleForm.packetMark}
                        onChange={(e) => setMangleForm({ ...mangleForm, packetMark: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Routing Mark (Match)</label>
                      <input
                        type="text"
                        placeholder="e.g. to_wan1"
                        value={mangleForm.routingMark}
                        onChange={(e) => setMangleForm({ ...mangleForm, routingMark: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Packet Size / Length</label>
                      <input
                        type="text"
                        placeholder="e.g. 0-500 or 64-1500"
                        value={mangleForm.packetSize}
                        onChange={(e) => setMangleForm({ ...mangleForm, packetSize: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">DSCP (TOS) Match (0-63)</label>
                      <input
                        type="number"
                        min={0}
                        max={63}
                        placeholder="e.g. 46 (EF)"
                        value={mangleForm.dscp}
                        onChange={(e) => setMangleForm({ ...mangleForm, dscp: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Priority (802.1p)</label>
                      <input
                        type="text"
                        placeholder="e.g. 0-7"
                        value={mangleForm.priority}
                        onChange={(e) => setMangleForm({ ...mangleForm, priority: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                    <label className="text-cyan-300 font-semibold block">
                      Per Connection Classifier (PCC) — Multi-WAN Load Balancing
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. both-addresses-and-ports:2/0 or src-address:2/1"
                      value={mangleForm.perConnectionClassifier}
                      onChange={(e) => setMangleForm({ ...mangleForm, perConnectionClassifier: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white font-mono"
                    />
                    <p className="text-[10px] text-slate-400">
                      Format: <code className="text-cyan-300">classifier:denominator/remainder</code> (e.g.{' '}
                      <code>both-addresses:2/0</code> for WAN1, <code>both-addresses:2/1</code> for WAN2).
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: ACTION */}
              {mangleModalTab === 'action' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Action</label>
                    <select
                      value={mangleForm.action}
                      onChange={(e) => setMangleForm({ ...mangleForm, action: e.target.value as MangleAction })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white font-mono font-bold"
                    >
                      <option value="mark-connection">mark-connection</option>
                      <option value="mark-packet">mark-packet</option>
                      <option value="mark-routing">mark-routing</option>
                      <option value="accept">accept</option>
                      <option value="passthrough">passthrough</option>
                      <option value="return">return</option>
                      <option value="add-src-to-address-list">add-src-to-address-list</option>
                      <option value="add-dst-to-address-list">add-dst-to-address-list</option>
                      <option value="change-dscp">change-dscp</option>
                      <option value="change-mss">change-mss</option>
                      <option value="change-ttl">change-ttl</option>
                      <option value="log">log</option>
                    </select>
                  </div>

                  {/* Dynamic fields based on selected Action */}
                  {mangleForm.action === 'mark-connection' && (
                    <div className="p-3.5 rounded-lg bg-slate-950 border border-purple-800/50 space-y-3">
                      <div>
                        <label className="text-purple-300 font-semibold block mb-1">New Connection Mark</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. wan1_conn or student_conn"
                          value={mangleForm.newConnectionMark}
                          onChange={(e) => setMangleForm({ ...mangleForm, newConnectionMark: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white font-mono"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                        <input
                          type="checkbox"
                          checked={mangleForm.passthrough}
                          onChange={(e) => setMangleForm({ ...mangleForm, passthrough: e.target.checked })}
                          className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                        />
                        <span>
                          <strong>Passthrough</strong> (Continue evaluating subsequent Mangle rules in the same chain)
                        </span>
                      </label>
                    </div>
                  )}

                  {mangleForm.action === 'mark-packet' && (
                    <div className="p-3.5 rounded-lg bg-slate-950 border border-purple-800/50 space-y-3">
                      <div>
                        <label className="text-purple-300 font-semibold block mb-1">New Packet Mark</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. student_pkt, voip_pkt, critical_pkt"
                          value={mangleForm.newPacketMark}
                          onChange={(e) => setMangleForm({ ...mangleForm, newPacketMark: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white font-mono"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                        <input
                          type="checkbox"
                          checked={mangleForm.passthrough}
                          onChange={(e) => setMangleForm({ ...mangleForm, passthrough: e.target.checked })}
                          className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                        />
                        <span>
                          <strong>Passthrough</strong> (Uncheck to stop evaluating further rules once packet is marked)
                        </span>
                      </label>
                    </div>
                  )}

                  {mangleForm.action === 'mark-routing' && (
                    <div className="p-3.5 rounded-lg bg-slate-950 border border-purple-800/50 space-y-3">
                      <div>
                        <label className="text-purple-300 font-semibold block mb-1">
                          New Routing Mark {config.version === 'v7' && '(Must match /routing table in RouterOS v7)'}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. to_wan1 or to_wan2"
                          value={mangleForm.newRoutingMark}
                          onChange={(e) => setMangleForm({ ...mangleForm, newRoutingMark: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white font-mono"
                        />
                        {config.version === 'v7' && (
                          <p className="text-[10px] text-amber-300 mt-1">
                            Available v7 Routing Tables:{' '}
                            {(config.routingTables || []).map((rt) => rt.name).join(', ') || 'main'}
                          </p>
                        )}
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                        <input
                          type="checkbox"
                          checked={mangleForm.passthrough}
                          onChange={(e) => setMangleForm({ ...mangleForm, passthrough: e.target.checked })}
                          className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                        />
                        <span>
                          <strong>Passthrough</strong> (Typically disabled after final routing mark assignment)
                        </span>
                      </label>
                    </div>
                  )}

                  {(mangleForm.action === 'add-src-to-address-list' ||
                    mangleForm.action === 'add-dst-to-address-list') && (
                    <div className="p-3.5 rounded-lg bg-slate-950 border border-cyan-800/50 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-cyan-300 font-semibold block mb-1">Address List Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. ACTIVE_STUDENTS"
                          value={mangleForm.addressList}
                          onChange={(e) => setMangleForm({ ...mangleForm, addressList: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Address List Timeout</label>
                        <input
                          type="text"
                          placeholder="e.g. 01:00:00 or none-dynamic"
                          value={mangleForm.addressListTimeout}
                          onChange={(e) => setMangleForm({ ...mangleForm, addressListTimeout: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {mangleForm.action === 'change-dscp' && (
                    <div className="p-3.5 rounded-lg bg-slate-950 border border-cyan-800/50">
                      <label className="text-cyan-300 font-semibold block mb-1">New DSCP (0-63)</label>
                      <input
                        type="number"
                        required
                        min={0}
                        max={63}
                        placeholder="46"
                        value={mangleForm.newDscp}
                        onChange={(e) => setMangleForm({ ...mangleForm, newDscp: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  )}

                  {mangleForm.action === 'change-mss' && (
                    <div className="p-3.5 rounded-lg bg-slate-950 border border-cyan-800/50">
                      <label className="text-cyan-300 font-semibold block mb-1">New TCP MSS</label>
                      <input
                        type="text"
                        required
                        placeholder="clamp-to-pmtu or 1440"
                        value={mangleForm.newMss}
                        onChange={(e) => setMangleForm({ ...mangleForm, newMss: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  )}

                  {mangleForm.action === 'change-ttl' && (
                    <div className="p-3.5 rounded-lg bg-slate-950 border border-cyan-800/50">
                      <label className="text-cyan-300 font-semibold block mb-1">New TTL</label>
                      <input
                        type="text"
                        required
                        placeholder="set:64 or increment:1"
                        value={mangleForm.newTtl}
                        onChange={(e) => setMangleForm({ ...mangleForm, newTtl: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  )}

                  {/* Log option available on all actions */}
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={mangleForm.log || mangleForm.action === 'log'}
                        onChange={(e) => setMangleForm({ ...mangleForm, log: e.target.checked })}
                        className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                      />
                      <span>Log matched packets to RouterOS Log</span>
                    </label>
                    <div>
                      <input
                        type="text"
                        placeholder="Log Prefix (e.g. MANGLE-HIT)"
                        value={mangleForm.logPrefix}
                        onChange={(e) => setMangleForm({ ...mangleForm, logPrefix: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: EXTRA */}
              {mangleModalTab === 'extra' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Limit (Rate / Burst)</label>
                      <input
                        type="text"
                        placeholder="e.g. 50/5s,2:packet"
                        value={mangleForm.limit}
                        onChange={(e) => setMangleForm({ ...mangleForm, limit: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Time Matcher</label>
                      <input
                        type="text"
                        placeholder="e.g. 08:00:00-17:00:00,mon,tue,wed,thu,fri"
                        value={mangleForm.time}
                        onChange={(e) => setMangleForm({ ...mangleForm, time: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Connection Bytes</label>
                      <input
                        type="text"
                        placeholder="e.g. 500000-0 (Heavy Download > 500KB)"
                        value={mangleForm.connectionBytes}
                        onChange={(e) => setMangleForm({ ...mangleForm, connectionBytes: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Connection Rate</label>
                      <input
                        type="text"
                        placeholder="e.g. 2M-100M"
                        value={mangleForm.connectionRate}
                        onChange={(e) => setMangleForm({ ...mangleForm, connectionRate: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Version-Aware Layer-7 Protocol Matcher (RouterOS v6 only; deprecated/removed in v7+) */}
                  {config.version === 'v6' ? (
                    <div>
                      <label className="text-slate-400 block mb-1">
                        Layer7 Protocol (RouterOS v6 Matcher)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. youtube-regex or bittorrent"
                        value={mangleForm.layer7Protocol}
                        onChange={(e) => setMangleForm({ ...mangleForm, layer7Protocol: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  ) : (
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono">
                      Note: <span className="text-amber-300">layer7-protocol</span> is hidden on RouterOS v7 devices (use TLS Host / Address Lists in v7).
                    </div>
                  )}
                </div>
              )}

              {/* Comment (Always visible at bottom of form) */}
              <div className="pt-2 border-t border-slate-800">
                <label className="text-slate-400 block mb-1 font-semibold">Rule Comment</label>
                <input
                  type="text"
                  placeholder="e.g. Mark Civitas Traffic -> ISP1 or PCC Load Balance WAN1"
                  value={mangleForm.comment}
                  onChange={(e) => setMangleForm({ ...mangleForm, comment: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMangleModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-sm"
                >
                  {mangleModalMode === 'add' ? 'Add Mangle Rule' : 'Apply Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
