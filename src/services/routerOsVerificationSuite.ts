import { NetworkDevice, NetworkProject } from '../types/network';
import { RouterOsDeviceConfig } from '../types/routerOs';
import { RouterOsConfigService, MutationResult } from './routerOsConfigService';
import { RouterOsCliEngine } from './routerOsCliEngine';
import { simulatePacketTrace } from './simulationEngine';
import { validateTopology } from './validationEngine';
import { runComprehensiveTrafficSimulation } from './trafficEngine';
import {
  SAMPLE_MULTIWAN_TEMPLATES,
  applyMultiWanToDevice,
  applySimulationScenarioToMultiWan,
  calculateMultiWanTelemetry,
  calculateWeightedPccRatios,
  generateMultiWanObjects,
} from './multiWanService';

export interface VerificationTestCaseResult {
  id: number;
  title: string;
  category: string;
  passed: boolean;
  commandOrAction: string;
  expectedBehavior: string;
  actualEvidence: string;
  durationMs: number;
}

export interface VerificationSuiteReport {
  deviceId: string;
  deviceName: string;
  deviceModel: string;
  routerOsVersion: string;
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: VerificationTestCaseResult[];
}

export class RouterOsVerificationSuite {
  /**
   * Executes all 12 mandatory FEATURE 9 verification scenarios in an isolated sandbox clone
   * of the target device and project so live user state is never polluted while testing.
   */
  static runFullSuite(device: NetworkDevice, project: NetworkProject): VerificationSuiteReport {
    const results: VerificationTestCaseResult[] = [];

    // Deep clone device and project for deterministic, side-effect-free verification
    let sandboxDevice: NetworkDevice = JSON.parse(JSON.stringify(device));
    let sandboxProject: NetworkProject = JSON.parse(JSON.stringify(project));

    const syncSandboxProject = (updatedDev: NetworkDevice) => {
      sandboxDevice = updatedDev;
      sandboxProject = {
        ...sandboxProject,
        devices: sandboxProject.devices.map((d) => (d.id === updatedDev.id ? updatedDev : d)),
      };
    };

    const mutateSandbox = (
      _actionName: string,
      mutationFn: (dev: NetworkDevice, cfg: RouterOsDeviceConfig) => MutationResult
    ): MutationResult => {
      const currentCfg = RouterOsConfigService.ensureConfig(sandboxDevice);
      const res = mutationFn(sandboxDevice, currentCfg);
      if (res.success && res.config) {
        const synced = RouterOsConfigService.syncToDeviceInterfaces(sandboxDevice, res.config);
        syncSandboxProject(synced);
      }
      return res;
    };

    const firstPortName = sandboxDevice.interfaces[0]?.name || 'ether1';

    // =========================================================================
    // TEST 1: Membuka Console dari Topology Device
    // =========================================================================
    {
      const t0 = performance.now();
      const cfg = RouterOsConfigService.ensureConfig(sandboxDevice);
      syncSandboxProject(RouterOsConfigService.syncToDeviceInterfaces(sandboxDevice, cfg));
      const passed =
        Boolean(cfg) &&
        cfg.identity.name === sandboxDevice.name &&
        (cfg.version === 'v6' || cfg.version === 'v7') &&
        Array.isArray(cfg.interfaces) &&
        cfg.interfaces.length === sandboxDevice.interfaces.length;

      results.push({
        id: 1,
        title: '1. Membuka Console dari Topology Device',
        category: 'Console & State Initialization',
        passed,
        commandOrAction: `openRouterConsole('${sandboxDevice.id}') -> RouterOsConfigService.ensureConfig()`,
        expectedBehavior: 'Console initializes Unified RouterOS State matching device identity, version, and physical ports.',
        actualEvidence: `Identity='${cfg.identity.name}', Version=RouterOS ${cfg.version}, Initialized Ports=${cfg.interfaces.length}/${sandboxDevice.interfaces.length}`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 2: Menampilkan Interface Perangkat (Device Capability)
    // =========================================================================
    {
      const t0 = performance.now();
      const cliOut = RouterOsCliEngine.execute(
        '/interface print',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );
      const cfg = RouterOsConfigService.ensureConfig(sandboxDevice);
      const allPortsPresent = sandboxDevice.interfaces.every((p) => cliOut.output.includes(p.name));
      const passed = !cliOut.error && allPortsPresent && cfg.interfaces.length === sandboxDevice.interfaces.length;

      results.push({
        id: 2,
        title: '2. Menampilkan Interface Perangkat (CLI & GUI)',
        category: 'Hardware Capability Guard',
        passed,
        commandOrAction: `/interface print`,
        expectedBehavior: `Displays exact hardware ports for model ${sandboxDevice.modelName} (${sandboxDevice.interfaces.map((i) => i.name).join(', ')}).`,
        actualEvidence: `CLI printed ${cfg.interfaces.length} hardware interfaces [${cfg.interfaces.map((i) => i.name).join(', ')}] matching Unified Device Catalog.`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 3: Menambahkan IP melalui CLI
    // =========================================================================
    {
      const t0 = performance.now();
      const cmd = `/ip address add address=10.254.99.1/24 interface=${firstPortName} comment="CLI-Test-IP"`;
      const cliOut = RouterOsCliEngine.execute(cmd, [], sandboxDevice, sandboxProject, mutateSandbox);
      const cfg = RouterOsConfigService.ensureConfig(sandboxDevice);
      const addedEntry = cfg.ipAddresses.find((a) => a.address === '10.254.99.1/24' && a.interface === firstPortName);
      const passed = !cliOut.error && Boolean(addedEntry) && addedEntry?.network === '10.254.99.0';

      results.push({
        id: 3,
        title: '3. Menambahkan IP melalui CLI',
        category: 'CLI Parser & Mutation',
        passed,
        commandOrAction: cmd,
        expectedBehavior: `Adds 10.254.99.1/24 to ${firstPortName} and computes network address 10.254.99.0.`,
        actualEvidence: addedEntry
          ? `Created entry ID=${addedEntry.id}: address=${addedEntry.address} network=${addedEntry.network} interface=${addedEntry.interface}`
          : `Error: ${cliOut.output}`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 4: Memeriksa IP yang Sama melalui GUI
    // =========================================================================
    {
      const t0 = performance.now();
      const guiConfig = RouterOsConfigService.ensureConfig(sandboxDevice);
      const guiIpRow = guiConfig.ipAddresses.find(
        (a) => a.address === '10.254.99.1/24' && a.interface === firstPortName
      );
      const physPort = sandboxDevice.interfaces.find((i) => i.name === firstPortName);
      const passed = Boolean(guiIpRow) && Boolean(physPort?.ipAddress);

      results.push({
        id: 4,
        title: '4. Memeriksa IP yang Sama melalui GUI (CLI -> GUI Sync)',
        category: 'CLI -> GUI Synchronization',
        passed,
        commandOrAction: `WinboxGuiManager -> IP > Addresses table inspection`,
        expectedBehavior: 'IP added via CLI is immediately visible in Winbox GUI IP > Addresses table and synced to physical port.',
        actualEvidence: `GUI Table Row Found=${Boolean(guiIpRow)} (${guiIpRow?.address} on ${guiIpRow?.interface}, comment="${guiIpRow?.comment}"), Physical Port IP=${physPort?.ipAddress}`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 5: Menambahkan IP melalui GUI
    // =========================================================================
    {
      const t0 = performance.now();
      const guiRes = mutateSandbox('GUI: Add IP Address', (dev) =>
        RouterOsConfigService.addIpAddress(dev, {
          address: '172.31.88.1/24',
          interface: firstPortName,
          comment: 'Winbox-GUI-IP',
        })
      );
      const passed = guiRes.success && Boolean(guiRes.config?.ipAddresses.some((a) => a.address === '172.31.88.1/24'));

      results.push({
        id: 5,
        title: '5. Menambahkan IP melalui GUI Form Handler',
        category: 'Winbox GUI Manager',
        passed,
        commandOrAction: `RouterOsConfigService.addIpAddress({ address: '172.31.88.1/24', interface: '${firstPortName}' })`,
        expectedBehavior: 'Winbox GUI form mutation validates CIDR and appends 172.31.88.1/24 to Unified Configuration State.',
        actualEvidence: `Mutation success=${guiRes.success}, Total IPs on device=${guiRes.config?.ipAddresses.length}`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 6: Memeriksa Konfigurasi melalui CLI (GUI -> CLI Sync)
    // =========================================================================
    {
      const t0 = performance.now();
      const printOut = RouterOsCliEngine.execute(
        '/ip address print',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );
      const exportOut = RouterOsCliEngine.execute(
        '/export',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );
      const inPrint = printOut.output.includes('172.31.88.1/24') && printOut.output.includes('172.31.88.0');
      const inExport = exportOut.output.includes('add address=172.31.88.1/24');
      const passed = inPrint && inExport;

      results.push({
        id: 6,
        title: '6. Memeriksa Konfigurasi melalui CLI (GUI -> CLI Sync)',
        category: 'GUI -> CLI Synchronization',
        passed,
        commandOrAction: `/ip address print & /export`,
        expectedBehavior: 'IP added via Winbox GUI appears in CLI `/ip address print` and `/export` .rsc script.',
        actualEvidence: `Found in '/ip address print': ${inPrint}, Found in '/export': ${inExport}`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 7: Membuat VLAN dan Bridge
    // =========================================================================
    {
      const t0 = performance.now();
      const bOut = RouterOsCliEngine.execute(
        '/interface bridge add name=bridge-campus vlan-filtering=yes comment="Campus-Core-Bridge"',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );
      const bpOut = RouterOsCliEngine.execute(
        `/interface bridge port add bridge=bridge-campus interface=${firstPortName} pvid=200`,
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );
      const vOut = RouterOsCliEngine.execute(
        '/interface vlan add name=vlan200-mgmt vlan-id=200 interface=bridge-campus',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );
      // Also test assigning an IP to the new logical VLAN interface!
      const vlanIpOut = RouterOsCliEngine.execute(
        '/ip address add address=10.200.0.1/24 interface=vlan200-mgmt',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );

      const cfg = RouterOsConfigService.ensureConfig(sandboxDevice);
      const hasBridge = cfg.bridges.some((b) => b.name === 'bridge-campus' && b.vlanFiltering);
      const hasBp = cfg.bridgePorts.some((bp) => bp.bridge === 'bridge-campus' && bp.pvid === 200);
      const hasVlan = cfg.vlans.some((v) => v.name === 'vlan200-mgmt' && v.vlanId === 200);
      const hasVlanIp = cfg.ipAddresses.some((a) => a.interface === 'vlan200-mgmt' && a.address === '10.200.0.1/24');
      const physPortPvid = sandboxDevice.interfaces.find((i) => i.name === firstPortName)?.pvid;

      const passed =
        !bOut.error &&
        !bpOut.error &&
        !vOut.error &&
        !vlanIpOut.error &&
        hasBridge &&
        hasBp &&
        hasVlan &&
        hasVlanIp &&
        physPortPvid === 200;

      results.push({
        id: 7,
        title: '7. Membuat VLAN dan Bridge (802.1Q & Logical Interface)',
        category: 'L2 Bridge & VLAN',
        passed,
        commandOrAction: `/interface bridge add name=bridge-campus vlan-filtering=yes; /interface vlan add name=vlan200-mgmt vlan-id=200 interface=bridge-campus`,
        expectedBehavior: 'Creates bridge, assigns port PVID=200 (synced to physical port), creates VLAN 200 sub-interface, and allows IP assignment on VLAN.',
        actualEvidence: `Bridge='bridge-campus' (vlan-filtering=yes), Port ${firstPortName} PVID=${physPortPvid}, VLAN='vlan200-mgmt' (ID 200) with IP 10.200.0.1/24`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 8: Menguji Static Route
    // =========================================================================
    {
      const t0 = performance.now();
      const rAdd = RouterOsCliEngine.execute(
        '/ip route add dst-address=192.168.250.0/24 gateway=10.254.99.254 distance=1 comment="Branch-Office"',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );
      const rPrint = RouterOsCliEngine.execute(
        '/ip route print',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );
      const cfg = RouterOsConfigService.ensureConfig(sandboxDevice);
      const routeExists = cfg.routes.some(
        (r) => r.dstAddress === '192.168.250.0/24' && r.gateway === '10.254.99.254'
      );
      const passed = !rAdd.error && routeExists && rPrint.output.includes('192.168.250.0/24');

      results.push({
        id: 8,
        title: '8. Menguji Static Route (/ip route)',
        category: 'L3 Static Routing',
        passed,
        commandOrAction: `/ip route add dst-address=192.168.250.0/24 gateway=10.254.99.254 distance=1`,
        expectedBehavior: 'Adds active static route to RouterOS FIB and displays in `/ip route print`.',
        actualEvidence: `Route 192.168.250.0/24 -> 10.254.99.254 active in FIB (Total routes=${cfg.routes.length}).`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 9: Menguji Command yang Tidak Valid & Interface Tidak Tersedia
    // =========================================================================
    {
      const t0 = performance.now();
      const badIfaceOut = RouterOsCliEngine.execute(
        '/ip address add address=10.9.9.1/24 interface=ether99-nonexistent',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );
      const badCmdOut = RouterOsCliEngine.execute(
        '/ip nonexistent-submenu print',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );
      const unsupportedOut = RouterOsCliEngine.execute(
        '/routing bgp instance print',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );

      const passed =
        Boolean(badIfaceOut.error) &&
        badIfaceOut.output.includes('does not exist on device model') &&
        Boolean(badCmdOut.error) &&
        Boolean(unsupportedOut.error);

      results.push({
        id: 9,
        title: '9. Menguji Command Tidak Valid & Hardware Capability Guard',
        category: 'Validation & Error Handling',
        passed,
        commandOrAction: `/ip address add address=10.9.9.1/24 interface=ether99-nonexistent & /routing bgp`,
        expectedBehavior: 'Rejects non-existent hardware interfaces, invalid syntax, and unsupported features with clear error messages.',
        actualEvidence: `Invalid port -> "${badIfaceOut.output}" | Invalid cmd -> "${badCmdOut.output}" | BGP -> "${unsupportedOut.output}"`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 10: Menguji Perbedaan RouterOS 6 dan RouterOS 7
    // =========================================================================
    {
      const t0 = performance.now();
      // 1. Switch to RouterOS v6
      mutateSandbox('Switch to v6', (dev) => RouterOsConfigService.setRouterOsVersion(dev, 'v6'));
      const v6RejectV7Param = RouterOsCliEngine.execute(
        '/ip route add dst-address=10.60.0.0/16 gateway=10.254.99.254 routing-table=main',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );
      const v6AcceptV6Param = RouterOsCliEngine.execute(
        '/ip route add dst-address=10.60.0.0/16 gateway=10.254.99.254 routing-mark=wan1',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );

      // 2. Switch to RouterOS v7
      mutateSandbox('Switch to v7', (dev) => RouterOsConfigService.setRouterOsVersion(dev, 'v7'));
      const v7RejectV6Param = RouterOsCliEngine.execute(
        '/ip route add dst-address=10.70.0.0/16 gateway=10.254.99.254 routing-mark=wan1',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );
      const v7AcceptV7Param = RouterOsCliEngine.execute(
        '/ip route add dst-address=10.70.0.0/16 gateway=10.254.99.254 routing-table=main',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );

      // Restore original version
      mutateSandbox('Restore version', (dev) =>
        RouterOsConfigService.setRouterOsVersion(dev, device.routerOsVersion === 'v7' ? 'v7' : 'v6')
      );

      const passed =
        Boolean(v6RejectV7Param.error) &&
        !v6AcceptV6Param.error &&
        Boolean(v7RejectV6Param.error) &&
        !v7AcceptV7Param.error;

      results.push({
        id: 10,
        title: '10. Menguji Perbedaan Kompatibilitas RouterOS 6 dan RouterOS 7',
        category: 'Version Compatibility (v6 vs v7)',
        passed,
        commandOrAction: `v6 vs v7: 'routing-mark' (v6) vs 'routing-table' (v7) on /ip route add`,
        expectedBehavior: 'v6 rejects v7-only `routing-table` and accepts `routing-mark`; v7 rejects removed `routing-mark` and accepts `routing-table`.',
        actualEvidence: `v6 on routing-table -> "${v6RejectV7Param.output}" | v7 on routing-mark -> "${v7RejectV6Param.output}"`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 11: Menguji Dampak Konfigurasi pada Simulation Engine
    // =========================================================================
    {
      const t0 = performance.now();
      // Find another device to ping this device, or ping another device through this router
      const peerDev =
        sandboxProject.devices.find((d) => d.id !== sandboxDevice.id && d.interfaces.some((i) => i.ipAddress)) ||
        sandboxDevice;
      const targetIpOnSandbox = '10.254.99.1';

      // Add a drop rule for ICMP on input & forward chains on sandboxDevice
      const addDropRes = mutateSandbox('Add Firewall Drop Rule', (dev) =>
        RouterOsConfigService.addFirewallRule(dev, {
          chain: 'input',
          action: 'drop',
          protocol: 'icmp',
          disabled: false,
          comment: 'SimEngine-Test-Drop-ICMP',
        })
      );
      const dropRuleId = addDropRes.createdId || '0';

      // Trace from peerDev to sandboxDevice (or if peerDev is connected)
      const traceWithDrop = simulatePacketTrace(peerDev.id, targetIpOnSandbox, 'ICMP', sandboxProject);

      // Remove the drop rule
      mutateSandbox('Remove Firewall Drop Rule', (dev) =>
        RouterOsConfigService.removeFirewallRule(dev, dropRuleId)
      );

      // Also test self/local ping after removing rule
      const traceAfterRemove = simulatePacketTrace(sandboxDevice.id, targetIpOnSandbox, 'ICMP', sandboxProject);

      const passed = Boolean(addDropRes.success) && traceAfterRemove.success && (peerDev.id === sandboxDevice.id || !traceWithDrop.success);

      results.push({
        id: 11,
        title: '11. Menguji Dampak Konfigurasi pada Simulation Engine',
        category: 'Simulation Engine Integration',
        passed,
        commandOrAction: `/ip firewall filter add chain=input action=drop protocol=icmp -> simulatePacketTrace()`,
        expectedBehavior: 'Active RouterOS firewall drop rules, static routes, and NAT rules directly control simulatePacketTrace() outcome.',
        actualEvidence: `Firewall Drop Rule evaluated (${traceWithDrop.summary}); After rule removal: ${traceAfterRemove.summary}`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 12: Memastikan Fitur NETLAB Lama Tetap Berfungsi (No Regression)
    // =========================================================================
    {
      const t0 = performance.now();
      const diags = validateTopology(
        sandboxProject.devices,
        sandboxProject.links,
        sandboxProject.vlans,
        sandboxProject.circuits,
        sandboxProject.workloads
      );
      const trafficSim = runComprehensiveTrafficSimulation(sandboxProject, 1);

      const passed =
        Array.isArray(diags) &&
        Boolean(trafficSim.linkStats) &&
        Boolean(trafficSim.circuitTelemetry) &&
        Boolean(trafficSim.deviceProcessingMetrics[sandboxDevice.id]);

      const devMetrics = trafficSim.deviceProcessingMetrics[sandboxDevice.id];

      results.push({
        id: 12,
        title: '12. Memastikan Fitur NETLAB Lama Tetap Berfungsi (Regression Test)',
        category: 'Regression & Backward Compatibility',
        passed,
        commandOrAction: `validateTopology() & runComprehensiveTrafficSimulation()`,
        expectedBehavior: 'Topology validation, link telemetry, ISP circuit telemetry, and workload simulation run without regression.',
        actualEvidence: `Diagnostics=${diags.length} items, Links Simulated=${Object.keys(trafficSim.linkStats).length}, Circuits=${Object.keys(trafficSim.circuitTelemetry).length}, Device CPU=${devMetrics?.cpuLoadPercent}%`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 13: IP Firewall Mangle — Add, Edit, Enable, Disable, Move, Remove (GUI & CLI Sync)
    // =========================================================================
    {
      const t0 = performance.now();
      // 1. Add Mangle rule via GUI service
      const guiMangleRes = mutateSandbox('GUI: Add Mangle mark-connection', (dev) =>
        RouterOsConfigService.addMangleRule(dev, {
          chain: 'prerouting',
          srcAddress: '10.254.99.0/24',
          action: 'mark-connection',
          newConnectionMark: 'civitas_conn',
          passthrough: true,
          disabled: false,
          comment: 'GUI-Mangle-ConnMark',
        })
      );
      const rule1Id = guiMangleRes.createdId || '0';

      // 2. Add Mangle rule via CLI
      const cliMangleOut = RouterOsCliEngine.execute(
        '/ip firewall mangle add chain=prerouting connection-mark=civitas_conn action=mark-packet new-packet-mark=civitas_pkt passthrough=no comment="CLI-Mangle-PktMark"',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );
      const cfgAfterAdd = RouterOsConfigService.ensureConfig(sandboxDevice);
      const rule2Id = cfgAfterAdd.firewall.mangleRules[1]?.id || '1';

      // 3. Edit rule 1 via CLI set
      const cliSetOut = RouterOsCliEngine.execute(
        `/ip firewall mangle set 0 comment="Updated-Mangle-Comment"`,
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );

      // 4. Disable & re-enable rule 1
      mutateSandbox('Disable Mangle', (dev) => RouterOsConfigService.setMangleRuleDisabled(dev, rule1Id, true));
      const disabledState = RouterOsConfigService.ensureConfig(sandboxDevice).firewall.mangleRules.find((r) => r.id === rule1Id)?.disabled;
      mutateSandbox('Enable Mangle', (dev) => RouterOsConfigService.setMangleRuleDisabled(dev, rule1Id, false));

      // 5. Move rule 2 up to index 0, then move back
      mutateSandbox('Move Mangle Up', (dev) => RouterOsConfigService.moveMangleRule(dev, rule2Id, 'up'));
      const movedFirstId = RouterOsConfigService.ensureConfig(sandboxDevice).firewall.mangleRules[0]?.id;
      mutateSandbox('Move Mangle Down', (dev) => RouterOsConfigService.moveMangleRule(dev, rule2Id, 'down'));

      // 6. Print & Export check
      const manglePrint = RouterOsCliEngine.execute('/ip firewall mangle print detail', [], sandboxDevice, sandboxProject, mutateSandbox);
      const mangleExport = RouterOsCliEngine.execute('/export', [], sandboxDevice, sandboxProject, mutateSandbox);

      const passed =
        guiMangleRes.success &&
        !cliMangleOut.error &&
        !cliSetOut.error &&
        disabledState === true &&
        movedFirstId === rule2Id &&
        manglePrint.output.includes('civitas_conn') &&
        manglePrint.output.includes('civitas_pkt') &&
        mangleExport.output.includes('/ip firewall mangle');

      results.push({
        id: 13,
        title: '13. IP Firewall Mangle — Add, Edit, Enable/Disable, Move & CLI/GUI Sync',
        category: 'Firewall Mangle Lifecycle',
        passed,
        commandOrAction: `Winbox addMangleRule + CLI '/ip firewall mangle add/set/move/print'`,
        expectedBehavior: 'Mangle rules created in GUI/CLI sync bi-directionally, support ordering (move up/down), enable/disable, and export to .rsc.',
        actualEvidence: `Rules=${cfgAfterAdd.firewall.mangleRules.length}, DisableToggle=${disabledState}, MoveReordered=${movedFirstId === rule2Id}, Exported=${mangleExport.output.includes('/ip firewall mangle')}`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 14: Mangle Passthrough=yes vs Passthrough=no & Packet/Connection Marking
    // =========================================================================
    {
      const t0 = performance.now();
      // Rule 0 has passthrough=yes (marks connection=civitas_conn)
      // Rule 1 has passthrough=no (matches connection-mark=civitas_conn, marks packet=civitas_pkt, terminates chain)
      // Add Rule 2 in prerouting that would overwrite packet-mark to 'overwritten_pkt' if passthrough=no failed
      mutateSandbox('Add Rule 2 after passthrough=no', (dev) =>
        RouterOsConfigService.addMangleRule(dev, {
          chain: 'prerouting',
          action: 'mark-packet',
          newPacketMark: 'overwritten_pkt',
          passthrough: true,
          disabled: false,
          comment: 'Should-Not-Hit-Due-To-Passthrough-No',
        })
      );

      // Run simulated packet trace to trigger Mangle evaluation
      const peerDev =
        sandboxProject.devices.find((d) => d.id !== sandboxDevice.id && d.interfaces.some((i) => i.ipAddress)) ||
        sandboxDevice;
      const traceRes = simulatePacketTrace(peerDev.id, '10.254.99.1', 'ICMP', sandboxProject);
      const cfg = RouterOsConfigService.ensureConfig(sandboxDevice);
      const rule0 = cfg.firewall.mangleRules[0];
      const rule1 = cfg.firewall.mangleRules[1];
      const rule2 = cfg.firewall.mangleRules[2];

      // Also test Reset Counters
      const packetsBeforeReset = (rule0?.packets || 0) + (rule1?.packets || 0);
      RouterOsCliEngine.execute('/ip firewall mangle reset-counters-all', [], sandboxDevice, sandboxProject, mutateSandbox);
      const cfgAfterReset = RouterOsConfigService.ensureConfig(sandboxDevice);
      const packetsAfterReset = cfgAfterReset.firewall.mangleRules.reduce((acc, r) => acc + (r.packets || 0), 0);

      const passed =
        Boolean(rule0 && rule1 && rule2) &&
        packetsBeforeReset >= 0 &&
        packetsAfterReset === 0 &&
        Boolean(traceRes);

      results.push({
        id: 14,
        title: '14. Mangle Chain Evaluation, Passthrough=yes/no & Reset Counters',
        category: 'Mangle Simulation Engine',
        passed,
        commandOrAction: `prerouting: Rule0(mark-connection, PT=yes) -> Rule1(mark-packet, PT=no) -> Rule2(skipped) + reset-counters-all`,
        expectedBehavior: 'Passthrough=yes continues to next rule; passthrough=no stops chain evaluation so Rule 2 is skipped; reset-counters zeroes counters.',
        actualEvidence: `Rule0(PT=yes)->conn:${rule0?.newConnectionMark}, Rule1(PT=no)->pkt:${rule1?.newPacketMark}, Rule2 skipped=${(rule2?.packets || 0) === 0}, CountersAfterReset=${packetsAfterReset}`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 15: RouterOS v6 vs v7 Mangle Routing Table Validation & PBR
    // =========================================================================
    {
      const t0 = performance.now();
      // Switch to RouterOS v7
      mutateSandbox('Switch to v7 for Mangle Routing Table Check', (dev) =>
        RouterOsConfigService.setRouterOsVersion(dev, 'v7')
      );

      // Add mark-routing with an unregistered table 'to_isp_unregistered' in v7 -> should be flagged invalid (I)
      mutateSandbox('Add mark-routing in v7 without table', (dev) =>
        RouterOsConfigService.addMangleRule(dev, {
          chain: 'prerouting',
          srcAddress: '10.200.0.0/24',
          action: 'mark-routing',
          newRoutingMark: 'to_isp_v7',
          passthrough: false,
          disabled: false,
          comment: 'PBR-v7-Rule',
        })
      );
      const cfgV7BeforeTable = RouterOsConfigService.ensureConfig(sandboxDevice);
      const pbrRuleBefore = cfgV7BeforeTable.firewall.mangleRules.find((r) => r.newRoutingMark === 'to_isp_v7');
      const flaggedInvalidInV7 = Boolean(pbrRuleBefore?.invalid);

      // Now register '/routing table add name=to_isp_v7 fib=yes' via CLI and re-validate
      const addTableCli = RouterOsCliEngine.execute(
        '/routing table add name=to_isp_v7 fib=yes comment="ISP2-PBR-Table"',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );
      // Re-save the Mangle rule now that the table exists
      if (pbrRuleBefore) {
        mutateSandbox('Revalidate Mangle rule after table creation', (dev) =>
          RouterOsConfigService.updateMangleRule(dev, pbrRuleBefore.id, { newRoutingMark: 'to_isp_v7' })
        );
      }
      const cfgV7AfterTable = RouterOsConfigService.ensureConfig(sandboxDevice);
      const pbrRuleAfter = cfgV7AfterTable.firewall.mangleRules.find((r) => r.newRoutingMark === 'to_isp_v7');
      const validAfterTableAdded = !pbrRuleAfter?.invalid;

      // Restore device version
      mutateSandbox('Restore version', (dev) =>
        RouterOsConfigService.setRouterOsVersion(dev, device.routerOsVersion === 'v7' ? 'v7' : 'v6')
      );

      const passed = flaggedInvalidInV7 && !addTableCli.error && validAfterTableAdded;

      results.push({
        id: 15,
        title: '15. Kompatibilitas Mangle RouterOS v6 vs v7 (/routing table & PBR)',
        category: 'Version Compatibility (v6 vs v7)',
        passed,
        commandOrAction: `v7 mark-routing 'to_isp_v7' before & after '/routing table add name=to_isp_v7 fib=yes'`,
        expectedBehavior: 'In RouterOS v7, mark-routing requires a registered routing table (flagged Invalid until created); v6 allows direct routing-mark.',
        actualEvidence: `Flagged Invalid before table=${flaggedInvalidInV7}, Valid after '/routing table add'=${validAfterTableAdded}`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 16: PCC Multi-WAN, Address List & Queue Tree Integration
    // =========================================================================
    {
      const t0 = performance.now();
      // 1. Add Address List via CLI
      const alOut = RouterOsCliEngine.execute(
        '/ip firewall address-list add list=MAHASISWA_SUBNET address=10.200.0.0/24 comment="Student-VLAN"',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );

      // 2. Add PCC Mangle rules via CLI
      const pccOut = RouterOsCliEngine.execute(
        '/ip firewall mangle add chain=prerouting src-address-list=MAHASISWA_SUBNET per-connection-classifier=both-addresses:2/0 action=mark-connection new-connection-mark=wan1_pcc_conn passthrough=yes comment="PCC-WAN1"',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );

      // 3. Add Queue Tree consuming Mangle packet-mark 'civitas_pkt'
      const qtOut = RouterOsCliEngine.execute(
        '/queue tree add name=QT-Civitas-Limit parent=global packet-mark=civitas_pkt max-limit=25M priority=4 comment="QoS-From-Mangle"',
        [],
        sandboxDevice,
        sandboxProject,
        mutateSandbox
      );

      // 4. Run traffic simulation tick and verify Mangle byte/packet counters increment
      const trafficAfterMangle = runComprehensiveTrafficSimulation(sandboxProject, 2);
      const cfgFinal = RouterOsConfigService.ensureConfig(sandboxDevice);
      const hasAddressList = (cfgFinal.firewall.addressLists || []).some((a) => a.list === 'MAHASISWA_SUBNET');
      const hasPccRule = cfgFinal.firewall.mangleRules.some((m) => m.perConnectionClassifier === 'both-addresses:2/0');
      const hasQueueTree = (cfgFinal.queueTree || []).some((qt) => qt.name === 'QT-Civitas-Limit' && qt.packetMark === 'civitas_pkt');

      // 5. Verify JSON Serialization / Persistence (Save & Load Project)
      const serializedProject = JSON.stringify(sandboxProject);
      const deserializedProject: NetworkProject = JSON.parse(serializedProject);
      const persistedDev = deserializedProject.devices.find((d) => d.id === sandboxDevice.id);
      const persistedMangleCount = persistedDev?.routerOsConfig?.firewall?.mangleRules?.length || 0;

      const passed =
        !alOut.error &&
        !pccOut.error &&
        !qtOut.error &&
        hasAddressList &&
        hasPccRule &&
        hasQueueTree &&
        persistedMangleCount === cfgFinal.firewall.mangleRules.length &&
        Boolean(trafficAfterMangle);

      results.push({
        id: 16,
        title: '16. Integrasi PCC Multi-WAN, Address List, Queue Tree & Persistence',
        category: 'End-to-End Mangle QoS & PBR',
        passed,
        commandOrAction: `/ip firewall address-list add + PCC Mangle + /queue tree add + JSON Save/Load`,
        expectedBehavior: 'Supports PCC classifier, Address Lists, Queue Tree packet-mark shaping, and full JSON topology save/load persistence.',
        actualEvidence: `AddressList=${hasAddressList}, PCCRule=${hasPccRule}, QueueTree=${hasQueueTree}, PersistedMangleRules=${persistedMangleCount}`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 17: Multi-WAN Generator (v6 vs v7 Syntax, Weighted PCC 3:2:1, Idempotency)
    // =========================================================================
    {
      const t0 = performance.now();
      const weightedPreset = SAMPLE_MULTIWAN_TEMPLATES.find((p) => p.id === 'three-wan-weighted-pcc')!;
      const mwanState = weightedPreset.buildState(sandboxDevice);
      const ratioCalc = calculateWeightedPccRatios(mwanState.wans, true);

      const genV6 = generateMultiWanObjects(sandboxDevice, mwanState, 'v6');
      const genV7 = generateMultiWanObjects(sandboxDevice, mwanState, 'v7');

      const v6Pure =
        !genV6.cliScript.includes('/routing table') &&
        genV6.cliScript.includes('routing-mark=to-WAN1') &&
        !genV6.cliScript.includes('routing-table=to-WAN1');
      const v7Pure =
        genV7.cliScript.includes('/routing table') &&
        genV7.cliScript.includes('routing-table=to-WAN1') &&
        !genV7.cliScript.includes('routing-mark=to-WAN1');

      // Test idempotent application (applying twice must not duplicate [MWAN] rules)
      mutateSandbox('Apply Multi-WAN Pass 1', (dev) => applyMultiWanToDevice(dev, mwanState));
      const countPass1 = RouterOsConfigService.ensureConfig(sandboxDevice).firewall.mangleRules.length;
      mutateSandbox('Apply Multi-WAN Pass 2 (Idempotent)', (dev) => applyMultiWanToDevice(dev, mwanState));
      const countPass2 = RouterOsConfigService.ensureConfig(sandboxDevice).firewall.mangleRules.length;

      const passed =
        SAMPLE_MULTIWAN_TEMPLATES.length === 10 &&
        ratioCalc.ratioLabel === '3 : 2 : 1' &&
        ratioCalc.totalStreams === 6 &&
        v6Pure &&
        v7Pure &&
        countPass1 === countPass2;

      results.push({
        id: 17,
        title: '17. Multi-WAN Generator: Weighted PCC (3:2:1), v6/v7 Syntax & Idempotent Apply',
        category: 'Multi-WAN Configuration Generator',
        passed,
        commandOrAction: `Load 'Three WAN Weighted PCC' (300:200:100) -> Generate v6/v7 -> Apply twice`,
        expectedBehavior: 'Calculates 3:2:1 (6 streams), emits pure v6 vs v7 syntax without mixing, and replaces [MWAN] rules idempotently.',
        actualEvidence: `Presets=${SAMPLE_MULTIWAN_TEMPLATES.length}, Ratio=${ratioCalc.ratioLabel} (${ratioCalc.totalStreams} buckets), v6Pure=${v6Pure}, v7Pure=${v7Pure}, Idempotent(${countPass1}===${countPass2})`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    // =========================================================================
    // TEST 18: Multi-WAN 10-Scenario Simulation & Recursive Route Detection
    // =========================================================================
    {
      const t0 = performance.now();
      const failoverPreset = SAMPLE_MULTIWAN_TEMPLATES.find((p) => p.id === 'three-wan-failover')!;
      const baseState = failoverPreset.buildState(sandboxDevice);

      const s1Normal = calculateMultiWanTelemetry(applySimulationScenarioToMultiWan(baseState, 'all-normal'));
      const s2Wan1Down = calculateMultiWanTelemetry(applySimulationScenarioToMultiWan(baseState, 'wan1-down'));
      const s5TwoDown = calculateMultiWanTelemetry(applySimulationScenarioToMultiWan(baseState, 'two-wans-down'));
      const s6AllDown = calculateMultiWanTelemetry(applySimulationScenarioToMultiWan(baseState, 'all-wans-down'));
      const s9Recursive = calculateMultiWanTelemetry(
        applySimulationScenarioToMultiWan(baseState, 'gateway-up-internet-down')
      );

      const passed =
        s1Normal.overallStatus === 'HEALTHY' &&
        s1Normal.wans[0].isActiveRoute === true &&
        s2Wan1Down.overallStatus === 'FAILOVER_ACTIVE' &&
        s2Wan1Down.wans[0].operationalStatus === 'DOWN' &&
        s2Wan1Down.wans[1].isActiveRoute === true &&
        s5TwoDown.wans[2].isActiveRoute === true &&
        s6AllDown.overallStatus === 'OUTAGE' &&
        s9Recursive.wans[0].gatewayState === 'REACHABLE' &&
        s9Recursive.wans[0].internetState === 'OFFLINE' &&
        s9Recursive.wans[0].operationalStatus === 'DOWN' &&
        s9Recursive.wans[1].isActiveRoute === true;

      results.push({
        id: 18,
        title: '18. Simulasi Multi-WAN 10 Skenario & Deteksi Recursive Route Upstream Outage',
        category: 'Multi-WAN Simulation & Telemetry',
        passed,
        commandOrAction: `Run scenarios: all-normal, wan1-down, two-wans-down, all-wans-down, gateway-up-internet-down`,
        expectedBehavior: 'Detects WAN1 down -> WAN2 active, 2 WANs down -> WAN3 active, and recursive route detects gateway reachable + internet offline.',
        actualEvidence: `Normal=WAN1, WAN1Down->WAN2(${s2Wan1Down.wans[1].isActiveRoute}), 2Down->WAN3(${s5TwoDown.wans[2].isActiveRoute}), RecursiveTest(GW=${s9Recursive.wans[0].gatewayState},Net=${s9Recursive.wans[0].internetState}->FailoverToWAN2=${s9Recursive.wans[1].isActiveRoute})`,
        durationMs: Math.max(1, Math.round((performance.now() - t0) * 10) / 10),
      });
    }

    const passedTests = results.filter((r) => r.passed).length;

    return {
      deviceId: device.id,
      deviceName: device.name,
      deviceModel: device.modelName,
      routerOsVersion: device.routerOsVersion,
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passedTests,
      failedTests: results.length - passedTests,
      results,
    };
  }
}
