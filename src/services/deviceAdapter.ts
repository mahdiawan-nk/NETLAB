import {
  DeviceModel,
  UnifiedCatalogDevice,
  UnifiedDeviceCategory,
  UnifiedPortSpec,
  DeviceInterface,
} from '../types/network';

/**
 * Adapts a built-in legacy DeviceModel to the modern UnifiedCatalogDevice schema.
 */
export function adaptLegacyDeviceModel(legacy: DeviceModel): UnifiedCatalogDevice {
  // Category mapping
  let unifiedCategory: UnifiedDeviceCategory = 'router';
  if (legacy.category === 'switch') unifiedCategory = 'switch';
  else if (legacy.category === 'wireless') unifiedCategory = 'access-point';
  else if (legacy.category === 'wan') unifiedCategory = 'isp-gateway';
  else if (legacy.category === 'server') unifiedCategory = 'server';
  else if (legacy.category === 'endpoint') unifiedCategory = 'network-appliance';

  const ports: UnifiedPortSpec[] = legacy.ports.map((p, idx) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    category: p.type === 'wireless' ? 'wireless' : 'fixed',
    defaultSpeed: p.defaultSpeed,
    supportedSpeeds: p.supportedSpeeds,
    duplex: 'full',
    connectorType: p.type === 'sfp' || p.type === 'sfp-plus' || p.type === 'sfp28' || p.type === 'qsfp28' ? 'LC' : (p.type === 'wireless' ? 'Internal' : 'RJ45'),
    mediaType: p.type === 'sfp-plus' ? 'fiber-smf' : (p.type === 'wireless' ? 'wireless-rf' : 'copper-cat6'),
    portPosition: idx + 1,
    portGroup: p.type.startsWith('sfp') ? 'Optical Transceiver Cage' : 'Ethernet Ports',
    poeCapability: {
      supportsIn: p.poeIn,
      supportsOut: p.poeOut,
      standard: p.poeOut ? '802.3at' : undefined,
      maxWattage: p.poeOut ? 30 : undefined,
    },
    comboWithPortId: p.comboWith,
  }));

  const isRouter = legacy.category === 'router';
  const isSwitch = legacy.category === 'switch';

  return {
    id: legacy.id,
    isCustom: false,
    schemaVersion: 2,
    specificationVersion: 1,
    name: legacy.model,
    brand: legacy.vendor,
    manufacturer: legacy.vendor,
    modelNumber: legacy.model.split(' ')[0],
    productSeries: legacy.series,
    category: unifiedCategory,
    description: legacy.description,
    formFactor: legacy.formFactor as any,
    verificationStatus: 'VERIFIED',
    sourceReferences: [
      {
        id: `ref-${legacy.id}`,
        type: 'Manufacturer Datasheet',
        title: legacy.specSource || `${legacy.vendor} ${legacy.model} Official Specification`,
        accessedAt: '2026-10-30',
        verifiedBy: 'NETLAB Hardware Analyst',
      },
    ],
    hardware: {
      cpuManufacturer: legacy.vendor === 'MikroTik' ? 'ARM / MIPS' : undefined,
      cpuModel: legacy.cpu,
      ramMb: legacy.ram ? parseInt(legacy.ram, 10) * (legacy.ram.includes('GB') ? 1024 : 1) : 256,
      operatingSystem: legacy.routerOsVersion ? `MikroTik RouterOS ${legacy.routerOsVersion}` : undefined,
      powerSupplyType: 'Internal AC',
      coolingSystem: legacy.ports.length > 12 ? 'Active (PWM Fans)' : 'Passive (Fanless)',
    },
    ports,
    portLayout: {
      faceplateStyle: legacy.formFactor.includes('1U') ? '1U-Full-Width' : 'Desktop-Front',
      rows: Math.max(1, Math.ceil(ports.length / 8)),
      columns: Math.min(8, Math.max(ports.length, 1)),
      totalPorts: ports.length,
      portsOrder: ports.map((p) => p.id),
    },
    capabilities: {
      general: {
        layer2: true,
        layer3: isRouter,
        ipv4: true,
        ipv6: true,
        staticRouting: isRouter,
        dynamicRouting: isRouter,
      },
      switching: {
        vlanSupport: true,
        vlanTrunking: true,
        stp: true,
        rstp: true,
        mstp: isSwitch,
        linkAggregation: true,
        lacp: isSwitch,
        portMirroring: isSwitch,
        jumboFrames: true,
        maxJumboFrameBytes: 9216,
      },
      routing: {
        staticRoute: isRouter,
        ospf: isRouter,
        bgp: isRouter,
        rip: isRouter,
        ecmp: isRouter,
        policyRouting: isRouter,
      },
      networkServices: {
        nat: isRouter,
        dhcpServer: isRouter,
        dhcpClient: true,
        dnsForwarder: isRouter,
        firewall: isRouter,
        vpn: isRouter,
        qos: true,
        trafficShaping: isRouter,
        hotspot: isRouter,
        radius: isRouter,
      },
    },
    performance: {
      switchingCapacityGbps: ports.length * 2,
      forwardingRateMpps: Math.round(ports.length * 1.488 * 10) / 10,
      maxThroughputMbps: ports.length * 1000,
    },
    poe: {
      supported: ports.some((p) => p.poeCapability?.supportsIn || p.poeCapability?.supportsOut),
      type: ports.some((p) => p.poeCapability?.supportsOut) ? 'PSE (Power Sourcing)' : 'PD (Powered Device)',
      standard: '802.3at (PoE+ 30W)',
      powerBudgetWatts: ports.filter((p) => p.poeCapability?.supportsOut).length * 30,
    },
    wireless: legacy.category === 'wireless' ? {
      wifiStandard: 'Wi-Fi 6 (802.11ax)',
      frequencyBands: ['2.4GHz', '5GHz'],
      radioCount: 2,
      maxPhyRateMbps: 1800,
      mimoSupported: true,
      muMimoSupported: true,
      antennaType: 'Internal Omnidirectional',
      antennaGainDbi: 5,
    } : undefined,
    compatibility: {
      supportedTransceivers: ['sfpplus-10g-lr', 'sfpplus-10g-sr', 'sfp-1g-lx', 'sfp-1g-sx'],
      supportedMedia: ['copper-cat6', 'copper-cat6a', 'fiber-smf', 'fiber-mmf'],
      allowsDacCables: true,
      allowsAocCables: true,
    },
    simulationProfile: {
      supportedSimulationFeatures: isRouter ? ['L1-Carrier', 'L2-VLAN', 'L3-Routing', 'L3-NAT', 'Traffic-Telemetry'] : ['L1-Carrier', 'L2-VLAN', 'Traffic-Telemetry'],
      switchingBehavior: 'SIMULATED',
      routingBehavior: isRouter ? 'SIMULATED' : 'UNKNOWN',
      vlanBehavior: 'SIMULATED',
      natBehavior: isRouter ? 'SIMULATED' : 'UNKNOWN',
      dhcpBehavior: isRouter ? 'SIMULATED' : 'UNKNOWN',
      firewallBehavior: isRouter ? 'SIMULATED' : 'UNKNOWN',
      trafficHandling: 'Hardware-Offloaded',
    },
    createdBy: 'system',
    updatedBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Creates a blank template for a new custom device.
 */
export function createDefaultCustomDevice(): UnifiedCatalogDevice {
  const defaultPortId1 = 'ether1';
  const defaultPortId2 = 'ether2';
  const now = new Date().toISOString();

  return {
    id: `custom-${Date.now()}`,
    isCustom: true,
    schemaVersion: 2,
    specificationVersion: 1,
    name: 'Custom Router Pro',
    brand: 'Generic',
    manufacturer: 'Custom Fabricator',
    modelNumber: 'CRP-8G-2SFP+',
    productSeries: 'EdgeLab Series',
    category: 'router',
    description: 'Custom-designed enterprise edge router with Gigabit Ethernet and dual 10G SFP+ optical cages.',
    formFactor: '1U Rackmount',
    releaseYear: 2026,
    verificationStatus: 'UNVERIFIED',
    sourceReferences: [],
    hardware: {
      cpuManufacturer: 'ARM',
      cpuModel: 'Quad-Core 64-bit Cortex-A72',
      cpuArchitecture: 'ARM64',
      cpuCores: 4,
      cpuFrequencyMhz: 1800,
      ramMb: 2048,
      storageMb: 16384,
      operatingSystem: 'MikroTik RouterOS v7',
      powerConsumptionWatts: 35,
      powerSupplyType: 'Internal AC',
      coolingSystem: 'Active (PWM Fans)',
    },
    ports: [
      {
        id: defaultPortId1,
        name: 'ether1 (WAN)',
        type: 'ethernet',
        category: 'fixed',
        defaultSpeed: '1G',
        supportedSpeeds: ['100M', '1G'],
        duplex: 'full',
        connectorType: 'RJ45',
        mediaType: 'copper-cat6',
        portPosition: 1,
        portGroup: 'WAN Uplink',
        colorTag: '#3b82f6',
      },
      {
        id: defaultPortId2,
        name: 'ether2',
        type: 'ethernet',
        category: 'fixed',
        defaultSpeed: '1G',
        supportedSpeeds: ['100M', '1G'],
        duplex: 'full',
        connectorType: 'RJ45',
        mediaType: 'copper-cat6',
        portPosition: 2,
        portGroup: 'LAN Group',
        colorTag: '#10b981',
      },
      {
        id: 'ether3',
        name: 'ether3',
        type: 'ethernet',
        category: 'fixed',
        defaultSpeed: '1G',
        supportedSpeeds: ['100M', '1G'],
        duplex: 'full',
        connectorType: 'RJ45',
        mediaType: 'copper-cat6',
        portPosition: 3,
        portGroup: 'LAN Group',
        colorTag: '#10b981',
      },
      {
        id: 'ether4',
        name: 'ether4',
        type: 'ethernet',
        category: 'fixed',
        defaultSpeed: '1G',
        supportedSpeeds: ['100M', '1G'],
        duplex: 'full',
        connectorType: 'RJ45',
        mediaType: 'copper-cat6',
        portPosition: 4,
        portGroup: 'LAN Group',
        colorTag: '#10b981',
      },
      {
        id: 'sfp-plus1',
        name: 'sfp-sfpplus1',
        type: 'sfp-plus',
        category: 'modular',
        defaultSpeed: '10G',
        supportedSpeeds: ['1G', '10G'],
        duplex: 'full',
        connectorType: 'LC',
        mediaType: 'fiber-smf',
        portPosition: 5,
        portGroup: 'Optical 10G SFP+',
        colorTag: '#eab308',
      },
      {
        id: 'sfp-plus2',
        name: 'sfp-sfpplus2',
        type: 'sfp-plus',
        category: 'modular',
        defaultSpeed: '10G',
        supportedSpeeds: ['1G', '10G'],
        duplex: 'full',
        connectorType: 'LC',
        mediaType: 'fiber-smf',
        portPosition: 6,
        portGroup: 'Optical 10G SFP+',
        colorTag: '#eab308',
      },
    ],
    portLayout: {
      faceplateStyle: '1U-Full-Width',
      rows: 1,
      columns: 6,
      totalPorts: 6,
      portsOrder: [defaultPortId1, defaultPortId2, 'ether3', 'ether4', 'sfp-plus1', 'sfp-plus2'],
    },
    capabilities: {
      general: {
        layer2: true,
        layer3: true,
        ipv4: true,
        ipv6: true,
        staticRouting: true,
        dynamicRouting: true,
      },
      switching: {
        vlanSupport: true,
        vlanTrunking: true,
        stp: true,
        rstp: true,
        mstp: true,
        linkAggregation: true,
        lacp: true,
        portMirroring: true,
        jumboFrames: true,
        maxJumboFrameBytes: 9000,
      },
      routing: {
        staticRoute: true,
        ospf: true,
        bgp: true,
        rip: true,
        ecmp: true,
        policyRouting: true,
      },
      networkServices: {
        nat: true,
        dhcpServer: true,
        dhcpClient: true,
        dnsForwarder: true,
        firewall: true,
        vpn: true,
        qos: true,
        trafficShaping: true,
        hotspot: true,
        radius: true,
      },
    },
    performance: {
      switchingCapacityGbps: 28,
      forwardingRateMpps: 20.8,
      maxThroughputMbps: 10000,
      routingThroughputMbps: 5000,
      firewallThroughputMbps: 3500,
      vpnThroughputMbps: 1200,
      maxMacTableSize: 16384,
      maxVlanCount: 4094,
      maxRoutingEntries: 100000,
      maxConcurrentSessions: 500000,
      maxConnectedClients: 1000,
      measurementNotes: 'RFC 2544 64-byte frame standard testing',
    },
    poe: {
      supported: false,
    },
    compatibility: {
      supportedTransceivers: [
        'sfpplus-10g-lr',
        'sfpplus-10g-sr',
        'sfpplus-10g-er',
        'sfpplus-10g-bidi-u',
        'sfpplus-10g-bidi-d',
        'sfpplus-10g-rj45',
        'sfp-1g-lx',
        'sfp-1g-sx',
      ],
      supportedMedia: ['copper-cat6', 'copper-cat6a', 'fiber-smf', 'fiber-mmf'],
      allowsDacCables: true,
      allowsAocCables: true,
    },
    simulationProfile: {
      supportedSimulationFeatures: ['L1-Carrier', 'L2-VLAN', 'L3-Routing', 'L3-NAT', 'Traffic-Telemetry'],
      switchingBehavior: 'SIMULATED',
      routingBehavior: 'SIMULATED',
      vlanBehavior: 'SIMULATED',
      natBehavior: 'SIMULATED',
      dhcpBehavior: 'SIMULATED',
      firewallBehavior: 'SIMULATED',
      trafficHandling: 'Hardware-Offloaded',
    },
    createdBy: 'user',
    updatedBy: 'user',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Converts a UnifiedCatalogDevice into active DeviceInterface[] instances for NetworkDevice on the canvas.
 */
export function createDeviceInterfacesFromUnified(
  model: UnifiedCatalogDevice,
  newDeviceId: string
): DeviceInterface[] {
  const portsList = Array.isArray(model.ports)
    ? model.ports
    : Array.isArray((model as any).interfaces)
    ? (model as any).interfaces
    : [];

  return portsList.map((p: any, idx: number) => {
    const portId = p.id || `port${idx + 1}`;
    const portName = p.name || portId;
    const pType = p.type || 'ethernet';
    const isOptical = pType === 'sfp' || pType === 'sfp-plus' || pType === 'sfp28' || pType === 'qsfp28';
    const isWan = portName.toLowerCase().includes('wan') || (p.portGroup && p.portGroup.toLowerCase().includes('wan'));
    const isTrunk = isOptical || portName.toLowerCase().includes('trunk') || portName.toLowerCase().includes('uplink');

    return {
      id: `${newDeviceId}_${portId}`,
      deviceId: newDeviceId,
      name: portName.split(' ')[0],
      type: pType,
      adminState: 'up' as const,
      operationalState: 'RUN' as const,
      macAddress: `00:50:56:${Math.floor(Math.random() * 89 + 10)}:${portId.slice(-2).padStart(2, '0')}:${Math.floor(Math.random() * 89 + 10)}`,
      mode: isWan ? ('wan' as const) : (isTrunk ? ('trunk' as const) : ('access' as const)),
      speed: p.defaultSpeed || p.speed || '1G',
      duplex: (p.duplex === 'auto' || !p.duplex ? 'full' : p.duplex) as 'full' | 'half',
      mtu: p.defaultMtu || 1500,
      pvid: 1,
      transceiver: pType === 'sfp-plus' ? 'sfpplus-10g-lr' : (pType === 'sfp' ? 'sfp-1g-lx' : undefined),
    };
  });
}
