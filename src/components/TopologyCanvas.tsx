import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { DeviceInterface, NetworkDevice, OperationalStatus } from '../types/network';
import {
  FACEPLATE_METRICS,
  formatFaceplatePortLabel,
  getDeviceFaceplateLayout,
} from '../utils/faceplateLayout';
import { hasRouterOsSupport } from '../services/routerOsConfigService';
import {
  Server,
  Router,
  Layers,
  Wifi,
  Globe,
  Monitor,
  Trash2,
  Copy,
  AlertCircle,
  Activity,
  Cable,
  X,
  PanelLeftOpen,
  PanelLeftClose,
  PanelRightOpen,
  PanelRightClose,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Hand,
  MousePointer,
  Grid,
  LayoutGrid,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Focus,
  HelpCircle,
} from 'lucide-react';

interface TopologyCanvasProps {
  isSidebarOpen?: boolean;
  isInspectorOpen?: boolean;
  onToggleSidebar?: () => void;
  onToggleInspector?: () => void;
  onToggleFullCanvas?: () => void;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  isSidebarOpen = true,
  isInspectorOpen = true,
  onToggleSidebar,
  onToggleInspector,
  onToggleFullCanvas,
}) => {
  const {
    activeProject,
    selectedDeviceId,
    selectedLinkId,
    selectedInterfaceId,
    connectingFrom,
    activePacketTrace,
    clearPacketTrace,
    trafficStats,
    setSelectedDevice,
    setSelectedLink,
    setSelectedInterface,
    setConnectingFrom,
    setPendingConnectionModal,
    updateDevicePosition,
    removeDevice,
    removeLink,
    setViewport,
    addDevice,
    openRouterConsole,
    openUserGuide,
    customDevices,
  } = useNetworkStore();

  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & Drag states
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingDevice, setDraggingDevice] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState({ x: 0, y: 0 });

  // Interactive Canvas Modes
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select');
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [canvasNotice, setCanvasNotice] = useState<string | null>(null);

  const viewport = activeProject.viewport || { x: 0, y: 0, zoom: 1 };
  const isFullCanvas = !isSidebarOpen && !isInspectorOpen;

  const showNotice = useCallback((msg: string) => {
    setCanvasNotice(msg);
    setTimeout(() => {
      setCanvasNotice((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Convert client mouse coords to canvas coords
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const x = (clientX - rect.left - viewport.x) / viewport.zoom;
      const y = (clientY - rect.top - viewport.y) / viewport.zoom;
      return { x, y };
    },
    [viewport]
  );

  // Pan by delta pixels
  const panBy = useCallback(
    (dx: number, dy: number) => {
      setViewport({
        ...viewport,
        x: Math.round(viewport.x + dx),
        y: Math.round(viewport.y + dy),
      });
    },
    [viewport, setViewport]
  );

  // Zoom helper centered on viewport
  const zoomTo = useCallback(
    (targetZoom: number) => {
      const clampedZoom = Math.min(Math.max(targetZoom, 0.35), 2.5);
      if (!containerRef.current) {
        setViewport({ ...viewport, zoom: clampedZoom });
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const newX = Math.round(centerX - (centerX - viewport.x) * (clampedZoom / viewport.zoom));
      const newY = Math.round(centerY - (centerY - viewport.y) * (clampedZoom / viewport.zoom));

      setViewport({ x: newX, y: newY, zoom: Number(clampedZoom.toFixed(2)) });
    },
    [viewport, setViewport]
  );

  // Fit all devices to current canvas screen using their dynamic faceplate dimensions
  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current || activeProject.devices.length === 0) {
      setViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const padding = 90;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    activeProject.devices.forEach((d) => {
      const hasCircuit = (activeProject.circuits || []).some((c) => c.cpeDeviceId === d.id);
      const layout = getDeviceFaceplateLayout(d, hasCircuit);
      if (d.x < minX) minX = d.x;
      if (d.y - 45 < minY) minY = d.y - 45;
      if (d.x + layout.cardWidth > maxX) maxX = d.x + layout.cardWidth;
      if (d.y + layout.cardHeight > maxY) maxY = d.y + layout.cardHeight;
    });

    const contentW = Math.max(300, maxX - minX);
    const contentH = Math.max(200, maxY - minY);

    const scaleX = (rect.width - padding * 2) / contentW;
    const scaleY = (rect.height - padding * 2) / contentH;
    const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.4), 1.25);

    const centerContentX = minX + contentW / 2;
    const centerContentY = minY + contentH / 2;

    const newX = Math.round(rect.width / 2 - centerContentX * nextZoom);
    const newY = Math.round(rect.height / 2 - centerContentY * nextZoom);

    setViewport({ x: newX, y: newY, zoom: Number(nextZoom.toFixed(2)) });
  }, [activeProject.devices, activeProject.circuits, setViewport]);

  // Auto-Arrange Topology by network tier accounting for dynamic device widths
  const handleAutoArrange = useCallback(() => {
    if (activeProject.devices.length === 0) return;

    const tiers: Record<number, NetworkDevice[]> = { 0: [], 1: [], 2: [], 3: [] };
    activeProject.devices.forEach((dev) => {
      const cat = dev.category.toLowerCase();
      if (cat.includes('wan') || cat.includes('isp') || cat.includes('modem') || cat.includes('ont')) {
        tiers[0].push(dev);
      } else if (cat.includes('router') || cat.includes('firewall')) {
        tiers[1].push(dev);
      } else if (cat.includes('switch')) {
        tiers[2].push(dev);
      } else {
        tiers[3].push(dev);
      }
    });

    let currentY = 72;
    [0, 1, 2, 3].forEach((tierIdx) => {
      const rowDevs = tiers[tierIdx];
      if (rowDevs.length === 0) return;

      const layouts = rowDevs.map((dev) => {
        const hasCircuit = (activeProject.circuits || []).some((c) => c.cpeDeviceId === dev.id);
        return getDeviceFaceplateLayout(dev, hasCircuit);
      });

      const gapX = 48;
      const totalRowWidth =
        layouts.reduce((acc, l) => acc + l.cardWidth, 0) + Math.max(0, rowDevs.length - 1) * gapX;
      let cursorX = Math.max(72, Math.round(540 - totalRowWidth / 2));
      let maxRowHeight = 140;

      rowDevs.forEach((dev, idx) => {
        const l = layouts[idx];
        const targetX = Math.round(cursorX / 24) * 24;
        const targetY = Math.round(currentY / 24) * 24;
        updateDevicePosition(dev.id, targetX, targetY);
        cursorX += l.cardWidth + gapX;
        if (l.cardHeight > maxRowHeight) maxRowHeight = l.cardHeight;
      });

      currentY += maxRowHeight + 72;
    });

    showNotice('Topologi berhasil dirapikan secara otomatis berdasarkan layer jaringan.');
    setTimeout(() => handleFitToScreen(), 60);
  }, [activeProject.devices, activeProject.circuits, updateDevicePosition, handleFitToScreen, showNotice]);

  // Handle Canvas Background Mouse Down (Pan Left / Right / Up / Down)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const isMiddleClick = e.button === 1;
    const isLeftClick = e.button === 0;

    if (isMiddleClick || (isLeftClick && (interactionMode === 'pan' || isSpacePressed))) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
      return;
    }

    if (isLeftClick) {
      setSelectedDevice(null);
      setSelectedLink(null);
      if (connectingFrom) setConnectingFrom(null);

      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = screenToCanvas(e.clientX, e.clientY);
    setMouseCanvasPos(coords);
  };

  // Global window mousemove / mouseup for smooth uninterrupted panning & device dragging
  useEffect(() => {
    if (!isPanning && !draggingDevice) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        setViewport({
          ...viewport,
          x: Math.round(e.clientX - panStart.x),
          y: Math.round(e.clientY - panStart.y),
        });
      } else if (draggingDevice) {
        const coords = screenToCanvas(e.clientX, e.clientY);
        const rawX = coords.x - draggingDevice.offsetX;
        const rawY = coords.y - draggingDevice.offsetY;
        const finalX = snapToGrid ? Math.round(rawX / 24) * 24 : Math.round(rawX);
        const finalY = snapToGrid ? Math.round(rawY / 24) * 24 : Math.round(rawY);
        updateDevicePosition(draggingDevice.id, finalX, finalY);
      }
    };

    const handleWindowMouseUp = () => {
      setIsPanning(false);
      setDraggingDevice(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isPanning, draggingDevice, panStart, viewport, setViewport, screenToCanvas, snapToGrid, updateDevicePosition]);

  // Wheel zoom or trackpad pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    if (e.shiftKey) {
      panBy(-e.deltaY, 0);
      return;
    }

    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const nextZoom = Math.min(Math.max(viewport.zoom * zoomFactor, 0.35), 2.5);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newX = Math.round(mouseX - (mouseX - viewport.x) * (nextZoom / viewport.zoom));
      const newY = Math.round(mouseY - (mouseY - viewport.y) * (nextZoom / viewport.zoom));

      setViewport({ x: newX, y: newY, zoom: Number(nextZoom.toFixed(2)) });
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      const panStep = e.shiftKey ? 120 : 60;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        panBy(0, panStep);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        panBy(0, -panStep);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        panBy(panStep, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        panBy(-panStep, 0);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomTo(viewport.zoom + 0.12);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomTo(viewport.zoom - 0.12);
      } else if (e.key === '0') {
        e.preventDefault();
        setViewport({ x: 0, y: 0, zoom: 1 });
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleFitToScreen();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDeviceId) removeDevice(selectedDeviceId);
        if (selectedLinkId) removeLink(selectedLinkId);
      } else if (e.key === 'Escape') {
        setConnectingFrom(null);
        setSelectedDevice(null);
        setSelectedLink(null);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    selectedDeviceId,
    selectedLinkId,
    removeDevice,
    removeLink,
    setConnectingFrom,
    setSelectedDevice,
    setSelectedLink,
    panBy,
    zoomTo,
    viewport.zoom,
    setViewport,
    handleFitToScreen,
  ]);

  // Handle Port Click (Select Port + Connection Workflow)
  const handlePortClick = (e: React.MouseEvent, device: NetworkDevice, ifaceId: string) => {
    e.stopPropagation();

    setSelectedDevice(device.id);
    setSelectedInterface(ifaceId);

    const isPortOccupied = activeProject.links.some(
      (l) => l.sourceInterfaceId === ifaceId || l.targetInterfaceId === ifaceId
    );

    if (connectingFrom) {
      if (connectingFrom.sourceDeviceId === device.id && connectingFrom.sourceInterfaceId === ifaceId) {
        setConnectingFrom(null);
        return;
      }

      if (connectingFrom.sourceDeviceId === device.id) {
        showNotice('Tidak dapat menghubungkan dua port pada perangkat yang sama secara langsung.');
        setConnectingFrom(null);
        return;
      }

      if (isPortOccupied) {
        showNotice('Port tujuan sudah terhubung ke kabel lain. Lepaskan link terlebih dahulu.');
        return;
      }

      setPendingConnectionModal({
        sourceDeviceId: connectingFrom.sourceDeviceId,
        sourceInterfaceId: connectingFrom.sourceInterfaceId,
        targetDeviceId: device.id,
        targetInterfaceId: ifaceId,
      });
      setConnectingFrom(null);
    } else {
      if (isPortOccupied) {
        showNotice('Port ini sudah terhubung. Klik garis kabel untuk menginspeksi atau memutus koneksi.');
        return;
      }
      setConnectingFrom({ sourceDeviceId: device.id, sourceInterfaceId: ifaceId });
    }
  };

  const getStatusColor = (status: OperationalStatus) => {
    switch (status) {
      case 'RUN':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'DEGRADED':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'DIE':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'DISABLED':
        return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  const getDeviceIcon = (category: string) => {
    switch (category) {
      case 'router':
        return <Router className="w-4 h-4 text-cyan-400" />;
      case 'switch':
        return <Layers className="w-4 h-4 text-emerald-400" />;
      case 'wireless':
        return <Wifi className="w-4 h-4 text-amber-400" />;
      case 'wan':
        return <Globe className="w-4 h-4 text-sky-400" />;
      case 'server':
        return <Server className="w-4 h-4 text-purple-400" />;
      default:
        return <Monitor className="w-4 h-4 text-indigo-400" />;
    }
  };

  // Calculate exact coordinates for connection ports by Interface ID (never raw array index)
  const getPortCoordinates = useCallback(
    (deviceId: string, ifaceId: string) => {
      const dev = activeProject.devices.find((d) => d.id === deviceId);
      if (!dev) {
        return { x: 0, y: 0, devCenterX: 0, devCenterY: 0, cardBottomY: 0, cardTopY: 0 };
      }

      const hasLinkedCircuit = (activeProject.circuits || []).some((c) => c.cpeDeviceId === dev.id);
      const layout = getDeviceFaceplateLayout(dev, hasLinkedCircuit);

      let coord = layout.portCoordsById[ifaceId];
      if (!coord) {
        // Fallback lookup if link stored short interface name
        const matchedIface = dev.interfaces.find(
          (i) => i.id === ifaceId || i.name === ifaceId || i.id.endsWith(`_${ifaceId}`)
        );
        if (matchedIface && layout.portCoordsById[matchedIface.id]) {
          coord = layout.portCoordsById[matchedIface.id];
        }
      }

      const devCenterX = dev.x + layout.cardWidth / 2;
      const devCenterY = dev.y + layout.cardHeight / 2;
      const cardBottomY = dev.y + layout.cardHeight;
      const cardTopY = dev.y;

      if (!coord) {
        return {
          x: devCenterX,
          y: cardBottomY - 12,
          devCenterX,
          devCenterY,
          cardBottomY,
          cardTopY,
        };
      }

      return {
        x: coord.x,
        y: coord.y,
        devCenterX,
        devCenterY,
        cardBottomY,
        cardTopY,
      };
    },
    [activeProject.devices, activeProject.circuits]
  );

  // Compute smooth Bezier path that exits from the faceplate bottom so links never cut across device headers
  const computeLinkBezierPath = (
    srcCoord: ReturnType<typeof getPortCoordinates>,
    tgtCoord: ReturnType<typeof getPortCoordinates>
  ) => {
    const dx = tgtCoord.x - srcCoord.x;
    const dy = tgtCoord.y - srcCoord.y;
    const dist = Math.hypot(dx, dy);
    const pull = Math.min(70, Math.max(28, dist * 0.25));

    // Control points exit downwards past the bottom edge of each device card
    const cp1X = srcCoord.x + dx * 0.12;
    const cp1Y = Math.max(srcCoord.y + pull, srcCoord.cardBottomY + 20);

    const cp2X = tgtCoord.x - dx * 0.12;
    const cp2Y = Math.max(tgtCoord.y + pull, tgtCoord.cardBottomY + 20);

    const pathData = `M ${srcCoord.x} ${srcCoord.y} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${tgtCoord.x} ${tgtCoord.y}`;

    // Approximate bezier midpoint at t = 0.5
    const midX = 0.125 * srcCoord.x + 0.375 * cp1X + 0.375 * cp2X + 0.125 * tgtCoord.x;
    const midY = 0.125 * srcCoord.y + 0.375 * cp1Y + 0.375 * cp2Y + 0.125 * tgtCoord.y;

    return { pathData, midX, midY };
  };

  // Render individual port button inside either Block A (Ethernet) or Block B (SFP/SFP+)
  const renderPortButton = (
    device: NetworkDevice,
    iface: DeviceInterface,
    blockType: 'ethernet' | 'optical',
    indexInBlock: number
  ) => {
    const connectedLink = activeProject.links.find(
      (l) => l.sourceInterfaceId === iface.id || l.targetInterfaceId === iface.id
    );
    const isConnected = Boolean(connectedLink);
    const isConnectingSource =
      connectingFrom?.sourceDeviceId === device.id &&
      connectingFrom?.sourceInterfaceId === iface.id;
    const isSelectedPort =
      selectedDeviceId === device.id && selectedInterfaceId === iface.id;

    const isAdminDown = iface.adminState === 'down' || iface.operationalState === 'DISABLED';
    const isError =
      !isAdminDown &&
      (iface.operationalState === 'DIE' ||
        connectedLink?.status === 'DIE' ||
        iface.operationalState === 'DEGRADED' ||
        connectedLink?.status === 'DEGRADED');

    const isOptical = blockType === 'optical';
    const shortLabel = formatFaceplatePortLabel(iface, blockType, indexInBlock);

    let statusText = 'Available';
    if (isAdminDown) {
      statusText = 'Disabled (Admin Down)';
    } else if (isError) {
      statusText = `Error / Degraded (${connectedLink?.status || iface.operationalState})`;
    } else if (isConnected) {
      statusText = `Connected · Running (${connectedLink?.speed || iface.speed})`;
    }

    const tooltip = `${iface.name} · Type: ${iface.type.toUpperCase()} · Speed: ${iface.speed}${
      iface.ipAddress ? ` · IP: ${iface.ipAddress}` : ''
    } · Status: ${statusText}`;

    // Visual classes per NETLAB standard
    let buttonStyleClass = '';
    let ledStyleClass = '';

    if (isConnectingSource) {
      buttonStyleClass = 'bg-cyan-500/30 ring-2 ring-cyan-400 border border-cyan-300 text-white animate-pulse';
      ledStyleClass = 'bg-cyan-300 shadow-xs shadow-cyan-300';
    } else if (isAdminDown) {
      buttonStyleClass = 'bg-slate-900/50 border border-slate-800/80 text-slate-600 opacity-60 hover:opacity-90';
      ledStyleClass = 'bg-slate-700';
    } else if (isError) {
      buttonStyleClass = 'bg-rose-500/20 border border-rose-500/50 text-rose-300 hover:bg-rose-500/30';
      ledStyleClass = 'bg-rose-400 shadow-xs shadow-rose-400 animate-pulse';
    } else if (isConnected) {
      if (isOptical) {
        buttonStyleClass = 'bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500/30';
        ledStyleClass = 'bg-amber-400 shadow-xs shadow-amber-400';
      } else {
        buttonStyleClass = 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30';
        ledStyleClass = 'bg-emerald-400 shadow-xs shadow-emerald-400';
      }
    } else {
      // Available (Unconnected)
      if (isOptical) {
        buttonStyleClass =
          'bg-slate-900/95 hover:bg-slate-800 border border-amber-500/25 hover:border-amber-400/50 text-amber-200/80';
        ledStyleClass = 'bg-amber-500/40';
      } else {
        buttonStyleClass =
          'bg-slate-800/90 hover:bg-slate-700 border border-slate-700/70 hover:border-slate-500 text-slate-300';
        ledStyleClass = 'bg-slate-500';
      }
    }

    if (isSelectedPort && !isConnectingSource) {
      buttonStyleClass += ' ring-1 ring-cyan-400';
    }

    return (
      <button
        key={iface.id}
        type="button"
        onClick={(e) => handlePortClick(e, device, iface.id)}
        title={tooltip}
        style={{
          width: `${FACEPLATE_METRICS.PORT_W}px`,
          height: `${FACEPLATE_METRICS.PORT_H}px`,
        }}
        className={`rounded flex flex-col items-center justify-center relative transition-all shrink-0 group/port ${buttonStyleClass}`}
      >
        {/* Status LED dot */}
        <div className={`w-1.5 h-1 rounded-full mb-0.5 ${ledStyleClass}`} />
        <span className="text-[7.5px] font-mono font-semibold leading-none tracking-tighter truncate max-w-[30px]">
          {shortLabel}
        </span>
      </button>
    );
  };

  const canvasCursorClass = isPanning
    ? 'cursor-grabbing'
    : interactionMode === 'pan' || isSpacePressed
    ? 'cursor-grab'
    : 'cursor-grab active:cursor-grabbing';

  return (
    <div
      ref={containerRef}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      className={`flex-1 h-full relative overflow-hidden bg-slate-950 select-none ${canvasCursorClass}`}
      style={{
        backgroundImage: `radial-gradient(rgba(51, 65, 85, 0.38) 1.25px, transparent 1.25px)`,
        backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
    >
      {/* Top-Left Panel Toggle Pill (Sidebar Hide/Show) */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute top-3 left-3 z-30 flex items-center gap-1.5 pointer-events-auto"
      >
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title={isSidebarOpen ? 'Sembunyikan Sidebar Kiri' : 'Tampilkan Sidebar Katalog Perangkat'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shadow-lg backdrop-blur-md transition-all ${
              isSidebarOpen
                ? 'bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                : 'bg-cyan-950/90 border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/80'
            }`}
          >
            {isSidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
            <span>{isSidebarOpen ? 'Hide Sidebar' : 'Show Catalog'}</span>
          </button>
        )}
      </div>

      {/* Top-Right Panel Toggle Pills (Guide, Full Canvas & Inspector Hide/Show) */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute top-3 right-3 z-30 flex items-center gap-1.5 pointer-events-auto"
      >
        <button
          type="button"
          onClick={() => openUserGuide('topology-editor')}
          title="Panduan Topology Editor & Navigasi Canvas"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-slate-900/90 border-slate-800 text-cyan-400 hover:text-cyan-300 hover:border-cyan-500/40 text-xs font-semibold shadow-lg backdrop-blur-md transition-all"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Canvas Help</span>
        </button>

        {onToggleFullCanvas && (
          <button
            type="button"
            onClick={onToggleFullCanvas}
            title={isFullCanvas ? 'Kembalikan Panel Samping' : 'Perluas Canvas Penuh (Sembunyikan Sidebar & Inspector)'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shadow-lg backdrop-blur-md transition-all ${
              isFullCanvas
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
                : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
            }`}
          >
            {isFullCanvas ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullCanvas ? 'Exit Full Canvas' : 'Full Canvas'}</span>
          </button>
        )}

        {onToggleInspector && (
          <button
            type="button"
            onClick={onToggleInspector}
            title={isInspectorOpen ? 'Sembunyikan Inspector Panel' : 'Tampilkan Inspector Panel'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shadow-lg backdrop-blur-md transition-all ${
              isInspectorOpen
                ? 'bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                : 'bg-cyan-950/90 border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/80'
            }`}
          >
            <span>{isInspectorOpen ? 'Hide Inspector' : 'Show Inspector'}</span>
            {!isInspectorOpen && (selectedDeviceId || selectedLinkId) && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            )}
            {isInspectorOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Canvas Interactive Plane */}
      <div
        className="absolute inset-0 origin-top-left pointer-events-none"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {/* Origin Crosshair Marker (0,0) */}
        <div
          style={{ left: '-12px', top: '-12px' }}
          className="absolute w-6 h-6 flex items-center justify-center opacity-25 pointer-events-none"
        >
          <div className="w-full h-[1px] bg-slate-500 absolute" />
          <div className="h-full w-[1px] bg-slate-500 absolute" />
        </div>

        {/* SVG Link Layer (Underlay) */}
        <svg className="absolute overflow-visible top-0 left-0 w-full h-full pointer-events-none z-10">
          <defs>
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-fiber" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Render Upstream ISP Transit Uplink Lines */}
          {(activeProject.circuits || []).map((circ) => {
            if (!circ.cpeDeviceId) return null;
            const cpeDev = activeProject.devices.find((d) => d.id === circ.cpeDeviceId);
            if (!cpeDev) return null;

            const badgeX = cpeDev.x + 120;
            const badgeY = cpeDev.y - 14;
            const modemTopX = cpeDev.x + 120;
            const modemTopY = cpeDev.y;

            return (
              <g key={`isp-uplink-${circ.id}`} className="pointer-events-none">
                <line
                  x1={badgeX}
                  y1={badgeY}
                  x2={modemTopX}
                  y2={modemTopY}
                  stroke={circ.isPrimaryWan ? '#f59e0b' : '#06b6d4'}
                  strokeWidth="2.5"
                  strokeDasharray="4 3"
                  className="animate-pulse"
                />
              </g>
            );
          })}

          {/* Render Physical Links */}
          {activeProject.links.map((link) => {
            const srcCoord = getPortCoordinates(link.sourceDeviceId, link.sourceInterfaceId);
            const tgtCoord = getPortCoordinates(link.targetDeviceId, link.targetInterfaceId);

            const { pathData, midX, midY } = computeLinkBezierPath(srcCoord, tgtCoord);

            const isSelected = selectedLinkId === link.id;
            const isFiber = link.isFiber;
            const isDead = link.status === 'DIE';

            const isTraversedByTrace = activePacketTrace?.hops.some((hop, i, arr) => {
              const nextHop = arr[i + 1];
              if (!nextHop) return false;
              return (
                (hop.deviceId === link.sourceDeviceId && nextHop.deviceId === link.targetDeviceId) ||
                (hop.deviceId === link.targetDeviceId && nextHop.deviceId === link.sourceDeviceId)
              );
            });

            const stats = trafficStats[link.id];
            const rxMb = stats ? (stats.rxBps / 1_000_000).toFixed(1) : null;
            const isCongested = stats?.isCongested;

            const strokeColor = isDead
              ? '#ef4444'
              : isCongested
              ? '#f97316'
              : link.mediaType === 'fiber-smf'
              ? '#eab308' // Yellow OS2
              : link.mediaType === 'fiber-mmf'
              ? '#06b6d4' // Aqua OM3/OM4
              : '#3b82f6'; // Blue Cat6

            return (
              <g
                key={link.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLink(link.id);
                }}
                className="cursor-pointer group pointer-events-auto"
              >
                {/* Invisible wider hover hit area */}
                <path d={pathData} fill="none" stroke="transparent" strokeWidth="18" />

                {/* Packet Trace Active Glow Beam */}
                {isTraversedByTrace && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="8"
                    strokeDasharray="6 6"
                    className="animate-pulse"
                    opacity="0.95"
                  />
                )}

                {/* Outer selection / glow highlight */}
                {isSelected && !isTraversedByTrace && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="8"
                    strokeOpacity="0.4"
                  />
                )}

                {/* Base Cable Line */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isFiber ? '3.5' : '2.5'}
                  strokeDasharray={isDead ? '6 4' : undefined}
                  className="transition-all"
                />

                {/* Optical Traffic Pulse Animation on Fiber */}
                {isFiber && !isDead && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeDasharray="6 24"
                    className="animate-pulse"
                    opacity="0.9"
                  />
                )}

                {/* Midpoint Link Badge */}
                <g transform={`translate(${midX}, ${midY})`} className="pointer-events-none">
                  <rect
                    x="-55"
                    y="-11"
                    width="110"
                    height="22"
                    rx="4"
                    fill="#0f172a"
                    stroke={
                      isTraversedByTrace
                        ? '#22d3ee'
                        : isSelected
                        ? '#38bdf8'
                        : isCongested
                        ? '#f97316'
                        : '#334155'
                    }
                    strokeWidth={isTraversedByTrace ? '1.5' : '1'}
                    opacity="0.95"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill={isCongested ? '#fb923c' : strokeColor}
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="600"
                  >
                    {rxMb ? `${rxMb} Mbps · ${stats?.utilizationPercent}%` : `${link.speed} · ${link.cableLengthMeters}m`}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Render Device Nodes & Dual-Block Interface Faceplates */}
        {activeProject.devices.map((device) => {
          const isSelected = selectedDeviceId === device.id;

          const linkedCircuit = (activeProject.circuits || []).find((c) => c.cpeDeviceId === device.id);
          const linkedProvider = linkedCircuit
            ? (activeProject.ispProviders || []).find((p) => p.id === linkedCircuit.ispProviderId)
            : null;
          const cpeAssign = linkedCircuit
            ? (activeProject.cpeAssignments || []).find((a) => a.circuitId === linkedCircuit.id)
            : null;

          const layout = getDeviceFaceplateLayout(device, Boolean(linkedCircuit));
          const { ethernetBlock, opticalBlock } = layout;

          return (
            <React.Fragment key={device.id}>
              {/* Upstream ISP Transit Cloud Gateway Badge */}
              {linkedCircuit && (
                <div
                  style={{
                    left: `${device.x}px`,
                    top: `${device.y - 44}px`,
                    width: '240px',
                  }}
                  className={`absolute pointer-events-auto flex items-center justify-between px-2.5 py-1 rounded-lg bg-slate-950/95 border shadow-xl text-[10px] font-mono z-20 ${
                    linkedCircuit.isPrimaryWan ? 'border-amber-500/40 ring-1 ring-amber-500/20' : 'border-cyan-500/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        linkedCircuit.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                      }`}
                    />
                    <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <div className="truncate">
                      <span className="font-bold text-white block truncate text-[9.5px] leading-tight">
                        {linkedProvider?.name || 'Upstream ISP'}
                      </span>
                      <span className="text-cyan-300 text-[8.5px] block font-sans">
                        {linkedCircuit.downloadBandwidth}
                        {linkedCircuit.downloadUnit} ↓ · {linkedCircuit.serviceType}
                      </span>
                    </div>
                  </div>
                  {linkedCircuit.isPrimaryWan ? (
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold text-[8.5px] border border-amber-500/30 shrink-0">
                      WAN1 PRI
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[8.5px] shrink-0 font-bold">
                      BACKUP
                    </span>
                  )}
                </div>
              )}

              {/* Device Card with Dynamic Width & Dual-Block Faceplate */}
              <div
                onClick={(e) => {
                  if (interactionMode === 'pan' || isSpacePressed) return;
                  e.stopPropagation();
                  setSelectedDevice(device.id);
                }}
                onMouseDown={(e) => {
                  if (interactionMode === 'pan' || isSpacePressed || e.button === 1) {
                    return;
                  }
                  e.stopPropagation();
                  setSelectedDevice(device.id);
                  const coords = screenToCanvas(e.clientX, e.clientY);
                  setDraggingDevice({
                    id: device.id,
                    offsetX: coords.x - device.x,
                    offsetY: coords.y - device.y,
                  });
                }}
                style={{
                  left: `${device.x}px`,
                  top: `${device.y}px`,
                  width: `${layout.cardWidth}px`,
                  height: `${layout.cardHeight}px`,
                  paddingTop: `${FACEPLATE_METRICS.CARD_PAD_TOP}px`,
                  paddingBottom: `${FACEPLATE_METRICS.CARD_PAD_BOTTOM}px`,
                  paddingLeft: `${FACEPLATE_METRICS.CARD_PAD_X}px`,
                  paddingRight: `${FACEPLATE_METRICS.CARD_PAD_X}px`,
                }}
                className={`absolute z-20 rounded-lg border bg-slate-900/95 backdrop-blur-md shadow-xl transition-shadow pointer-events-auto ${
                  interactionMode === 'pan' || isSpacePressed
                    ? 'cursor-grab active:cursor-grabbing'
                    : 'cursor-move'
                } ${
                  isSelected
                    ? 'border-cyan-400 ring-2 ring-cyan-500/20 shadow-cyan-950/50'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* DEVICE HEADER */}
                <div
                  style={{ height: `${FACEPLATE_METRICS.HEADER_H}px` }}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="p-1.5 rounded bg-slate-950 border border-slate-800 shrink-0">
                      {getDeviceIcon(device.category)}
                    </div>
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-white tracking-tight truncate leading-tight">
                        {device.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 block font-mono truncate">
                        {device.modelName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {hasRouterOsSupport(device, customDevices) && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openRouterConsole(device.id, 'terminal');
                          }}
                          title="Open RouterOS CLI Terminal"
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white font-mono text-[9px] font-bold border border-slate-700 transition-colors shadow-xs"
                        >
                          &gt;_ CLI
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openRouterConsole(device.id, 'winbox');
                          }}
                          title="Open Winbox GUI Manager"
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white font-mono text-[9px] font-bold border border-slate-700 transition-colors shadow-xs"
                        >
                          Winbox
                        </button>
                      </>
                    )}
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase font-semibold ${getStatusColor(
                        device.status
                      )}`}
                    >
                      {device.status}
                    </span>
                  </div>
                </div>

                {/* CPE Mode Ribbon if linked to Internet Circuit */}
                {linkedCircuit && (
                  <div
                    style={{
                      marginTop: `${FACEPLATE_METRICS.CPE_RIBBON_MT}px`,
                      height: `${FACEPLATE_METRICS.CPE_RIBBON_H}px`,
                    }}
                    className="flex items-center justify-between text-[9px] font-mono px-2 rounded bg-cyan-950/60 border border-cyan-800/40 text-cyan-300"
                  >
                    <span>CPE: {cpeAssign?.connectionMode.toUpperCase() || 'BRIDGE'}</span>
                    <span className="text-slate-300 truncate ml-1">{linkedCircuit.publicIp || 'DHCP WAN'}</span>
                  </div>
                )}

                {/* DUAL-BLOCK PHYSICAL INTERFACE FACEPLATE */}
                <div className="mt-2 pt-2 border-t border-slate-800/80">
                  {/* BLOCK A — ETHERNET INTERFACES */}
                  {ethernetBlock.count > 0 && (
                    <div>
                      <div
                        style={{
                          height: `${FACEPLATE_METRICS.BLOCK_LABEL_H}px`,
                          marginBottom: `${FACEPLATE_METRICS.BLOCK_LABEL_MB}px`,
                        }}
                        className="flex items-center justify-between text-[9px] font-mono"
                      >
                        <span className="text-slate-400 font-semibold tracking-wider uppercase flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                          <span>ETHERNET INTERFACES</span>
                        </span>
                        <span className="text-slate-500">
                          {ethernetBlock.count} {ethernetBlock.count === 1 ? 'Port' : 'Ports'} ({ethernetBlock.columns}×
                          {ethernetBlock.rows})
                        </span>
                      </div>

                      {/* Proportional Ethernet Block Container */}
                      <div
                        style={{
                          width: `${ethernetBlock.blockWidth}px`,
                          height: `${ethernetBlock.blockHeight}px`,
                          padding: `${FACEPLATE_METRICS.BLOCK_PAD_Y}px ${FACEPLATE_METRICS.BLOCK_PAD_X}px`,
                          gap: `${FACEPLATE_METRICS.PORT_GAP_Y}px ${FACEPLATE_METRICS.PORT_GAP_X}px`,
                          gridTemplateColumns: `repeat(${ethernetBlock.columns}, ${FACEPLATE_METRICS.PORT_W}px)`,
                        }}
                        className="grid bg-slate-950/80 rounded border border-slate-800/80 shadow-inner"
                      >
                        {ethernetBlock.interfaces.map((iface, idx) =>
                          renderPortButton(device, iface, 'ethernet', idx)
                        )}
                      </div>
                    </div>
                  )}

                  {/* BLOCK B — SFP / SFP+ INTERFACES */}
                  {opticalBlock.count > 0 && (
                    <div
                      style={{
                        marginTop: ethernetBlock.count > 0 ? `${FACEPLATE_METRICS.BLOCK_GAP_Y}px` : '0px',
                      }}
                    >
                      <div
                        style={{
                          height: `${FACEPLATE_METRICS.BLOCK_LABEL_H}px`,
                          marginBottom: `${FACEPLATE_METRICS.BLOCK_LABEL_MB}px`,
                        }}
                        className="flex items-center justify-between text-[9px] font-mono"
                      >
                        <span className="text-amber-400/90 font-semibold tracking-wider uppercase flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <span>SFP / SFP+ INTERFACES</span>
                        </span>
                        <span className="text-amber-500/70">
                          {opticalBlock.count} {opticalBlock.count === 1 ? 'Port' : 'Ports'} ({opticalBlock.columns}×
                          {opticalBlock.rows})
                        </span>
                      </div>

                      {/* Proportional SFP / SFP+ Block Container */}
                      <div
                        style={{
                          width: `${opticalBlock.blockWidth}px`,
                          height: `${opticalBlock.blockHeight}px`,
                          padding: `${FACEPLATE_METRICS.BLOCK_PAD_Y}px ${FACEPLATE_METRICS.BLOCK_PAD_X}px`,
                          gap: `${FACEPLATE_METRICS.PORT_GAP_Y}px ${FACEPLATE_METRICS.PORT_GAP_X}px`,
                          gridTemplateColumns: `repeat(${opticalBlock.columns}, ${FACEPLATE_METRICS.PORT_W}px)`,
                        }}
                        className="grid bg-slate-950/90 rounded border border-amber-500/30 shadow-inner"
                      >
                        {opticalBlock.interfaces.map((iface, idx) =>
                          renderPortButton(device, iface, 'optical', idx)
                        )}
                      </div>
                    </div>
                  )}

                  {/* Fallback if device has neither Ethernet nor Optical interfaces */}
                  {ethernetBlock.count === 0 && opticalBlock.count === 0 && (
                    <div className="h-[28px] flex items-center justify-center text-[10px] font-mono text-slate-500 bg-slate-950/60 rounded border border-slate-800/60">
                      No Physical Wired Interfaces
                    </div>
                  )}
                </div>

                {/* Floating Quick Action Pill when Selected */}
                {isSelected && (
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-md px-1.5 py-1 flex items-center gap-1 shadow-lg pointer-events-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addDevice(device.modelId, `${device.name}-COPY`, device.x + 48, device.y + 48);
                      }}
                      title="Duplicate Device"
                      className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDevice(device.id);
                      }}
                      title="Delete Device"
                      className="p-1 text-rose-400 hover:text-rose-300 hover:bg-slate-800 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}

        {/* Foreground SVG Overlay for Active Wire-in-Progress & Crisp Port Anchor Dots */}
        <svg className="absolute overflow-visible top-0 left-0 w-full h-full pointer-events-none z-30">
          {activeProject.links.map((link) => {
            const srcCoord = getPortCoordinates(link.sourceDeviceId, link.sourceInterfaceId);
            const tgtCoord = getPortCoordinates(link.targetDeviceId, link.targetInterfaceId);
            const isDead = link.status === 'DIE';
            const dotColor = isDead
              ? '#ef4444'
              : link.mediaType === 'fiber-smf'
              ? '#eab308'
              : link.mediaType === 'fiber-mmf'
              ? '#06b6d4'
              : '#3b82f6';

            return (
              <g key={`anchor-${link.id}`}>
                <circle
                  cx={srcCoord.x}
                  cy={srcCoord.y + 8}
                  r="2.5"
                  fill={dotColor}
                  stroke="#020617"
                  strokeWidth="1"
                />
                <circle
                  cx={tgtCoord.x}
                  cy={tgtCoord.y + 8}
                  r="2.5"
                  fill={dotColor}
                  stroke="#020617"
                  strokeWidth="1"
                />
              </g>
            );
          })}

          {connectingFrom &&
            (() => {
              const srcCoord = getPortCoordinates(connectingFrom.sourceDeviceId, connectingFrom.sourceInterfaceId);
              return (
                <path
                  d={`M ${srcCoord.x} ${srcCoord.y} L ${mouseCanvasPos.x} ${mouseCanvasPos.y}`}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeDasharray="5 5"
                  className="animate-pulse"
                />
              );
            })()}
        </svg>
      </div>

      {/* Inline Toast Notice Banner */}
      {canvasNotice && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute top-14 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-amber-500/60 text-amber-200 px-3.5 py-2 rounded-lg text-xs font-medium shadow-2xl flex items-center gap-2 pointer-events-auto z-40"
        >
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{canvasNotice}</span>
          <button
            onClick={() => setCanvasNotice(null)}
            className="p-0.5 text-slate-400 hover:text-white rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Instructions Banner when Connecting */}
      {connectingFrom && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-cyan-950/90 border border-cyan-500/60 text-cyan-200 px-4 py-2 rounded-full text-xs font-medium shadow-2xl flex items-center gap-2 pointer-events-auto animate-bounce z-30"
        >
          <Cable className="w-4 h-4 text-cyan-400" />
          <span>Klik port tujuan pada perangkat lain untuk menghubungkan kabel (atau tekan Esc untuk batal)</span>
        </div>
      )}

      {/* Floating Active Packet Trace HUD */}
      {activePacketTrace && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-cyan-500/70 text-slate-100 px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-4 pointer-events-auto z-40 max-w-2xl"
        >
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>{activePacketTrace.protocol} Trace:</span>
                <span className="text-cyan-400">{activePacketTrace.sourceDeviceName}</span>
                <span className="text-slate-500">→</span>
                <span className="text-white">{activePacketTrace.targetIp}</span>
                <span
                  className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    activePacketTrace.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {activePacketTrace.success ? `${activePacketTrace.totalLatencyMs}ms` : 'DROPPED'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{activePacketTrace.summary}</span>
            </div>
          </div>
          <button
            onClick={clearPacketTrace}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors shrink-0"
            title="Clear Trace from Canvas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom-Left Interactive Canvas Navigation D-Pad & Mode Toolbar */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute bottom-4 left-4 z-30 flex items-end gap-2.5 pointer-events-auto"
      >
        {/* Directional Panning D-Pad */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-1.5 shadow-2xl backdrop-blur-md grid grid-cols-3 gap-1 w-24 h-24">
          <div />
          <button
            type="button"
            onClick={() => panBy(0, 120)}
            title="Geser Kanvas ke Atas (Pan Up / ArrowUp)"
            className="flex items-center justify-center rounded bg-slate-800/90 hover:bg-cyan-600 text-slate-300 hover:text-white transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <div />

          <button
            type="button"
            onClick={() => panBy(120, 0)}
            title="Geser Kanvas ke Kiri (Pan Left / ArrowLeft)"
            className="flex items-center justify-center rounded bg-slate-800/90 hover:bg-cyan-600 text-slate-300 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleFitToScreen}
            title="Tengahkan & Sesuaikan Semua Perangkat (Fit to Screen / Tombol F)"
            className="flex items-center justify-center rounded bg-slate-950 hover:bg-cyan-600 text-cyan-400 hover:text-white border border-slate-700/80 transition-colors"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => panBy(-120, 0)}
            title="Geser Kanvas ke Kanan (Pan Right / ArrowRight)"
            className="flex items-center justify-center rounded bg-slate-800/90 hover:bg-cyan-600 text-slate-300 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div />
          <button
            type="button"
            onClick={() => panBy(0, -120)}
            title="Geser Kanvas ke Bawah (Pan Down / ArrowDown)"
            className="flex items-center justify-center rounded bg-slate-800/90 hover:bg-cyan-600 text-slate-300 hover:text-white transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <div />
        </div>

        {/* Interactive Mode & Layout Controls */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-1.5 shadow-2xl backdrop-blur-md flex items-center gap-1">
          <button
            type="button"
            onClick={() => setInteractionMode('select')}
            title="Mode Pilih & Geser Perangkat (Drag di area kosong tetap bisa menggeser kanvas)"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              interactionMode === 'select' && !isSpacePressed
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Select</span>
          </button>

          <button
            type="button"
            onClick={() => setInteractionMode('pan')}
            title="Mode Geser Kanvas / Hand Pan (Tarik Kanan-Kiri-Atas-Bawah di mana saja, atau tahan Spasi)"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              interactionMode === 'pan' || isSpacePressed
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Hand className="w-3.5 h-3.5" />
            <span>Pan Canvas</span>
          </button>

          <div className="w-[1px] h-5 bg-slate-800 mx-0.5" />

          <button
            type="button"
            onClick={() => setSnapToGrid((v) => !v)}
            title="Snap-to-Grid (24px) saat memindahkan perangkat"
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              snapToGrid
                ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Grid</span>
          </button>

          <button
            type="button"
            onClick={handleAutoArrange}
            title="Auto-Arrange Topology (Rapikan posisi perangkat secara otomatis)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-emerald-400" />
            <span>Auto-Layout</span>
          </button>
        </div>
      </div>

      {/* Bottom-Right Interactive Zoom & Telemetry Bar */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute bottom-4 right-4 z-30 bg-slate-900/95 border border-slate-800 rounded-xl p-1.5 text-[11px] text-slate-400 font-mono shadow-2xl backdrop-blur-md flex items-center gap-2 pointer-events-auto"
      >
        <div className="hidden sm:flex items-center gap-2 px-2 border-r border-slate-800">
          <span>
            Nodes: <strong className="text-white">{activeProject.devices.length}</strong>
          </span>
          <span>·</span>
          <span>
            Links: <strong className="text-white">{activeProject.links.length}</strong>
          </span>
          <span>·</span>
          <span className="text-slate-500">
            X:{Math.round(-viewport.x)} Y:{Math.round(-viewport.y)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => zoomTo(viewport.zoom - 0.15)}
            title="Zoom Out (-)"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setViewport({ ...viewport, zoom: 1 })}
            title="Reset Zoom ke 100%"
            className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-cyan-400 hover:border-cyan-500/40 font-bold min-w-[52px] text-center transition-colors"
          >
            {Math.round(viewport.zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={() => zoomTo(viewport.zoom + 0.15)}
            title="Zoom In (+)"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleFitToScreen}
            title="Fit All Devices to Screen (F)"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-cyan-600 text-slate-200 hover:text-white font-sans font-semibold text-xs transition-colors"
          >
            <Focus className="w-3.5 h-3.5" />
            <span>Fit</span>
          </button>

          <button
            type="button"
            onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
            title="Reset Posisi Kanvas ke Origin (0,0)"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
