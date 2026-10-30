import {
  NetworkDevice,
  NetworkLink,
  NetworkVlan,
  MediaType,
  PortMode,
} from '../types/network';
import { DEVICE_CATALOG } from '../data/deviceCatalog';
import { validateTopology } from './validationEngine';

export interface CliExecutionResult {
  success: boolean;
  output: string;
  command: string;
  timestamp: string;
  actionTaken?: {
    type: 'ADD_DEVICE' | 'REMOVE_DEVICE' | 'ADD_LINK' | 'REMOVE_LINK' | 'SET_INTERFACE' | 'ADD_VLAN' | 'REMOVE_VLAN' | 'VALIDATE';
    payload: unknown;
  };
}

export function parseNetlabCommand(
  rawCommand: string,
  state: {
    devices: NetworkDevice[];
    links: NetworkLink[];
    vlans: NetworkVlan[];
  }
): CliExecutionResult {
  const trimmed = rawCommand.trim();
  const timestamp = new Date().toLocaleTimeString();

  if (!trimmed) {
    return { success: true, output: '', command: '', timestamp };
  }

  // Tokenize preserving key=val
  const tokens = trimmed.split(/\s+/);
  const root = tokens[0].toLowerCase();
  const sub = tokens[1]?.toLowerCase();

  // Helper to extract key=val map
  const kvParams: Record<string, string> = {};
  for (let i = 2; i < tokens.length; i++) {
    const part = tokens[i];
    if (part.includes('=')) {
      const [k, v] = part.split('=');
      kvParams[k.toLowerCase()] = v;
    }
  }

  // 1. HELP
  if (root === 'help' || root === '?') {
    return {
      success: true,
      command: trimmed,
      timestamp,
      output: `NETLAB CLI — Command Reference:
  device add <category|model> [model=<MODEL_ID>] name=<NAME> [x=<X>] [y=<Y>]
      Examples:
      - device add router CCR2116 name=CORE-R1
      - device add switch CRS326 name=SW-DIST1
      - device add wan dedicated name=ISP1
      - device add endpoint pc name=PC-LAB1

  device remove <name|id>
      Example: device remove CORE-R1

  link add <dev1>:<port1> <dev2>:<port2> [media=fiber-sm|fiber-mm|copper-cat6] [length=<meters>]
      Examples:
      - link add ISP1:lan1 CORE-R1:ether1 media=copper-cat6
      - link add CORE-R1:sfp-sfpplus1 SW-DIST1:sfp-sfpplus1 media=fiber-sm length=200

  link remove <link_id | dev1:port1>` + `

  interface set <dev>:<port> [ip=<IP/CIDR>] [mode=access|trunk|wan] [vlan=<ID>] [admin=up|down]
      Examples:
      - interface set CORE-R1:ether1 mode=wan ip=202.158.10.2/30
      - interface set SW-DIST1:ether1 mode=access vlan=20

  vlan add id=<ID> name=<NAME> [subnet=<CIDR>] [gw=<IP>]
      Example: vlan add id=20 name=CIVITAS subnet=10.20.0.0/24 gw=10.20.0.1

  vlan remove id=<ID>

  simulate validate
  diagnose all
  show devices | show links | show vlans | show running-config
  clear`,
    };
  }

  // 2. CLEAR
  if (root === 'clear' || root === 'cls') {
    return { success: true, command: trimmed, timestamp, output: '__CLEAR__' };
  }

  // 3. SHOW COMMANDS
  if (root === 'show') {
    if (sub === 'devices') {
      if (state.devices.length === 0) return { success: true, command: trimmed, timestamp, output: 'No devices found in current project.' };
      const lines = state.devices.map(
        (d) => `  • [${d.status}] ${d.name.padEnd(16)} | ${d.modelName.padEnd(25)} | Ports: ${d.interfaces.length} | Cat: ${d.category}`
      );
      return { success: true, command: trimmed, timestamp, output: `Active Devices (${state.devices.length}):\n${lines.join('\n')}` };
    }
    if (sub === 'links') {
      if (state.links.length === 0) return { success: true, command: trimmed, timestamp, output: 'No links configured in topology.' };
      const lines = state.links.map((l) => {
        const srcDev = state.devices.find((d) => d.id === l.sourceDeviceId)?.name || l.sourceDeviceId;
        const tgtDev = state.devices.find((d) => d.id === l.targetDeviceId)?.name || l.targetDeviceId;
        const srcPort = l.sourceInterfaceId.split('_').pop();
        const tgtPort = l.targetInterfaceId.split('_').pop();
        return `  • [${l.status}] ${srcDev}:${srcPort} <— ${l.mediaType} (${l.cableLengthMeters}m) —> ${tgtDev}:${tgtPort}`;
      });
      return { success: true, command: trimmed, timestamp, output: `Configured Links (${state.links.length}):\n${lines.join('\n')}` };
    }
    if (sub === 'vlans') {
      if (state.vlans.length === 0) return { success: true, command: trimmed, timestamp, output: 'No VLANs configured.' };
      const lines = state.vlans.map(
        (v) => `  • VLAN ${v.id.toString().padEnd(4)} | Name: ${v.name.padEnd(14)} | Subnet: ${v.subnet} | GW: ${v.gatewayIp}`
      );
      return { success: true, command: trimmed, timestamp, output: `VLAN Database:\n${lines.join('\n')}` };
    }
    if (sub === 'running-config' || sub === 'config') {
      const summary = `--- NETLAB RUNNING CONFIG SUMMARY ---
Devices: ${state.devices.length}
Links: ${state.links.length}
VLANs: ${state.vlans.length}
Topology Status: ${validateTopology(state.devices, state.links, state.vlans).length === 0 ? 'VALIDATED (RUN)' : 'WARNINGS/ERRORS DETECTED'}
`;
      return { success: true, command: trimmed, timestamp, output: summary };
    }
    return { success: false, command: trimmed, timestamp, output: `Unknown show target '${sub}'. Use 'show devices', 'show links', or 'show vlans'.` };
  }

  // 4. SIMULATE VALIDATE / DIAGNOSE ALL
  if (root === 'simulate' || root === 'diagnose') {
    const diags = validateTopology(state.devices, state.links, state.vlans);
    if (diags.length === 0) {
      return {
        success: true,
        command: trimmed,
        timestamp,
        output: `[OK] Topology Validation PASSED!\nAll ${state.devices.length} devices and ${state.links.length} links meet Layer 1-3 specifications without anomalies.`,
        actionTaken: { type: 'VALIDATE', payload: {} },
      };
    }
    const report = diags.map((d, idx) => {
      const icon = d.severity === 'error' ? '[ERROR]' : '[WARN]';
      return `${idx + 1}. ${icon} ${d.errorCode} (${d.status})\n   Condition: ${d.observedCondition}\n   Evidence:  ${d.evidence}\n   Fix:       ${d.recommendedAction}`;
    }).join('\n\n');

    return {
      success: true,
      command: trimmed,
      timestamp,
      output: `[AUDIT] Topology Validation found ${diags.length} issues:\n\n${report}`,
      actionTaken: { type: 'VALIDATE', payload: {} },
    };
  }

  // 5. DEVICE ADD
  if (root === 'device' && sub === 'add') {
    const rawTarget = tokens[2]; // e.g. "CCR2116", "router", "switch"
    const modelParam = kvParams['model'] || tokens[3];
    const nameParam = kvParams['name'];

    if (!rawTarget) {
      return {
        success: false,
        command: trimmed,
        timestamp,
        output: 'Error: Missing device model or category. Format: device add <model> name=<HOSTNAME>',
      };
    }

    // Lookup model in catalog
    const searchKey = (modelParam || rawTarget).toLowerCase();
    const matchedModel = DEVICE_CATALOG.find(
      (m) =>
        m.id.toLowerCase().includes(searchKey) ||
        m.model.toLowerCase().includes(searchKey) ||
        m.category.toLowerCase() === searchKey
    );

    if (!matchedModel) {
      const available = DEVICE_CATALOG.map((m) => m.model).join(', ');
      return {
        success: false,
        command: trimmed,
        timestamp,
        output: `Error: Model '${searchKey}' not found in catalog.\nAvailable models: ${available}`,
      };
    }

    const hostname = nameParam || `${matchedModel.category.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const xPos = kvParams['x'] ? parseInt(kvParams['x'], 10) : 250 + Math.random() * 200;
    const yPos = kvParams['y'] ? parseInt(kvParams['y'], 10) : 150 + Math.random() * 200;

    return {
      success: true,
      command: trimmed,
      timestamp,
      output: `[OK] Created device '${hostname}' (${matchedModel.model}) with ${matchedModel.ports.length} physical interfaces.`,
      actionTaken: {
        type: 'ADD_DEVICE',
        payload: {
          modelId: matchedModel.id,
          name: hostname,
          x: xPos,
          y: yPos,
        },
      },
    };
  }

  // 6. DEVICE REMOVE
  if (root === 'device' && (sub === 'remove' || sub === 'delete' || sub === 'rm')) {
    const targetName = tokens[2];
    if (!targetName) {
      return { success: false, command: trimmed, timestamp, output: 'Error: Specify device name or ID to remove.' };
    }
    const found = state.devices.find((d) => d.name.toLowerCase() === targetName.toLowerCase() || d.id === targetName);
    if (!found) {
      return { success: false, command: trimmed, timestamp, output: `Error: Device '${targetName}' not found.` };
    }
    return {
      success: true,
      command: trimmed,
      timestamp,
      output: `[OK] Device '${found.name}' and all connected links removed.`,
      actionTaken: {
        type: 'REMOVE_DEVICE',
        payload: { id: found.id },
      },
    };
  }

  // 7. LINK ADD
  if (root === 'link' && sub === 'add') {
    const endpoint1 = tokens[2]; // e.g. "CORE:ether1"
    const endpoint2 = tokens[3]; // e.g. "SW-DIST:ether1"

    if (!endpoint1 || !endpoint2 || !endpoint1.includes(':') || !endpoint2.includes(':')) {
      return {
        success: false,
        command: trimmed,
        timestamp,
        output: 'Error: Invalid link endpoints. Format: link add <dev1>:<port1> <dev2>:<port2> [media=...] [length=...]',
      };
    }

    const [d1Name, p1Name] = endpoint1.split(':');
    const [d2Name, p2Name] = endpoint2.split(':');

    const dev1 = state.devices.find((d) => d.name.toLowerCase() === d1Name.toLowerCase());
    const dev2 = state.devices.find((d) => d.name.toLowerCase() === d2Name.toLowerCase());

    if (!dev1) return { success: false, command: trimmed, timestamp, output: `Error: Device '${d1Name}' not found.` };
    if (!dev2) return { success: false, command: trimmed, timestamp, output: `Error: Device '${d2Name}' not found.` };

    const iface1 = dev1.interfaces.find((i) => i.name.toLowerCase() === p1Name.toLowerCase() || i.id.endsWith(p1Name));
    const iface2 = dev2.interfaces.find((i) => i.name.toLowerCase() === p2Name.toLowerCase() || i.id.endsWith(p2Name));

    if (!iface1) return { success: false, command: trimmed, timestamp, output: `Error: Interface '${p1Name}' not found on ${dev1.name}.` };
    if (!iface2) return { success: false, command: trimmed, timestamp, output: `Error: Interface '${p2Name}' not found on ${dev2.name}.` };

    // Auto-detect or use specified media
    let mediaType: MediaType = 'copper-cat6';
    if (kvParams['media']) {
      const m = kvParams['media'].toLowerCase();
      if (m.includes('sm') || m.includes('single')) mediaType = 'fiber-smf';
      else if (m.includes('mm') || m.includes('multi')) mediaType = 'fiber-mmf';
      else if (m.includes('cat6a')) mediaType = 'copper-cat6a';
      else if (m.includes('cat7')) mediaType = 'copper-cat7';
      else if (m.includes('cat5')) mediaType = 'copper-cat5e';
      else mediaType = 'copper-cat6';
    } else {
      // Auto-choose based on port type: if both are SFP, default to fiber-smf
      if ((iface1.type === 'sfp' || iface1.type === 'sfp-plus') && (iface2.type === 'sfp' || iface2.type === 'sfp-plus')) {
        mediaType = 'fiber-smf';
      }
    }

    const cableLength = kvParams['length'] ? parseInt(kvParams['length'], 10) : (mediaType.startsWith('fiber') ? 50 : 5);

    return {
      success: true,
      command: trimmed,
      timestamp,
      output: `[OK] Created link between ${dev1.name}:${iface1.name} and ${dev2.name}:${iface2.name} via ${mediaType} (${cableLength}m).`,
      actionTaken: {
        type: 'ADD_LINK',
        payload: {
          sourceDeviceId: dev1.id,
          sourceInterfaceId: iface1.id,
          targetDeviceId: dev2.id,
          targetInterfaceId: iface2.id,
          mediaType,
          cableLengthMeters: cableLength,
        },
      },
    };
  }

  // 8. INTERFACE SET
  if (root === 'interface' && sub === 'set') {
    const target = tokens[2]; // e.g. "CORE:ether1"
    if (!target || !target.includes(':')) {
      return {
        success: false,
        command: trimmed,
        timestamp,
        output: 'Error: Specify interface as <device>:<port>. Format: interface set <dev>:<port> [ip=...] [mode=...]',
      };
    }
    const [devName, portName] = target.split(':');
    const dev = state.devices.find((d) => d.name.toLowerCase() === devName.toLowerCase());
    if (!dev) return { success: false, command: trimmed, timestamp, output: `Error: Device '${devName}' not found.` };

    const iface = dev.interfaces.find((i) => i.name.toLowerCase() === portName.toLowerCase() || i.id.endsWith(portName));
    if (!iface) return { success: false, command: trimmed, timestamp, output: `Error: Port '${portName}' not found on ${dev.name}.` };

    const updates: Partial<NetworkDevice['interfaces'][0]> = {};
    if (kvParams['ip']) updates.ipAddress = kvParams['ip'];
    if (kvParams['mode']) updates.mode = kvParams['mode'] as PortMode;
    if (kvParams['vlan']) updates.pvid = parseInt(kvParams['vlan'], 10);
    if (kvParams['admin']) updates.adminState = kvParams['admin'].toLowerCase() === 'up' ? 'up' : 'down';

    return {
      success: true,
      command: trimmed,
      timestamp,
      output: `[OK] Interface ${dev.name}:${iface.name} updated: ${JSON.stringify(updates)}`,
      actionTaken: {
        type: 'SET_INTERFACE',
        payload: {
          deviceId: dev.id,
          interfaceId: iface.id,
          updates,
        },
      },
    };
  }

  // 9. VLAN ADD
  if (root === 'vlan' && sub === 'add') {
    const idVal = kvParams['id'] || tokens[2];
    const nameVal = kvParams['name'] || tokens[3];
    const vlanId = parseInt(idVal, 10);

    if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
      return { success: false, command: trimmed, timestamp, output: 'Error: Invalid VLAN ID (Must be 1-4094).' };
    }
    const vlanName = nameVal || `VLAN_${vlanId}`;
    const subnet = kvParams['subnet'] || `10.${vlanId}.0.0/24`;
    const gw = kvParams['gw'] || `10.${vlanId}.0.1`;

    return {
      success: true,
      command: trimmed,
      timestamp,
      output: `[OK] Added VLAN ${vlanId} '${vlanName}' with subnet ${subnet} (GW: ${gw}).`,
      actionTaken: {
        type: 'ADD_VLAN',
        payload: {
          id: vlanId,
          name: vlanName,
          subnet,
          gatewayIp: gw,
          dhcpEnabled: true,
          color: '#' + Math.floor(Math.random() * 16777215).toString(16),
        },
      },
    };
  }

  return {
    success: false,
    command: trimmed,
    timestamp,
    output: `Error: Unrecognized command '${trimmed}'. Type 'help' to view available commands.`,
  };
}

export const AUTOCOMPLETE_SUGGESTIONS = [
  'device add router CCR2116 name=',
  'device add router RB5009 name=',
  'device add router RB4011 name=',
  'device add router RB750Gr3 name=',
  'device add switch CRS326 name=',
  'device add switch CRS328 name=',
  'device add wireless hAP-ax3 name=',
  'device add wan dedicated name=',
  'device add endpoint pc name=',
  'link add ',
  'interface set ',
  'vlan add id=',
  'simulate validate',
  'diagnose all',
  'show devices',
  'show links',
  'show vlans',
  'show running-config',
  'help',
  'clear',
];
