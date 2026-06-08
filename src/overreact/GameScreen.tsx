import React, { useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useXTerm } from 'react-xtermjs';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useReactiveGameState, PERMANENT_ITEMS, MAP_LAYOUT, DeductionCategory } from './GameState';
import { useGameActions } from './useGameActions';
import { ITEM_NAMES, ITEM_IMAGES, PHONE_CONTACTS, GAME_ROOMS, Interactable } from '../data';
import { IconMap } from '../Icons';
import { Audio } from '../audio';
import { FileText, Map as MapIcon, X, Bug, Download, Briefcase, CheckCircle, AlertTriangle, Settings, Volume2, Phone, PhoneCall, Mail, Play, Archive, Package, Terminal, Eye, Wine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipTitle, TooltipBody } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody, DialogClose } from '@/components/ui/dialog';
import { Toaster } from 'sonner';
import { DevInspector } from '@/components/DevInspector';
import DetectiveBoard from '@/components/DetectiveBoard';
import { INTERACT } from '@/lib/itemUse';
import { adjustMenuPosition } from '@/lib/useMenuPosition';

export default function GameScreen() {
  const s = useReactiveGameState();
  const { addLog, discoverContact, handleInteract, handleMenuSelect, handleMapTravel, handlePhoneChoice, handleDeductionSubmit, calculateGameCompletion } = useGameActions();

  const fitAddon = useRef(new FitAddon());
  const options = React.useMemo(() => ({
    theme: { background: '#0a0a0a', foreground: '#33ff33', cursor: '#33ff33' },
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 12,
    disableStdin: true,
    cursorBlink: false,
    convertEol: true,
    scrollback: 1000,
  }), []);
  const addons = React.useMemo(() => [fitAddon.current], []);
  const { ref: xtermRef, instance: xtermInstance } = useXTerm({ options, addons });

  const objMenuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const m = s.objMenu.current;
    if (m && objMenuRef.current) adjustMenuPosition(objMenuRef.current, m.x, m.y);
  });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const panState = useRef<{ startX: number; panStart: number; dragging: boolean } | null>(null);
  const wasPanning = useRef(false);
  const [dragState, setDragState] = React.useState<{
    objId: string; type: 'move' | 'resize'; startMouseX: number; startMouseY: number;
    startX: number; startY: number; startW: number; startH: number;
  } | null>(null);

  const currentRoom = s.localRooms.current[s.currentRoomId.current] || s.localRooms.current['escritorio'];

  const xtermLog = useCallback((msg: string) => {
    if (!xtermInstance) return;
    const formatted = '> ' + msg;
    if (formatted.includes('[ACESSO NEGADO]') || formatted.includes('ERRO') || formatted.includes('trancad')) {
      xtermInstance.writeln('\x1b[31;1m' + formatted + '\x1b[0m');
    } else if (formatted.includes('Entrou') || formatted.includes('MURPHY')) {
      xtermInstance.writeln('\x1b[32;1m' + formatted + '\x1b[0m');
    } else if (formatted.includes('coletou') || formatted.includes('pegou') || formatted.includes('encontrou') || formatted.includes('[AGENDA]') || formatted.includes('[TELEFONE]') || formatted.includes('[CARTA]')) {
      xtermInstance.writeln('\x1b[36;1m' + formatted + '\x1b[0m');
    } else {
      xtermInstance.writeln('\x1b[37;1m' + formatted + '\x1b[0m');
    }
    xtermInstance.scrollToBottom();
  }, [xtermInstance]);

  useEffect(() => {
    const handler = (e: Event) => xtermLog((e as CustomEvent).detail);
    window.addEventListener('game-log', handler);
    return () => window.removeEventListener('game-log', handler);
  }, [xtermLog]);

  useEffect(() => {
    const handleResize = () => { try { fitAddon.current.fit(); } catch (e) {} };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (xtermInstance) {
      xtermInstance.clear();
      ['MURPHY LAW — INVESTIGAÇÕES PRIVADAS.', 'A chuva não para. O schnapps acabou. O caso não.', 'Maria Kraft depositou Mk 500 na mesa. Tudo que tinha.', 'Helena, 9 anos, desaparecida há 3 semanas.'].forEach(log => {
        xtermInstance.writeln('\x1b[32;1m> ' + log + '\x1b[0m');
      });
      setTimeout(() => {
        xtermLog(`Entrou em: ${currentRoom.name}`);
        xtermLog(currentRoom.description);
        fitAddon.current.fit();
      }, 50);
    }
  }, [xtermInstance]);

  useEffect(() => { discoverContact('agente_scp'); }, []);

  useEffect(() => {
    if (!s.visitedRooms.current.includes(s.currentRoomId.current)) {
      s.visitedRooms.current = [...s.visitedRooms.current, s.currentRoomId.current];
    }
    if (s.currentRoomId.current !== 'escritorio' || s.visitedRooms.current.length > 1) {
      addLog(`Entrou em: ${currentRoom.name}`);
      addLog(currentRoom.description);
    }
  }, [s.currentRoomId.current]);

  useEffect(() => { s.panX.current = 0; }, [s.currentRoomId.current]);

  useEffect(() => {
    const room = s.localRooms.current[s.currentRoomId.current];
    if (room?.rain) {
      Audio.setRainVolume(room.rain.volume);
    } else {
      Audio.setRainVolume(0);
    }
  }, [s.currentRoomId.current]);

  useEffect(() => {
    const close = () => { s.objMenu.current = null; };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') s.objMenu.current = null; };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => {
    if (!dragState) return;
    const handleMouseMove = (e: MouseEvent) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const rect = vp.getBoundingClientRect();
      const dxPct = ((e.clientX - dragState.startMouseX) / rect.width) * 100;
      const dyPct = ((e.clientY - dragState.startMouseY) / rect.height) * 100;
      s.localRooms.current = (() => {
        const next = { ...s.localRooms.current };
        const room = { ...next[s.currentRoomId.current] };
        room.interactables = room.interactables.map((obj) => {
          if (obj.id === dragState.objId) return obj;
          if (dragState.type === 'move') {
            return { ...obj, x: Math.round((dragState.startX + dxPct) * 10) / 10, y: Math.round((dragState.startY + dyPct) * 10) / 10 };
          } else {
            const newW = Math.max(3, Math.round((dragState.startW + dxPct) * 10) / 10);
            const newH = Math.max(3, Math.round((dragState.startH + dyPct) * 10) / 10);
            return { ...obj, width: newW, height: newH };
          }
        });
        next[s.currentRoomId.current] = room;
        return next;
      })();
    };
    const handleMouseUp = () => { setDragState(null); };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [dragState]);

  const handlePanStart = useCallback((clientX: number) => {
    panState.current = { startX: clientX, panStart: s.panX.current, dragging: false };
  }, []);

  const handlePanMove = useCallback((clientX: number) => {
    if (!panState.current) return;
    const dx = clientX - panState.current.startX;
    if (Math.abs(dx) > 3) panState.current.dragging = true;
    const vp = viewportRef.current;
    const sc = sceneRef.current;
    if (!vp || !sc) return;
    const vpW = vp.clientWidth;
    const scW = sc.clientWidth;
    const maxPan = 0;
    const minPan = Math.min(vpW - scW, 0);
    s.panX.current = Math.max(minPan, Math.min(maxPan, panState.current.panStart + dx));
  }, []);

  const handlePanEnd = useCallback(() => {
    if (panState.current?.dragging) wasPanning.current = true;
    panState.current = null;
    requestAnimationFrame(() => { wasPanning.current = false; });
  }, []);

  const handleDragMouseDown = useCallback((e: React.MouseEvent, obj: Interactable, type: 'move' | 'resize') => {
    e.stopPropagation();
    e.preventDefault();
    s.selectedObjId.current = obj.id;
    setDragState({
      objId: obj.id, type,
      startMouseX: e.clientX, startMouseY: e.clientY,
      startX: obj.x, startY: obj.y, startW: obj.width || 0, startH: obj.height || 0,
    });
  }, []);

  const handleUpdateObj = useCallback((roomId: string, objId: string, updated: Interactable) => {
    s.localRooms.current = (() => {
      const next = { ...s.localRooms.current };
      const room = { ...next[roomId] };
      room.interactables = room.interactables.map(obj => obj.id === objId ? updated : obj);
      next[roomId] = room;
      return next;
    })();
  }, []);

  const handleAddObj = useCallback((roomId: string, obj: Interactable) => {
    s.localRooms.current = (() => {
      const next = { ...s.localRooms.current };
      const room = { ...next[roomId] };
      room.interactables = [...room.interactables, obj];
      next[roomId] = room;
      return next;
    })();
  }, []);

  const handleRemoveObj = useCallback((roomId: string, objId: string) => {
    s.localRooms.current = (() => {
      const next = { ...s.localRooms.current };
      const room = { ...next[roomId] };
      room.interactables = room.interactables.filter(obj => obj.id !== objId);
      next[roomId] = room;
      return next;
    })();
    if (s.selectedObjId.current === objId) s.selectedObjId.current = null;
  }, []);

  const handleDownloadJSON = useCallback(() => {
    const exportData = {
      ITEM_NAMES,
      GAME_ROOMS: Object.fromEntries(
        Object.entries(s.localRooms.current).map(([id, room]) => [id, {
          id: room.id, name: room.name, description: room.description,
          interactables: room.interactables.map(({ id, icon, x, y, width, height, hideIcon, type, label, description, requiredItem, failedMessage, successMessage, targetRoom, pickupItem, phoneCallId, documentData, hideAfterInteract }) => {
            const obj: Record<string, unknown> = { id, icon, x, y, type, label };
            if (width !== undefined) obj.width = width;
            if (height !== undefined) obj.height = height;
            if (hideIcon !== undefined) obj.hideIcon = hideIcon;
            if (description !== undefined) obj.description = description;
            if (requiredItem !== undefined) obj.requiredItem = requiredItem;
            if (failedMessage !== undefined) obj.failedMessage = failedMessage;
            if (successMessage !== undefined) obj.successMessage = successMessage;
            if (targetRoom !== undefined) obj.targetRoom = targetRoom;
            if (pickupItem !== undefined) obj.pickupItem = pickupItem;
            if (phoneCallId !== undefined) obj.phoneCallId = phoneCallId;
            if (documentData !== undefined) obj.documentData = documentData;
            if (hideAfterInteract !== undefined) obj.hideAfterInteract = hideAfterInteract;
            return obj;
          }),
        }])
      ),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'game_data.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const closeDocument = () => {
    Audio.playHover();
    Audio.stopSpeak();
    s.documentData.current = null;
  };

  const closePhoneCall = (open: boolean) => {
    if (!open && s.activePhoneCall.current) {
      Audio.playHover();
      Audio.stopSpeak();
      const call = s.activePhoneCall.current;
      const closingContactId = call.contactId;
      const closingNodeId = call.nodeId;
      const closingVisitedNodes = [...call.visitedNodes];
      const allNodes = [...closingVisitedNodes, closingNodeId];
      const ct = PHONE_CONTACTS[closingContactId];

      const recording: { speaker: string; lines: string[] }[] = [];
      for (const nid of allNodes) {
        const n = ct?.dialogue[nid];
        if (n) recording.push({ speaker: n.speaker, lines: n.lines });
      }

      if (closingContactId === 'agente_scp') {
        s.phoneRecordings.current = { ...s.phoneRecordings.current, [closingContactId]: recording };
        if (ct?.murphyCommentary) {
          const commentary: string[] = [];
          for (const nid of allNodes) {
            if (ct.murphyCommentary[nid]) commentary.push(...ct.murphyCommentary[nid]);
          }
          if (commentary.length > 0) {
            s.murphyCommentaryMap.current = { ...s.murphyCommentaryMap.current, [closingContactId]: commentary };
          }
        }
        if (allNodes.includes('deduction_correct')) {
          if (!s.calledContacts.current.includes(closingContactId)) {
      s.calledContacts.current = [...s.calledContacts.current, closingContactId];
    }
          s.deductionResult.current = 'correct';
          s.gameCompleted.current = true;
          addLog('[DEDUÇÃO] ✅ DEDUÇÃO CONFIRMADA — Fall Helena Kraft encerrado.');
          Audio.playPickup();
        } else if (allNodes.includes('deduction_wrong')) {
          s.deductionResult.current = 'wrong';
          addLog('[DEDUÇÃO] Stern rejeitou a dedução. Revise as pistas.');
          Audio.playDenied();
          setTimeout(() => { s.deductionOpen.current = true; }, 300);
        } else if (allNodes.includes('deduction_incomplete')) {
          s.deductionResult.current = 'wrong';
          addLog('[DEDUÇÃO] Dedução incompleta. Preencha todos os campos.');
          Audio.playDenied();
          setTimeout(() => { s.deductionOpen.current = true; }, 300);
        }
      } else if (!s.calledContacts.current.includes(closingContactId)) {
        s.calledContacts.current = [...s.calledContacts.current, closingContactId];
        s.phoneRecordings.current = { ...s.phoneRecordings.current, [closingContactId]: recording };
        if (ct?.murphyCommentary) {
          const commentary: string[] = [];
          for (const nid of allNodes) {
            if (ct.murphyCommentary[nid]) commentary.push(...ct.murphyCommentary[nid]);
          }
          if (commentary.length > 0) {
            s.murphyCommentaryMap.current = { ...s.murphyCommentaryMap.current, [closingContactId]: commentary };
          }
        }
      }
      s.activePhoneCall.current = null;
    }
  };

  const openObjMenu = (e: React.MouseEvent, obj: Interactable) => {
    if (panState.current?.dragging || wasPanning.current) return;
    e.preventDefault();
    e.stopPropagation();
    Audio.playHover();
    s.objMenu.current = { x: e.clientX, y: e.clientY, obj };
  };

  const devMode = s.devMode.current;
  const inventory = s.inventory.current;
  const objMenu = s.objMenu.current;

  return (
    <div className="flex flex-col h-screen w-full bg-noir-dark text-white font-mono uppercase relative overflow-hidden select-none pb-14 md:pb-0">
      <div className="crt-overlay" />
      <div className="scanline" />
      <Toaster richColors />

      {/* Header */}
      <header className="border-b-2 border-noir-amber h-12 md:h-16 flex items-center px-2 md:px-4 justify-between bg-black z-20">
        <div className="flex items-center gap-2 md:gap-3 text-noir-amber">
          <Briefcase size={20} className="md:w-7 md:h-7" />
          <div>
            <h1 className="text-base md:text-xl font-bold tracking-widest border-b border-noir-amber inline-block border-opacity-30" style={{ fontFamily: 'Playfair Display, serif' }}>
              MURPHY LAW
            </h1>
            <p className="text-[10px] text-amber-600 tracking-wider hidden md:block">INVESTIGAÇÕES PRIVADAS</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-6">
          <Button variant="frame" onClick={() => { Audio.playHover(); s.isSettingsOpen.current = true; }} className="text-zinc-500 hover:text-noir-amber transition-colors border-none bg-transparent px-2 py-1">
            <Settings size={18} className="md:w-5 md:h-5" />
          </Button>
          <Button variant="frame" onClick={() => { s.devMode.current = !s.devMode.current; s.selectedObjId.current = null; }} className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 text-xs ${devMode ? 'bg-noir-amber text-black border-noir-amber' : 'text-gray-500 border-zinc-700 hover:text-zinc-300 hover:border-zinc-500'} transition-colors`}>
            <Bug size={12} className="md:w-3.5 md:h-3.5" /> <span className="hidden md:inline">DEV</span>
          </Button>
          <div className="text-right">
            <Badge classification="euclid" size="sm">{currentRoom.name}</Badge>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <div className="flex flex-1 overflow-hidden z-10 relative">

        {/* Environment Viewport */}
        <div
          ref={viewportRef}
          className="flex-1 bg-zinc-950 relative md:border-r border-zinc-900 overflow-hidden shadow-inner group cursor-grab active:cursor-grabbing"
          onMouseDown={(e) => { if (!devMode) handlePanStart(e.clientX); }}
          onMouseMove={(e) => { if (panState.current?.dragging) handlePanMove(e.clientX); }}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
          onTouchStart={(e) => { if (!devMode && e.touches.length === 1) handlePanStart(e.touches[0].clientX); }}
          onTouchMove={(e) => { if (panState.current?.dragging && e.touches.length === 1) handlePanMove(e.touches[0].clientX); }}
          onTouchEnd={handlePanEnd}
        >
          <div
            ref={sceneRef}
            className="relative h-full inline-block"
            style={{ transform: `translateX(${s.panX.current}px)`, transition: panState.current?.dragging ? 'none' : 'transform 0.15s ease-out' }}
          >
            {currentRoom.bgImage && (
              <img src={currentRoom.bgImage} alt={currentRoom.name} className="h-full w-auto opacity-90 pointer-events-none transition-opacity duration-1000 block" draggable={false} style={{ maxWidth: 'none' }} />
            )}
            <div className="rain-overlay" />

            {currentRoom.interactables.map((obj) => {
              if (!devMode && s.interactedItems.current.includes(obj.id)) return null;
              const IconCmp = IconMap[obj.icon] || IconMap['Search'];
              const hasItemImage = obj.type === 'pickup' && obj.pickupItem && ITEM_IMAGES[obj.pickupItem];
              const isSelected = devMode && s.selectedObjId.current === obj.id;
              const isBoxArea = !!(obj.width && obj.height);
              const isHiddenIcon = obj.hideIcon;
              const isDragging = dragState?.objId === obj.id;
              const tooltipVariant = obj.type === 'pickup' ? 'safe' as const : obj.type === 'travel' ? 'euclid' as const : obj.type === 'terminal_read' ? 'keter' as const : 'thaumiel' as const;

              const wrapperClassName = `absolute ${isBoxArea ? '' : '-translate-x-1/2 -translate-y-1/2'} z-30 ${isSelected ? 'ring-4 ring-noir-amber ring-offset-2 ring-offset-zinc-900' : ''} ${devMode && isHiddenIcon ? 'border-2 border-dashed border-noir-red bg-noir-red/20' : ''}`;
              const wrapperStyle: React.CSSProperties = {
                left: `${obj.x}%`, top: `${obj.y}%`,
                width: isBoxArea ? `${obj.width}%` : undefined,
                height: isBoxArea ? `${obj.height}%` : undefined,
                ...(isDragging ? { userSelect: 'none' as const } : {}),
              };

              if (devMode) {
                return (
                  <div key={obj.id} className={wrapperClassName} style={wrapperStyle} onMouseDown={(e) => handleDragMouseDown(e, obj, 'move')} onClick={(e) => { e.stopPropagation(); handleInteract(obj); }}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" className={`w-full h-full min-w-[44px] min-h-[44px] flex flex-col items-center justify-center text-zinc-300 cursor-grab transition-colors duration-200 ${isBoxArea ? '' : 'p-4'} border-none bg-transparent`} tabIndex={-1}>
                          {!isHiddenIcon && hasItemImage ? (
                            <img src={ITEM_IMAGES[obj.pickupItem!]} alt={obj.label} className="w-16 h-16 object-cover border border-zinc-500 rounded shadow-[0_0_15px_rgba(212,168,71,0.3)]" />
                          ) : (!isHiddenIcon ? (
                            <IconCmp size={isBoxArea ? 24 : 48} className="drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] filter" />
                          ) : null)}
                          <Badge classification={tooltipVariant} size="sm" className="mt-2">{obj.label}</Badge>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent variant={tooltipVariant}>
                        <TooltipTitle>{obj.label}</TooltipTitle>
                        {obj.description && <TooltipBody>{obj.description.slice(0, 120)}{obj.description.length > 120 ? '...' : ''}</TooltipBody>}
                      </TooltipContent>
                    </Tooltip>
                    {isSelected && isBoxArea && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-noir-amber border-2 border-black z-40" onMouseDown={(e) => handleDragMouseDown(e, obj, 'resize')} />
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={obj.id}
                  type="button"
                  aria-label={obj.label}
                  className={`${wrapperClassName} min-w-[44px] min-h-[44px] flex flex-col items-center justify-center text-zinc-300 hover:text-noir-amber cursor-pointer transition-colors duration-200 ${isBoxArea ? '' : 'p-4'} border-none bg-transparent`}
                  style={wrapperStyle}
                  onMouseEnter={() => Audio.playHover()}
                  onClick={(e) => openObjMenu(e, obj)}
                  onContextMenu={(e) => openObjMenu(e, obj)}
                >
                  {!isHiddenIcon && hasItemImage ? (
                    <img src={ITEM_IMAGES[obj.pickupItem!]} alt={obj.label} className="w-16 h-16 object-cover border border-zinc-500 rounded shadow-[0_0_15px_rgba(212,168,71,0.3)] transition-all opacity-60 hover:opacity-100" />
                  ) : (!isHiddenIcon ? (
                    <IconCmp size={isBoxArea ? 24 : 48} className="drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] filter opacity-60 hover:opacity-100" />
                  ) : null)}
                </button>
              );
            })}
          </div>

          <div className="fog-overlay" style={{ position: 'absolute' }} />
          <div className="vignette-overlay" style={{ position: 'absolute' }} />

          {/* Object Context Menu */}
          {objMenu && (
            <div
              ref={objMenuRef}
              className="fixed z-[9999] bg-zinc-900 border border-noir-amber/40 rounded shadow-xl py-1 min-w-[200px] max-h-[60vh] overflow-y-auto institutional"
              style={{ left: objMenu.x, top: objMenu.y }}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              <div className="px-3 py-1.5 text-xs uppercase tracking-wider text-noir-amber/80 border-b border-zinc-700/60 truncate">{objMenu.obj.label}</div>
              <button type="button" className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800 hover:text-noir-amber transition-colors"
                onClick={(e) => { e.stopPropagation(); const o = objMenu.obj; s.objMenu.current = null; handleMenuSelect(o, INTERACT); }}>
                ▸ Interagir
              </button>
              <div className="my-1 h-px bg-zinc-700/60" />
              {inventory.map((it) => (
                <button key={it} type="button" className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-noir-amber transition-colors"
                  onClick={(e) => { e.stopPropagation(); const o = objMenu.obj; s.objMenu.current = null; handleMenuSelect(o, it); }}>
                  {ITEM_NAMES[it] || it}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel: Sidebar (desktop) */}
        <div className="hidden md:flex w-56 bg-black border-0 border-l border-noir-amber rounded-none z-20 flex-col">
          {devMode ? (
            <DevInspector rooms={s.localRooms.current} currentRoomId={s.currentRoomId.current} selectedObjId={s.selectedObjId.current} onSelectObj={(id: string | null) => { s.selectedObjId.current = id; }} onUpdateObj={handleUpdateObj} onAddObj={handleAddObj} onRemoveObj={handleRemoveObj} onDownloadJSON={handleDownloadJSON} />
) : (
<>
<div className="p-4 space-y-2">
<Button variant="ghost" onClick={() => { Audio.playTypewriter(); s.isMapOpen.current = true; }} onMouseEnter={() => Audio.playHover()} className="w-full text-zinc-300 hover:text-noir-amber transition-colors text-xs tracking-widest justify-start">
<Package size={14} /> INVENTÁRIO
</Button>
<Button variant="ghost" onClick={() => {
if (s.currentRoomId.current !== 'escritorio') { Audio.playDenied(); addLog('[TELEFONE] Você precisa voltar ao escritório para usar a agenda telefônica.'); return; }
Audio.playTerminal(); s.phoneAgendaOpen.current = true;
}} onMouseEnter={() => Audio.playHover()} className="w-full text-zinc-300 hover:text-noir-amber transition-colors text-xs tracking-widest justify-start">
<Phone size={14} /> AGENDA <Badge classification="euclid" size="sm" className="ml-1">{s.discoveredContacts.current.length}</Badge>
</Button>
<Button variant="ghost" onClick={() => { Audio.playTypewriter(); s.cassetteMenuOpen.current = true; }} onMouseEnter={() => Audio.playHover()} className="w-full text-zinc-300 hover:text-noir-amber transition-colors text-xs tracking-widest justify-start">
<Archive size={14} /> FITA CASSETE
</Button>
</div>
</>
          )}
        </div>
      </div>

      {/* Bottom Panel: Terminal / Dev Inspector */}
      {devMode ? (
        <footer className="hidden md:flex h-48 bg-zinc-950 border-t-2 border-noir-amber flex-col relative z-20">
          <DevInspector rooms={s.localRooms.current} currentRoomId={s.currentRoomId.current} selectedObjId={s.selectedObjId.current} onSelectObj={(id: string | null) => { s.selectedObjId.current = id; }} onUpdateObj={handleUpdateObj} onAddObj={handleAddObj} onRemoveObj={handleRemoveObj} onDownloadJSON={handleDownloadJSON} />
        </footer>
      ) : (
        <footer className="h-32 md:h-48 bg-zinc-950 border-t-2 border-zinc-900 p-2 md:p-4 font-mono text-sm overflow-hidden flex flex-col relative z-20">
          <div className="text-noir-amber mb-1 md:mb-2 flex items-center gap-2 bg-transparent text-xs md:text-sm">
            <Wine size={14} /> DIÁRIO DE MURPHY
          </div>
          <div className="flex-1 w-full overflow-hidden" ref={xtermRef} />
        </footer>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-black border-t border-noir-amber z-50 flex items-center justify-around px-1">
<button onClick={() => { Audio.playTypewriter(); s.isMapOpen.current = true; }} className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-noir-amber active:text-noir-amber transition-colors px-2 py-1 min-w-[44px] min-h-[44px] justify-center">
<MapIcon size={18} /><span className="text-[8px] tracking-widest">INVENTÁRIO</span>
        </button>
        <button onClick={() => {
          if (s.currentRoomId.current !== 'escritorio') { Audio.playDenied(); addLog('[TELEFONE] Volte ao escritório para usar a agenda.'); return; }
          Audio.playTerminal(); s.phoneAgendaOpen.current = true;
        }} className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-noir-amber active:text-noir-amber transition-colors px-2 py-1 min-w-[44px] min-h-[44px] justify-center">
          <Phone size={18} /><span className="text-[8px] tracking-widest">AGENDA</span>
        </button>
        <button onClick={() => { Audio.playTypewriter(); s.cassetteMenuOpen.current = true; }} className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-noir-amber active:text-noir-amber transition-colors px-2 py-1 min-w-[44px] min-h-[44px] justify-center">
          <Archive size={18} /><span className="text-[8px] tracking-widest">FITA</span>
        </button>
<button onClick={() => { Audio.playTypewriter(); s.isMapOpen.current = true; }} className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-noir-amber active:text-noir-amber transition-colors px-2 py-1 min-w-[44px] min-h-[44px] justify-center relative">
<Package size={18} /><span className="text-[8px] tracking-widest">ITENS</span>
          {inventory.length > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-noir-amber text-black text-[8px] font-bold rounded-full flex items-center justify-center">{inventory.length}</span>}
        </button>
        <button onClick={() => { s.mobileTerminalOpen.current = !s.mobileTerminalOpen.current; }} className={`flex flex-col items-center gap-0.5 transition-colors px-2 py-1 min-w-[44px] min-h-[44px] justify-center ${s.mobileTerminalOpen.current ? 'text-noir-amber' : 'text-zinc-500 hover:text-noir-amber active:text-noir-amber'}`}>
          <Terminal size={18} /><span className="text-[8px] tracking-widest">LOG</span>
        </button>
      </div>

      {/* Mobile Terminal Sheet */}
      {s.mobileTerminalOpen.current && !devMode && (
        <div className="md:hidden fixed bottom-14 left-0 right-0 h-48 bg-zinc-950 border-t border-noir-amber z-40 flex flex-col p-2 font-mono text-sm">
          <div className="text-noir-amber mb-1 flex items-center gap-2 text-xs"><Wine size={14} /> DIÁRIO DE MURPHY</div>
          <div className="flex-1 w-full overflow-hidden" ref={xtermRef} />
        </div>
      )}

{/* Phone Agenda Modal */}
      <Dialog open={s.phoneAgendaOpen.current && !s.activePhoneCall.current} onOpenChange={(open) => { if (!open) s.phoneAgendaOpen.current = false; }}>
        <DialogContent className="max-w-full md:max-w-lg max-h-[90vh] md:max-h-none flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3"><Phone size={20} /> AGENDA TELEFÔNICA</DialogTitle>
            <DialogClose onClick={() => { Audio.playHover(); s.phoneAgendaOpen.current = false; }} />
          </DialogHeader>
          <DialogBody className="p-4 space-y-2 overflow-y-auto flex-1">
{s.discoveredContacts.current.length === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-8 tracking-widest">NENHUM CONTATO CONHECIDO</p>
        ) : (
          s.discoveredContacts.current.map((contactId) => {
            const contact = PHONE_CONTACTS[contactId];
            if (!contact) return null;
            const isLetter = contactId === 'seu_jonas';
            const isScp = contactId === 'agente_scp';
            const wasCalled = s.calledContacts.current.includes(contactId);
            const isCutoff = s.pdCutoffContacts.current.includes(contactId);
                const hasRecording = !!s.phoneRecordings.current[contactId];
                const contactBadge = isCutoff ? 'keter' as const : isScp && !s.gameCompleted.current ? 'thaumiel' as const : wasCalled ? 'safe' as const : 'euclid' as const;
                return (
                  <Button key={contactId} variant="ghost" onClick={() => {
                    if (isCutoff) { Audio.playDenied(); addLog(`[${isLetter ? 'CARTA' : 'TELEFONE'}] ${contact.name} cortou relações. Impossível reconectar.`); return; }
                    if (isScp) {
                      if (hasRecording) { Audio.playTerminal(); s.phoneAgendaOpen.current = false; s.cassettePlayback.current = { contactId, lines: s.phoneRecordings.current[contactId] }; addLog(`[FITA] Reouvindo ${s.gameCompleted.current ? '' : 'última transmissão de '}${contact.name}...`); }
                      else { Audio.playTerminal(); s.phoneAgendaOpen.current = false; s.activePhoneCall.current = { contactId, nodeId: 'initial', linesShown: 0, visitedNodes: [] }; addLog(`[SCP] Canal seguro — ${contact.name}...`); }
                      return;
                    }
                    if (wasCalled) {
                      if (hasRecording) { Audio.playTerminal(); s.phoneAgendaOpen.current = false; s.cassettePlayback.current = { contactId, lines: s.phoneRecordings.current[contactId] }; addLog(isLetter ? `[FITA] Reouvido gravação da carta de ${contact.name}...` : `[FITA] Reouvindo gravação de ${contact.name}...`); }
                      else { Audio.playDenied(); addLog(`[TELEFONE] ${isLetter ? 'Carta já lida.' : 'Linha ocupada.'}`); }
                      return;
                    }
                    Audio.playTerminal(); s.phoneAgendaOpen.current = false; s.activePhoneCall.current = { contactId, nodeId: 'initial', linesShown: 0, visitedNodes: [] };
                    addLog(isLetter ? `[CARTA] Lendo carta de ${contact.name}...` : `[TELEFONE] Ligando para ${contact.name} (${contact.number})...`);
                  }} onMouseEnter={() => Audio.playHover()} className={`w-full bg-zinc-900 border border-zinc-800 hover:border-noir-amber p-3 flex items-center gap-4 text-left transition-colors group ${wasCalled && !hasRecording ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <div className="w-10 h-10 border border-zinc-700 group-hover:border-noir-amber flex items-center justify-center bg-black">
                      {isScp ? <Eye size={18} className="text-noir-amber" /> : wasCalled && hasRecording ? <Play size={18} className="text-noir-amber" /> : isLetter ? <Mail size={18} className="text-zinc-500 group-hover:text-noir-amber" /> : <PhoneCall size={18} className="text-zinc-500 group-hover:text-noir-amber" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-300 text-xs font-bold tracking-wider truncate group-hover:text-noir-amber transition-colors">{contact.name}</p>
                      <p className="text-zinc-600 text-[10px] tracking-wide">{isScp ? 'CANAL SEGURO' : isLetter ? 'CARTA NO BECO' : contact.number}</p>
                    </div>
                    <Badge classification={contactBadge} size="sm">
                      {isScp ? (s.gameCompleted.current ? 'OUVIR FITA' : hasRecording ? 'OUVIR FITA' : 'SCP') : isCutoff ? 'CORTADO' : wasCalled && hasRecording ? 'OUVIR FITA' : wasCalled ? (isLetter ? 'GELESEN' : 'GETRENNT') : (isLetter ? 'LER' : 'LIGAR')}
                    </Badge>
                  </Button>
                );
              })
            )}
          </DialogBody>
          <DialogFooter className="h-8 text-noir-amber text-xs flex items-center px-4 justify-between">
            <span>CONTATOS: {s.discoveredContacts.current.length}</span>
            <span className="animate-pulse">LINHA ESTATAL</span>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone Call / Letter Dialogue Modal */}
      <Dialog open={!!s.activePhoneCall.current} onOpenChange={closePhoneCall}>
        <DialogContent className="max-w-full md:max-w-xl max-h-[90vh] md:max-h-none flex flex-col">
          {s.activePhoneCall.current && (() => {
            const call = s.activePhoneCall.current;
            const contact = PHONE_CONTACTS[call.contactId];
            if (!contact) return null;
            const node = contact.dialogue[call.nodeId];
            if (!node) return null;
            const isLetter = call.contactId === 'seu_jonas';
            const isScp = call.contactId === 'agente_scp';
            const isCallEnded = node.choices.length === 0;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    {isScp ? <Eye size={18} /> : isLetter ? <Mail size={18} /> : <PhoneCall size={18} />}
                    {isScp ? `CANAL SEGURO — ${contact.name.toUpperCase()}` : isLetter ? `CARTA — ${contact.name.toUpperCase()}` : `${contact.number} — ${contact.name.toUpperCase()}`}
                  </DialogTitle>
                  <DialogClose />
                </DialogHeader>
                <DialogBody className="p-4 md:p-6 space-y-4 min-h-[200px] max-h-[50vh] overflow-y-auto flex-1">
                  {call.nodeId === 'initial' && contact.greeting && (
                    <p className="text-zinc-500 text-xs italic tracking-wide border-b border-zinc-800 pb-3">{contact.greeting}</p>
                  )}
                  <div className="space-y-2">
                    <p className="text-noir-amber text-[10px] font-bold tracking-widest border-b border-zinc-900 pb-1">{node.speaker.toUpperCase()}:</p>
                    {node.lines.map((line, i) => (
                      <p key={i} className="text-zinc-300 text-sm tracking-wide leading-relaxed pl-2 border-l-2 border-zinc-800">{line}</p>
                    ))}
                  </div>
                </DialogBody>
                {!isCallEnded ? (
                  <DialogFooter className="p-3 md:p-4 bg-black/50 space-y-2 flex-col items-stretch">
                    <p className="text-zinc-600 text-[10px] tracking-widest mb-2">SUAS OPÇÕES:</p>
                    {node.choices.map((choice, i) => (
                      <Button key={i} variant="ghost" onClick={() => handlePhoneChoice(choice)} onMouseEnter={() => Audio.playHover()} className="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-noir-amber text-zinc-300 hover:text-noir-amber p-3 text-xs tracking-wide transition-colors flex items-center gap-3 justify-start min-h-[44px]">
                        <span className="text-noir-amber font-bold text-[10px]">{String(i + 1).padStart(2, '0')}</span>
                        <span className="flex-1">{choice.text}</span>
                      </Button>
                    ))}
                  </DialogFooter>
                ) : (
                  <DialogFooter className="p-4 bg-black/50">
                    <Badge classification="keter" className="mx-auto animate-pulse">{isScp ? '*CANAL ENCERRADO*' : isLetter ? '— FIM DA CARTA —' : '*C L I C*'}</Badge>
                  </DialogFooter>
                )}
                <div className="h-8 bg-black border-t border-noir-amber text-noir-amber text-xs flex items-center px-4 justify-between">
                  <span>{isScp ? 'SICHERHEITSKANAL' : isLetter ? 'BRIEF' : 'TELEFON'}</span>
                  <Badge classification={isCallEnded ? 'keter' : 'thaumiel'} size="sm" className="animate-pulse">
                    {isScp ? (isCallEnded ? 'ABGESCHLOSSEN' : 'VERSCHLÜSSELT') : isLetter ? 'GELESEN' : isCallEnded ? 'GETRENNT' : 'VERBUNDEN'}
                  </Badge>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Cassette Menu Modal */}
      <Dialog open={s.cassetteMenuOpen.current} onOpenChange={(open) => { if (!open) s.cassetteMenuOpen.current = false; }}>
        <DialogContent className="max-w-full md:max-w-lg flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3"><Archive size={20} /> FITA CASSETE</DialogTitle>
            <DialogClose onClick={() => { s.cassetteMenuOpen.current = false; }} />
          </DialogHeader>
          <DialogBody className="p-4 space-y-2 overflow-y-auto max-h-[60vh]">
            {Object.keys(s.phoneRecordings.current).length === 0 ? (
              <p className="text-zinc-600 text-xs text-center py-8 tracking-widest">NENHUMA GRAVAÇÃO</p>
            ) : (
              Object.entries(s.phoneRecordings.current).map(([contactId, recording]) => {
                const contact = PHONE_CONTACTS[contactId];
                if (!contact) return null;
                const isLetter = contactId === 'seu_jonas';
                const commentary = s.murphyCommentaryMap.current[contactId];
                return (
                  <Button key={contactId} variant="ghost" onClick={() => {
                    s.cassetteMenuOpen.current = false;
                    s.cassettePlayback.current = { contactId, lines: recording };
                    Audio.playTerminal();
                    addLog(isLetter ? `[FITA] Reouvido gravação da carta de ${contact.name}...` : `[FITA] Reouvindo gravação de ${contact.name}...`);
                  }} onMouseEnter={() => Audio.playHover()} className="w-full bg-zinc-900 border border-zinc-800 hover:border-noir-amber p-3 flex items-center gap-4 text-left transition-colors group">
                    <div className="w-10 h-10 border border-zinc-700 group-hover:border-noir-amber flex items-center justify-center bg-black"><Play size={18} className="text-noir-amber" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-300 text-xs font-bold tracking-wider truncate group-hover:text-noir-amber transition-colors">{contact.name}</p>
                      <p className="text-zinc-600 text-[10px] tracking-wide">{isLetter ? 'CARTA' : contact.number} — {recording.length} blocos</p>
                    </div>
                    <Badge classification={commentary ? 'safe' : 'euclid'} size="sm">{commentary ? 'COM NOTAS' : 'GELESEN'}</Badge>
                  </Button>
                );
              })
            )}
          </DialogBody>
          <DialogFooter className="h-8 text-noir-amber text-xs flex items-center px-4 justify-between">
            <span>KASSETTE</span>
            <Badge classification="safe" size="sm" className="animate-pulse">BEREIT</Badge>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cassette Playback Modal */}
      <Dialog open={!!s.cassettePlayback.current} onOpenChange={(open) => { if (!open) { Audio.playHover(); s.cassettePlayback.current = null; } }}>
        <DialogContent className="max-w-full md:max-w-xl max-h-[90vh] md:max-h-none flex flex-col">
          {s.cassettePlayback.current && (() => {
            const contact = PHONE_CONTACTS[s.cassettePlayback.current!.contactId];
            if (!contact) return null;
            const isLetter = s.cassettePlayback.current!.contactId === 'seu_jonas';
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3"><Play size={18} /> {isLetter ? `FITA — CARTA DE ${contact.name.toUpperCase()}` : `FITA — ${contact.number}`}</DialogTitle>
                  <DialogClose />
                </DialogHeader>
                <DialogBody className="p-4 md:p-6 space-y-4 min-h-[200px] max-h-[50vh] overflow-y-auto flex-1">
                  {s.cassettePlayback.current!.contactId !== 'seu_jonas' && (
                    <p className="text-zinc-600 text-xs italic tracking-wide border-b border-zinc-800 pb-3">*estática* ... gravação recuperada da fita cassete ...</p>
                  )}
                  {s.cassettePlayback.current!.lines.map((block, i) => (
                    <div key={i} className="space-y-2">
                      <p className="text-noir-amber text-[10px] font-bold tracking-widest border-b border-zinc-900 pb-1">{block.speaker.toUpperCase()}:</p>
                      {block.lines.map((line, j) => (
                        <p key={j} className="text-zinc-400 text-sm tracking-wide leading-relaxed pl-2 border-l-2 border-zinc-800 italic">{line}</p>
                      ))}
                    </div>
                  ))}
                  {s.murphyCommentaryMap.current[s.cassettePlayback.current!.contactId] && (
                    <div className="space-y-2 border-t border-zinc-800 pt-4 mt-2">
                      <p className="text-noir-amber text-[10px] font-bold tracking-widest border-b border-zinc-900 pb-1">MURPHY — NOTAS PESSOAIS:</p>
                      {s.murphyCommentaryMap.current[s.cassettePlayback.current!.contactId].map((line, i) => (
                        <p key={i} className="text-zinc-500 text-xs tracking-wide leading-relaxed pl-2 border-l-2 border-amber-900/50 italic">{line}</p>
                      ))}
                    </div>
                  )}
                </DialogBody>
                <DialogFooter className="p-4 bg-black/50"><Badge classification="safe" className="mx-auto">— FIM DA FITA —</Badge></DialogFooter>
                <div className="h-8 bg-black border-t border-noir-amber text-noir-amber text-xs flex items-center px-4 justify-between">
                  <span>KASSETTE</span>
                  <Badge classification="safe" size="sm" className="animate-pulse">ABGESPIELT</Badge>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

{/* Inventory Modal (Map + Items) */}
<Dialog open={s.isMapOpen.current} onOpenChange={(open) => { if (!open) s.isMapOpen.current = false; }}>
<DialogContent className="max-w-full md:max-w-4xl h-[90vh] md:h-[80vh] flex flex-col">
<DialogHeader>
<DialogTitle className="flex items-center gap-3"><Package size={20} /> INVENTÁRIO</DialogTitle>
<DialogClose onClick={() => { Audio.playHover(); s.isMapOpen.current = false; }} />
</DialogHeader>
<DialogBody className="relative bg-black overflow-hidden flex-1 p-0 flex flex-col">
<div className="relative flex-1 min-h-[200px]">
<div className="absolute inset-0 bg-zinc-950/50" />
<div className="absolute inset-0 pointer-events-none border-[10px] border-black/50" />
<svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30 stroke-noir-amber" strokeWidth="1" strokeDasharray="8 4">
<line x1="30%" y1="60%" x2="50%" y2="60%" /><line x1="50%" y1="60%" x2="20%" y2="40%" /><line x1="50%" y1="60%" x2="50%" y2="35%" /><line x1="50%" y1="35%" x2="70%" y2="25%" /><line x1="50%" y1="60%" x2="75%" y2="50%" /><line x1="50%" y1="35%" x2="35%" y2="25%" /><line x1="35%" y1="25%" x2="55%" y2="15%" />
</svg>
            {Object.keys(GAME_ROOMS).map((roomId) => {
              const room = GAME_ROOMS[roomId];
              const isVisited = s.visitedRooms.current.includes(roomId);
              const isCurrent = s.currentRoomId.current === roomId;
              const coords = MAP_LAYOUT[roomId] || { x: 50, y: 50 };
              return (
                <Button key={roomId} variant="ghost" onClick={() => handleMapTravel(roomId)} onMouseEnter={() => Audio.playHover()}
                  className={`absolute w-24 h-16 md:w-28 md:h-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center text-[10px] tracking-wider transition-colors duration-300 overflow-hidden rounded-sm border-none min-w-[44px] min-h-[44px] ${isCurrent ? 'border-2 border-noir-amber text-noir-amber shadow-[0_0_15px_rgba(212,168,71,0.5)] z-20' : isVisited ? 'text-zinc-300 hover:text-noir-amber z-10' : 'text-zinc-700 cursor-not-allowed z-0'}`}
                  style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                >
                  {isVisited && room.mapImage && (<div className="absolute inset-0 z-0"><img src={room.mapImage} alt={room.name} className="w-full h-full object-cover opacity-50" /><div className="absolute inset-0 bg-black/40" /></div>)}
                  {!isVisited && <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-[1px] flex items-center justify-center text-[9px] text-zinc-600 z-10">[?]</div>}
                  <div className="font-bold mb-0.5 z-10 relative px-1 bg-black/60 rounded text-[9px]">{room.name.split('—')[0].trim()}</div>
                  {isCurrent && <Badge classification="euclid" size="sm" className="absolute -bottom-5 whitespace-nowrap animate-pulse z-10">VOCÊ ESTÁ AQUI</Badge>}
                </Button>
        );
      })}
      </div>
      <div className="border-t border-zinc-800/60 p-3 space-y-3 overflow-y-auto max-h-[35%]">
        <div>
          <p className="text-noir-amber text-xs tracking-widest mb-2">FERRAMENTAS</p>
          <div className="flex flex-wrap gap-2">
            {inventory.filter(i => PERMANENT_ITEMS.includes(i)).map((item) => (
              <div key={item} className="flex flex-col items-center gap-1.5 text-zinc-300 p-2 rounded-sm bg-zinc-900/50 border border-zinc-800/40">
                {ITEM_IMAGES[item] ? <img src={ITEM_IMAGES[item]} alt={ITEM_NAMES[item] || item} className="w-10 h-10 object-cover border border-zinc-700 shadow-md" /> : <IconMap.Key size={20} className="text-noir-amber" />}
                <Badge classification="thaumiel" size="sm">{ITEM_NAMES[item] || item}</Badge>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-noir-amber text-xs tracking-widest mb-2">EVIDÊNCIAS</p>
          {(() => {
            const evidence = inventory.filter(i => !PERMANENT_ITEMS.includes(i));
            return evidence.length === 0 ? <p className="text-zinc-600 text-xs text-center py-2 tracking-widest">VAZIO</p> : (
              <div className="flex flex-wrap gap-2">
                {evidence.map((item) => (
                  <div key={item} className="flex flex-col items-center gap-1.5 text-zinc-300 p-2 rounded-sm bg-zinc-900/50 border border-zinc-800/40">
                    {ITEM_IMAGES[item] ? <img src={ITEM_IMAGES[item]} alt={ITEM_NAMES[item] || item} className="w-10 h-10 object-cover border border-zinc-700 shadow-md" /> : <IconMap.Key size={20} className="text-noir-amber" />}
                    <Badge classification="safe" size="sm">{ITEM_NAMES[item] || item}</Badge>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
      </DialogBody>
      <DialogFooter className="h-8 text-noir-amber text-xs flex items-center px-4 justify-between">
        <span>LOCAIS: {s.visitedRooms.current.length} / {Object.keys(GAME_ROOMS).length}</span>
        <Badge classification="euclid" size="sm" className="animate-pulse">RASTREAMENTO ATIVO</Badge>
      </DialogFooter>
      </DialogContent>
      </Dialog>

      {/* Detective Board */}
      {s.deductionOpen.current && (
        <DetectiveBoard
          grid={s.deductionGrid.current}
          onGridChange={(grid: Record<string, Record<DeductionCategory, string>>) => { s.deductionGrid.current = grid; }}
          readHints={s.readHints.current}
          result={s.deductionResult.current}
          onSubmit={handleDeductionSubmit}
          onClose={() => { Audio.playHover(); s.deductionOpen.current = false; Audio.stopSpeak(); }}
          playHover={Audio.playHover}
          playTypewriter={Audio.playTypewriter}
        />
      )}

      {/* Game Completion Overlay */}
      {s.gameCompleted.current && (() => {
        const completion = calculateGameCompletion();
        return (
          <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="crt-overlay" /><div className="scanline" />
            <div className="border border-noir-amber bg-zinc-950 w-full max-w-lg shadow-[0_0_60px_rgba(212,168,71,0.3)] relative">
              <div className="border-b border-noir-amber p-6 bg-black text-center">
                <h1 className="text-3xl text-noir-amber font-bold tracking-widest mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>FALL HELENA KRAFT</h1>
                <p className="text-zinc-500 text-xs tracking-widest">ARQUIVO FECHADO</p>
              </div>
              <div className="p-8 text-center space-y-6">
                <div>
                  <p className="text-noir-amber text-6xl font-bold tracking-widest" style={{ fontFamily: 'Playfair Display, serif' }}>{completion.percent}%</p>
                  <p className="text-zinc-500 text-xs tracking-widest mt-2">CONCLUSÃO DO CASO</p>
                </div>
                <div className="space-y-3 text-left border border-zinc-800 p-4 bg-black/50">
                  <div className="flex justify-between items-center"><span className="text-zinc-400 text-xs tracking-wide">Pistas descobertas</span><span className="text-zinc-300 text-xs font-bold">{completion.hintsFound}/18</span></div>
                  <div className="flex justify-between items-center"><span className="text-zinc-400 text-xs tracking-wide">Entrevistas bem-sucedidas</span><span className="text-zinc-300 text-xs font-bold">{completion.interviewsCompleted}/5</span></div>
                  <div className="flex justify-between items-center"><span className="text-zinc-400 text-xs tracking-wide">Documentos de entrevista lidos</span><span className="text-zinc-300 text-xs font-bold">{completion.cluesRead}/5</span></div>
                  <div className="flex justify-between items-center"><span className="text-zinc-400 text-xs tracking-wide">Dedução correta</span><span className={`text-xs font-bold ${completion.deductionCorrect ? 'text-green-500' : 'text-noir-red'}`}>{completion.deductionCorrect ? 'SIM' : 'NÃO'}</span></div>
                  {completion.deductionCorrect && completion.deductionAttempts > 1 && (
                    <div className="flex justify-between items-center"><span className="text-zinc-400 text-xs tracking-wide">Tentativas de dedução</span><span className="text-noir-amber text-xs font-bold">{completion.deductionAttempts} {completion.deductionAttempts === 1 ? 'tentativa' : 'tentativas'}</span></div>
                  )}
                  <div className="flex justify-between items-center border-t border-zinc-800 pt-3"><span className="text-zinc-400 text-xs tracking-wide">Estratégia Tit-for-Tat</span><span className={`text-xs font-bold ${completion.tftCompliant ? 'text-noir-amber' : 'text-noir-red'}`}>{completion.tftCompliant ? 'CONFORME' : 'NÃO CONFORME'}</span></div>
                </div>
                {!completion.tftCompliant && (<p className="text-zinc-600 text-[10px] tracking-wider italic border-t border-zinc-900 pt-4">O investigador ideal segue Tit-for-Tat: cooperar primeiro, espelhar o oponente. 100% exige conformidade.</p>)}
                {completion.tftCompliant && completion.percent === 100 && (<p className="text-noir-amber text-xs tracking-widest font-bold border-t border-noir-amber pt-4">INVESTIGADOR EXEMPLAR — TIT-FOR-TAT</p>)}
              </div>
              <div className="h-8 bg-black border-t border-noir-amber text-noir-amber text-xs flex items-center px-4 justify-between">
                <span>MURPHY LAW</span><span className="animate-pulse">ABGESCHLOSSEN</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Settings Modal */}
      {s.isSettingsOpen.current && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-2 md:p-8">
          <div className="border border-noir-amber bg-zinc-950 w-full max-w-md flex flex-col shadow-[0_0_30px_rgba(212,168,71,0.15)] animate-in fade-in zoom-in duration-200">
            <div className="border-b border-noir-amber p-4 bg-black flex justify-between items-center text-noir-amber">
              <h2 className="font-bold text-xl tracking-widest flex items-center gap-3" style={{ fontFamily: 'Playfair Display, serif' }}><Settings /> CONFIGURAÇÕES</h2>
              <button onClick={() => { Audio.playHover(); s.isSettingsOpen.current = false; }} className="text-noir-amber hover:text-white bg-zinc-900 px-4 py-1 text-sm border border-zinc-700"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-6">
              {[
                { id: 'master', label: 'Volume Geral' },
                { id: 'ambient', label: 'Ambiente (Chuva/Jazz)' },
                { id: 'sfx', label: 'Efeitos Sonoros' },
                { id: 'voice', label: 'Vozes' },
              ].map((item) => (
                <div key={item.id} className="space-y-2">
                  <div className="flex justify-between text-xs tracking-widest">
                    <span className="text-zinc-400">{item.label}</span>
                    <span className="text-noir-amber">{Math.round(Audio.volumes[item.id as keyof typeof Audio.volumes] * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Volume2 size={14} className="text-zinc-600" />
                    <input type="range" min="0" max="1" step="0.01" value={Audio.volumes[item.id as keyof typeof Audio.volumes]}
                      onChange={(e) => { Audio.setVolume(item.id as any, parseFloat(e.target.value)); s.localRooms.current = { ...s.localRooms.current }; }}
                      className="flex-1 accent-noir-amber bg-zinc-800 h-1 appearance-none cursor-pointer" />
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-zinc-900 bg-black/50 text-[10px] text-zinc-600 text-center tracking-widest">OPERAÇÕES DE ÁUDIO EM TEMPO REAL — SISTEMA MURPHY</div>
          </div>
        </div>
      )}

      {/* Fullscreen Document Modal */}
      {s.documentData.current && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-8">
          <div className="border border-noir-amber bg-zinc-950 w-full max-w-3xl max-h-full flex flex-col shadow-[0_0_30px_rgba(212,168,71,0.15)] relative animate-in fade-in zoom-in duration-200">
            <div className="border-b border-noir-amber p-4 bg-black flex justify-between items-center">
              <h2 className="text-noir-amber font-bold text-xl tracking-widest flex items-center gap-3" style={{ fontFamily: 'Playfair Display, serif' }}><FileText /> {s.documentData.current.title}</h2>
              <button onClick={closeDocument} onMouseEnter={() => Audio.playHover()} className="text-white hover:text-noir-amber bg-zinc-900 px-4 py-1 text-sm border border-zinc-700">FECHAR</button>
            </div>
            <div className="p-4 md:p-8 overflow-y-auto text-zinc-300 space-y-4 tracking-wide leading-relaxed text-sm h-[50vh] md:h-[60vh]">
              {s.documentData.current.content.map((paragraph, index) => (
                <p key={index} className={paragraph.startsWith('>') || paragraph.startsWith('AVISO') || paragraph.startsWith('URGENTE') || paragraph.startsWith('CONFIDENCIAL') ? 'text-noir-red font-bold' : paragraph.startsWith('//') ? 'text-noir-amber italic' : ''}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
