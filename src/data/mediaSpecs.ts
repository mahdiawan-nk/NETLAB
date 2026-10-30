import { MediaType, OpticalTransceiverType } from '../types/network';

export interface CableSpecification {
  id: MediaType;
  name: string;
  category: 'copper' | 'fiber' | 'wireless';
  colorHex: string;
  jacketColor: string;
  connectorType: string;
  maxDistanceMeters: number;
  typicalAttenuationDbPerKm: number;
  supportedInterfaceTypes: string[];
  description: string;
}

export const CABLE_SPECIFICATIONS: Record<MediaType, CableSpecification> = {
  'copper-cat5e': {
    id: 'copper-cat5e',
    name: 'Cat5e UTP Copper Cable',
    category: 'copper',
    colorHex: '#64748b', // Slate
    jacketColor: 'Grey',
    connectorType: 'RJ45 (8P8C)',
    maxDistanceMeters: 100,
    typicalAttenuationDbPerKm: 22,
    supportedInterfaceTypes: ['ethernet', 'management'],
    description: 'Standard Fast Ethernet & 1Gbps copper patch cord up to 100 meters.',
  },
  'copper-cat6': {
    id: 'copper-cat6',
    name: 'Cat6 UTP Gigabit Cable',
    category: 'copper',
    colorHex: '#3b82f6', // Blue
    jacketColor: 'Blue',
    connectorType: 'RJ45 (8P8C)',
    maxDistanceMeters: 100,
    typicalAttenuationDbPerKm: 19,
    supportedInterfaceTypes: ['ethernet', 'management'],
    description: 'High-speed Gigabit Ethernet and short-run 10Gbps (up to 37-55m) copper cable.',
  },
  'copper-cat6a': {
    id: 'copper-cat6a',
    name: 'Cat6A STP 10G Copper Cable',
    category: 'copper',
    colorHex: '#0284c7', // Darker Blue
    jacketColor: 'Dark Blue / Shielded',
    connectorType: 'RJ45 Shielded',
    maxDistanceMeters: 100,
    typicalAttenuationDbPerKm: 17,
    supportedInterfaceTypes: ['ethernet', 'management'],
    description: 'Full 10Gbps rated shielded copper cable for data center and rack interconnects up to 100m.',
  },
  'copper-cat7': {
    id: 'copper-cat7',
    name: 'Cat7 S/FTP Industrial Cable',
    category: 'copper',
    colorHex: '#6366f1', // Indigo
    jacketColor: 'Purple / Industrial',
    connectorType: 'RJ45 / GG45',
    maxDistanceMeters: 100,
    typicalAttenuationDbPerKm: 15,
    supportedInterfaceTypes: ['ethernet', 'management'],
    description: 'Individually shielded pairs with braided outer shield for high-interference plant environments.',
  },
  'fiber-smf': {
    id: 'fiber-smf',
    name: 'Single-Mode Fiber (9/125µm OS2)',
    category: 'fiber',
    colorHex: '#eab308', // Classic Yellow OS2
    jacketColor: 'Yellow',
    connectorType: 'LC-LC Duplex / UPC',
    maxDistanceMeters: 40000,
    typicalAttenuationDbPerKm: 0.35, // 0.35 dB/km @ 1310nm
    supportedInterfaceTypes: ['sfp', 'sfp-plus', 'sfp28', 'qsfp28'],
    description: 'Long-haul and campus backbone single-mode fiber with ultra-low attenuation (1310nm / 1550nm).',
  },
  'fiber-mmf': {
    id: 'fiber-mmf',
    name: 'Multi-Mode Fiber (50/125µm OM3/OM4)',
    category: 'fiber',
    colorHex: '#06b6d4', // Aqua OM3/OM4
    jacketColor: 'Aqua',
    connectorType: 'LC-LC Duplex / PC',
    maxDistanceMeters: 550,
    typicalAttenuationDbPerKm: 3.0, // 3.0 dB/km @ 850nm
    supportedInterfaceTypes: ['sfp', 'sfp-plus'],
    description: 'Short-range high-bandwidth optical interconnect for intra-building or server room racks.',
  },
  'wireless-rf': {
    id: 'wireless-rf',
    name: 'Wireless 802.11ax RF Link',
    category: 'wireless',
    colorHex: '#10b981', // Emerald
    jacketColor: 'Over the Air',
    connectorType: 'RF Antenna / Wireless Association',
    maxDistanceMeters: 150,
    typicalAttenuationDbPerKm: 0,
    supportedInterfaceTypes: ['wireless'],
    description: 'Over-the-air RF propagation for Wi-Fi 6 ax clients and access points.',
  },
};

export interface TransceiverSpecification {
  id: OpticalTransceiverType;
  modelName: string;
  formFactor: 'SFP' | 'SFP+';
  speed: '1G' | '10G';
  fiberType: 'smf' | 'mmf' | 'copper';
  wavelengthNm?: number;
  txWavelengthNm?: number;
  rxWavelengthNm?: number;
  connector: 'LC Duplex' | 'LC Simplex (BiDi)' | 'RJ45';
  maxDistanceMeters: number;
  compatiblePeerTransceivers: OpticalTransceiverType[];
  description: string;
}

export const TRANSCEIVER_SPECIFICATIONS: Record<OpticalTransceiverType, TransceiverSpecification | null> = {
  'none': null,
  'sfp-1g-sx': {
    id: 'sfp-1g-sx',
    modelName: 'MikroTik S-85DLC05D (1G SX)',
    formFactor: 'SFP',
    speed: '1G',
    fiberType: 'mmf',
    wavelengthNm: 850,
    connector: 'LC Duplex',
    maxDistanceMeters: 550,
    compatiblePeerTransceivers: ['sfp-1g-sx'],
    description: '1.25G Multi-Mode SFP transceiver, 850nm Dual LC, 550m reach with DDM.',
  },
  'sfp-1g-lx': {
    id: 'sfp-1g-lx',
    modelName: 'MikroTik S-31DLC20D (1G LX)',
    formFactor: 'SFP',
    speed: '1G',
    fiberType: 'smf',
    wavelengthNm: 1310,
    connector: 'LC Duplex',
    maxDistanceMeters: 20000,
    compatiblePeerTransceivers: ['sfp-1g-lx'],
    description: '1.25G Single-Mode SFP transceiver, 1310nm Dual LC, 20km reach with DDM.',
  },
  'sfp-1g-rj45': {
    id: 'sfp-1g-rj45',
    modelName: 'MikroTik S-RJ01 (1G RJ45)',
    formFactor: 'SFP',
    speed: '1G',
    fiberType: 'copper',
    connector: 'RJ45',
    maxDistanceMeters: 100,
    compatiblePeerTransceivers: ['sfp-1g-rj45'],
    description: '1.25G Copper RJ45 SFP module converting SFP slot to 10/100/1000M copper.',
  },
  'sfpplus-10g-sr': {
    id: 'sfpplus-10g-sr',
    modelName: 'MikroTik S+85DLC03D (10G SR)',
    formFactor: 'SFP+',
    speed: '10G',
    fiberType: 'mmf',
    wavelengthNm: 850,
    connector: 'LC Duplex',
    maxDistanceMeters: 300,
    compatiblePeerTransceivers: ['sfpplus-10g-sr'],
    description: '10Gbps Multi-Mode SFP+ transceiver, 850nm Dual LC, up to 300m on OM3.',
  },
  'sfpplus-10g-lr': {
    id: 'sfpplus-10g-lr',
    modelName: 'MikroTik S+31DLC10D (10G LR)',
    formFactor: 'SFP+',
    speed: '10G',
    fiberType: 'smf',
    wavelengthNm: 1310,
    connector: 'LC Duplex',
    maxDistanceMeters: 10000,
    compatiblePeerTransceivers: ['sfpplus-10g-lr'],
    description: '10Gbps Single-Mode SFP+ transceiver, 1310nm Dual LC, up to 10km on OS2.',
  },
  'sfpplus-10g-er': {
    id: 'sfpplus-10g-er',
    modelName: 'MikroTik S+55DLC40D (10G ER)',
    formFactor: 'SFP+',
    speed: '10G',
    fiberType: 'smf',
    wavelengthNm: 1550,
    connector: 'LC Duplex',
    maxDistanceMeters: 40000,
    compatiblePeerTransceivers: ['sfpplus-10g-er'],
    description: '10Gbps Extra-Range Single-Mode SFP+, 1550nm Dual LC, 40km reach.',
  },
  'sfpplus-10g-bidi-u': {
    id: 'sfpplus-10g-bidi-u',
    modelName: 'MikroTik S+23LC10D (10G BiDi Up)',
    formFactor: 'SFP+',
    speed: '10G',
    fiberType: 'smf',
    txWavelengthNm: 1270,
    rxWavelengthNm: 1330,
    connector: 'LC Simplex (BiDi)',
    maxDistanceMeters: 10000,
    compatiblePeerTransceivers: ['sfpplus-10g-bidi-d'],
    description: '10G Single-Strand BiDi SFP+, Tx 1270nm / Rx 1330nm. Must mate with BiDi Down (1330/1270).',
  },
  'sfpplus-10g-bidi-d': {
    id: 'sfpplus-10g-bidi-d',
    modelName: 'MikroTik S+32LC10D (10G BiDi Down)',
    formFactor: 'SFP+',
    speed: '10G',
    fiberType: 'smf',
    txWavelengthNm: 1330,
    rxWavelengthNm: 1270,
    connector: 'LC Simplex (BiDi)',
    maxDistanceMeters: 10000,
    compatiblePeerTransceivers: ['sfpplus-10g-bidi-u'],
    description: '10G Single-Strand BiDi SFP+, Tx 1330nm / Rx 1270nm. Must mate with BiDi Up (1270/1330).',
  },
  'sfpplus-10g-rj45': {
    id: 'sfpplus-10g-rj45',
    modelName: 'MikroTik S+RJ10 (10G RJ45)',
    formFactor: 'SFP+',
    speed: '10G',
    fiberType: 'copper',
    connector: 'RJ45',
    maxDistanceMeters: 30,
    compatiblePeerTransceivers: ['sfpplus-10g-rj45'],
    description: '10G Copper module for SFP+ slots, operates at 10M-10G speeds up to 30m on Cat6A.',
  },
};
