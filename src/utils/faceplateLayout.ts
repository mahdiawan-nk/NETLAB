import { DeviceInterface, NetworkDevice } from '../types/network';

// ==========================================
// Faceplate Visual & Geometry Constants
// ==========================================
export const FACEPLATE_METRICS = {
  PORT_W: 32,
  PORT_H: 22,
  PORT_GAP_X: 6,
  PORT_GAP_Y: 6,
  BLOCK_PAD_X: 8,
  BLOCK_PAD_Y: 8,
  CARD_PAD_X: 12,
  CARD_PAD_TOP: 10,
  CARD_PAD_BOTTOM: 12,
  HEADER_H: 36,
  CPE_RIBBON_MT: 6,
  CPE_RIBBON_H: 20,
  DIVIDER_OFFSET_Y: 17, // mt-2 (8px) + 1px border + pt-2 (8px)
  BLOCK_LABEL_H: 16,
  BLOCK_LABEL_MB: 4,
  BLOCK_GAP_Y: 10,
  MIN_CARD_WIDTH: 268,
} as const;

export interface FaceplateBlockGrid {
  interfaces: DeviceInterface[];
  count: number;
  columns: number;
  rows: number;
  blockWidth: number;
  blockHeight: number;
  boxTopY: number; // relative to device.y
}

export interface PortCoordinate {
  x: number; // absolute canvas X (center of port button)
  y: number; // absolute canvas Y (center of port button)
  relX: number; // relative to device.x
  relY: number; // relative to device.y
  blockType: 'ethernet' | 'optical';
  col: number;
  row: number;
}

export interface DeviceFaceplateLayout {
  cardWidth: number;
  cardHeight: number;
  ethernetBlock: FaceplateBlockGrid;
  opticalBlock: FaceplateBlockGrid;
  wirelessInterfaces: DeviceInterface[];
  portCoordsById: Record<string, PortCoordinate>;
}

/**
 * Determines if an interface belongs to BLOCK B (SFP / SFP+ / SFP28 / QSFP Optical Block).
 */
export function isOpticalInterface(iface: DeviceInterface): boolean {
  const t = (iface.type || '').toLowerCase();
  const n = (iface.name || '').toLowerCase();

  if (
    t === 'sfp' ||
    t === 'sfp-plus' ||
    t === 'sfp28' ||
    t === 'qsfp28' ||
    t.includes('sfp') ||
    t.includes('qsfp') ||
    t.includes('optical') ||
    t.includes('fiber') ||
    t.includes('pon')
  ) {
    return true;
  }

  if (
    n.startsWith('sfp') ||
    n.startsWith('qsfp') ||
    n.startsWith('pon') ||
    n.startsWith('opt') ||
    n.startsWith('xe-')
  ) {
    return true;
  }

  return false;
}

/**
 * Determines if an interface is wireless or logical/console and should not be rendered
 * as a physical RJ45/Optical faceplate port.
 */
export function isNonFaceplateInterface(iface: DeviceInterface): boolean {
  const t = (iface.type || '').toLowerCase();
  const n = (iface.name || '').toLowerCase();

  if (
    t === 'wireless' ||
    t === 'bridge' ||
    t === 'vlan' ||
    t === 'console' ||
    t === 'serial' ||
    t === 'usb'
  ) {
    return true;
  }

  if (
    n.startsWith('wlan') ||
    n.startsWith('wifi') ||
    n.startsWith('bridge') ||
    n.startsWith('vlan') ||
    n.startsWith('console') ||
    n.startsWith('usb')
  ) {
    return true;
  }

  return false;
}

/**
 * Computes dynamic columns and rows for an interface block.
 * - Maximum 2 rows.
 * - Up to 8 ports: 1 row of N columns (e.g. 1->1x1, 2->2x1, 4->4x1, 5->5x1, 8->8x1).
 * - More than 8 ports: columns = Math.ceil(count / 2), rows = Math.ceil(count / columns) (always 2 rows).
 */
export function computeBlockGridDimensions(count: number): { columns: number; rows: number } {
  if (count <= 0) return { columns: 0, rows: 0 };
  if (count <= 8) {
    return { columns: count, rows: 1 };
  }
  const columns = Math.ceil(count / 2);
  const rows = Math.min(2, Math.ceil(count / columns));
  return { columns, rows };
}

/**
 * Formats concise port label for faceplate buttons:
 * - Ethernet block: 2-digit number e.g. "01", "02", "17", "48" (or short code like "MG" for mgmt without number)
 * - Optical block: concise label e.g. "SFP1", "SFP2", "25G1", "QSFP1"
 */
export function formatFaceplatePortLabel(
  iface: DeviceInterface,
  blockType: 'ethernet' | 'optical',
  indexInBlock: number
): string {
  const rawName = (iface.name || '').trim();
  const lower = rawName.toLowerCase();

  if (blockType === 'optical') {
    // Extract trailing number if present
    const numMatch = rawName.match(/(\d+)\s*$/);
    const numStr = numMatch ? numMatch[1] : String(indexInBlock + 1);

    if (lower.includes('qsfp')) {
      return `QS${numStr}`;
    }
    if (lower.includes('sfp28') || iface.type === 'sfp28') {
      return `S28-${numStr}`;
    }
    if (lower.startsWith('pon')) {
      return `PON${numStr}`;
    }
    return `SFP${numStr}`;
  }

  // Ethernet block
  if (lower.includes('combo')) {
    const numMatch = rawName.match(/(\d+)/);
    return numMatch ? `CB${numMatch[1]}` : 'CMB';
  }
  if (lower === 'ilo' || lower === 'mgmt' || lower === 'idrac') {
    return 'MGMT';
  }

  // Extract the last number group (e.g. "ether1" -> "01", "ge-0/0/24" -> "24")
  const allNumbers = rawName.match(/\d+/g);
  if (allNumbers && allNumbers.length > 0) {
    const lastNum = parseInt(allNumbers[allNumbers.length - 1], 10);
    if (!isNaN(lastNum)) {
      return String(lastNum).padStart(2, '0');
    }
  }

  return String(indexInBlock + 1).padStart(2, '0');
}

/**
 * Computes complete deterministic geometry for a NetworkDevice's faceplate blocks,
 * dynamic card width/height, and exact port connection anchor coordinates.
 */
export function getDeviceFaceplateLayout(
  device: NetworkDevice,
  hasLinkedCircuit: boolean = false
): DeviceFaceplateLayout {
  const M = FACEPLATE_METRICS;

  const ethernetInterfaces: DeviceInterface[] = [];
  const opticalInterfaces: DeviceInterface[] = [];
  const wirelessInterfaces: DeviceInterface[] = [];

  for (const iface of device.interfaces) {
    if (isNonFaceplateInterface(iface)) {
      if ((iface.type || '').toLowerCase() === 'wireless' || iface.name.toLowerCase().startsWith('wlan') || iface.name.toLowerCase().startsWith('wifi')) {
        wirelessInterfaces.push(iface);
      }
      continue;
    }
    if (isOpticalInterface(iface)) {
      opticalInterfaces.push(iface);
    } else {
      ethernetInterfaces.push(iface);
    }
  }

  const ethDim = computeBlockGridDimensions(ethernetInterfaces.length);
  const sfpDim = computeBlockGridDimensions(opticalInterfaces.length);

  const ethBlockWidth =
    ethDim.columns > 0
      ? ethDim.columns * M.PORT_W + (ethDim.columns - 1) * M.PORT_GAP_X + M.BLOCK_PAD_X * 2
      : 0;
  const ethBlockHeight =
    ethDim.rows > 0
      ? ethDim.rows * M.PORT_H + (ethDim.rows - 1) * M.PORT_GAP_Y + M.BLOCK_PAD_Y * 2
      : 0;

  const sfpBlockWidth =
    sfpDim.columns > 0
      ? sfpDim.columns * M.PORT_W + (sfpDim.columns - 1) * M.PORT_GAP_X + M.BLOCK_PAD_X * 2
      : 0;
  const sfpBlockHeight =
    sfpDim.rows > 0
      ? sfpDim.rows * M.PORT_H + (sfpDim.rows - 1) * M.PORT_GAP_Y + M.BLOCK_PAD_Y * 2
      : 0;

  const widestBlockWidth = Math.max(ethBlockWidth, sfpBlockWidth, 0);
  const cardWidth = Math.max(M.MIN_CARD_WIDTH, widestBlockWidth + M.CARD_PAD_X * 2);

  // Vertical layout progression
  let cursorY = M.CARD_PAD_TOP + M.HEADER_H;
  if (hasLinkedCircuit) {
    cursorY += M.CPE_RIBBON_MT + M.CPE_RIBBON_H;
  }
  cursorY += M.DIVIDER_OFFSET_Y;

  const portCoordsById: Record<string, PortCoordinate> = {};

  // Block A: Ethernet
  let ethBoxTopY = cursorY;
  if (ethernetInterfaces.length > 0) {
    cursorY += M.BLOCK_LABEL_H + M.BLOCK_LABEL_MB;
    ethBoxTopY = cursorY;

    ethernetInterfaces.forEach((iface, idx) => {
      const col = idx % ethDim.columns;
      const row = Math.floor(idx / ethDim.columns);
      const relX = M.CARD_PAD_X + M.BLOCK_PAD_X + col * (M.PORT_W + M.PORT_GAP_X) + M.PORT_W / 2;
      const relY = ethBoxTopY + M.BLOCK_PAD_Y + row * (M.PORT_H + M.PORT_GAP_Y) + M.PORT_H / 2;

      portCoordsById[iface.id] = {
        x: device.x + relX,
        y: device.y + relY,
        relX,
        relY,
        blockType: 'ethernet',
        col,
        row,
      };
    });

    cursorY += ethBlockHeight;
  }

  // Gap between Block A and Block B if both exist
  if (ethernetInterfaces.length > 0 && opticalInterfaces.length > 0) {
    cursorY += M.BLOCK_GAP_Y;
  }

  // Block B: Optical SFP / SFP+
  let sfpBoxTopY = cursorY;
  if (opticalInterfaces.length > 0) {
    cursorY += M.BLOCK_LABEL_H + M.BLOCK_LABEL_MB;
    sfpBoxTopY = cursorY;

    opticalInterfaces.forEach((iface, idx) => {
      const col = idx % sfpDim.columns;
      const row = Math.floor(idx / sfpDim.columns);
      const relX = M.CARD_PAD_X + M.BLOCK_PAD_X + col * (M.PORT_W + M.PORT_GAP_X) + M.PORT_W / 2;
      const relY = sfpBoxTopY + M.BLOCK_PAD_Y + row * (M.PORT_H + M.PORT_GAP_Y) + M.PORT_H / 2;

      portCoordsById[iface.id] = {
        x: device.x + relX,
        y: device.y + relY,
        relX,
        relY,
        blockType: 'optical',
        col,
        row,
      };
    });

    cursorY += sfpBlockHeight;
  }

  // Fallback if device has no Ethernet and no Optical interfaces
  if (ethernetInterfaces.length === 0 && opticalInterfaces.length === 0) {
    cursorY += 28;
  }

  const cardHeight = cursorY + M.CARD_PAD_BOTTOM;

  return {
    cardWidth,
    cardHeight,
    ethernetBlock: {
      interfaces: ethernetInterfaces,
      count: ethernetInterfaces.length,
      columns: ethDim.columns,
      rows: ethDim.rows,
      blockWidth: ethBlockWidth,
      blockHeight: ethBlockHeight,
      boxTopY: ethBoxTopY,
    },
    opticalBlock: {
      interfaces: opticalInterfaces,
      count: opticalInterfaces.length,
      columns: sfpDim.columns,
      rows: sfpDim.rows,
      blockWidth: sfpBlockWidth,
      blockHeight: sfpBlockHeight,
      boxTopY: sfpBoxTopY,
    },
    wirelessInterfaces,
    portCoordsById,
  };
}
