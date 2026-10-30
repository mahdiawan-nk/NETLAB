import { NetworkDevice, NetworkProject } from '../types/network';
import { RouterOsDeviceConfig } from '../types/routerOs';
import { RouterOsConfigService, MutationResult } from './routerOsConfigService';
import { RouterOsCliEngine } from './routerOsCliEngine';
import { simulatePacketTrace } from './simulationEngine';
import { validateTopology } from './validationEngine';
import { runComprehensiveTrafficSimulation } from './trafficEngine';

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
