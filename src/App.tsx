import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GAME_ROOMS, Interactable, ITEM_NAMES, ITEM_IMAGES, Room, PHONE_CONTACTS, PhoneContact } from './data';
import { IconMap } from './Icons';
import { Audio } from './audio';
import { FileText, Map as MapIcon, X, Bug, Download, Wine, Briefcase, CheckCircle, AlertTriangle, Settings, Volume2, Phone, PhoneCall, Mail, Play } from 'lucide-react';
import { useXTerm } from 'react-xtermjs';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

function Game() {
  const [currentRoomId, setCurrentRoomId] = useState<string>('escritorio');
  const [inventory, setInventory] = useState<string[]>([]);
  const [visitedRooms, setVisitedRooms] = useState<string[]>(['escritorio']);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);
  const [localRooms, setLocalRooms] = useState<{ [key: string]: Room }>(GAME_ROOMS);

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

  const { ref: xtermRef, instance: xtermInstance } = useXTerm({
    options,
    addons
  });

  const [documentData, setDocumentData] = useState<{ title: string; content: string[] } | null>(null);
  const [interactedItems, setInteractedItems] = useState<string[]>([]);
  const [readHints, setReadHints] = useState<Set<string>>(new Set());
  const [deductionOpen, setDeductionOpen] = useState(false);
  const [deductionResult, setDeductionResult] = useState<'correct' | 'wrong' | null>(null);

  const [discoveredContacts, setDiscoveredContacts] = useState<Set<string>>(new Set());
  const [calledContacts, setCalledContacts] = useState<Set<string>>(new Set());
  const [phoneRecordings, setPhoneRecordings] = useState<Record<string, { speaker: string; lines: string[] }[]>>({});
  const [phoneAgendaOpen, setPhoneAgendaOpen] = useState(false);
  const [activePhoneCall, setActivePhoneCall] = useState<{
    contactId: string;
    nodeId: string;
    linesShown: number;
    visitedNodes: string[];
  } | null>(null);
  const [cassettePlayback, setCassettePlayback] = useState<{
    contactId: string;
    lines: { speaker: string; lines: string[] }[];
  } | null>(null);

  const DEDUCTION_LOCATIONS = ['Escritório Murphy', 'Rua Sieben', 'Gasthof Vila Nova', 'Volksschule', 'Volkspolizeistation 8º'] as const;
  const DEDUCTION_CATEGORIES = {
    suspeito: ['Kommissar Mendes', 'Diretora Elvira', 'Seu Jonas', 'Zeca do Gasthof', 'Dra. Cunha'],
    local_crime: ['Lagerhaus 7', 'Beco da Rua Sieben', 'Volksschule Vila Nova', 'Volkspolizeistation 8º', 'Gasthof Vila Nova'],
    arma: ['Revólver .38', 'Faca de Cozinha', 'Arame de Piano', 'Chave Inglesa', 'Veneno Injetável'],
    motivo: ['Dívida de Jogo', 'Vingança Pessoal', 'Tráfico de Crianças', 'Extorsão', 'Cobertura de Crime'],
    horario: ['22:00', '23:30', '01:00', '02:30', '04:00'],
  } as const;
  type DeductionCategory = keyof typeof DEDUCTION_CATEGORIES;
  const DEDUCTION_SOLUTION: Record<string, Record<DeductionCategory, string>> = {
    'Escritório Murphy': { suspeito: 'Dra. Cunha', local_crime: 'Gasthof Vila Nova', arma: 'Chave Inglesa', motivo: 'Extorsão', horario: '04:00' },
    'Rua Sieben': { suspeito: 'Zeca do Gasthof', local_crime: 'Volkspolizeistation 8º', arma: 'Arame de Piano', motivo: 'Tráfico de Crianças', horario: '02:30' },
    'Gasthof Vila Nova': { suspeito: 'Seu Jonas', local_crime: 'Volksschule Vila Nova', arma: 'Faca de Cozinha', motivo: 'Vingança Pessoal', horario: '01:00' },
    'Volksschule': { suspeito: 'Diretora Elvira', local_crime: 'Beco da Rua Sieben', arma: 'Revólver .38', motivo: 'Dívida de Jogo', horario: '23:30' },
    'Volkspolizeistation 8º': { suspeito: 'Kommissar Mendes', local_crime: 'Lagerhaus 7', arma: 'Veneno Injetável', motivo: 'Cobertura de Crime', horario: '22:00' },
  };
  const [deductionGrid, setDeductionGrid] = useState<Record<string, Record<DeductionCategory, string>>>(() => {
    const grid: Record<string, Record<DeductionCategory, string>> = {};
    DEDUCTION_LOCATIONS.forEach(loc => {
      grid[loc] = { suspeito: '', local_crime: '', arma: '', motivo: '', horario: '' };
    });
    return grid;
  });

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      try { fitAddon.current.fit(); } catch (e) {}
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (xtermInstance) {
      xtermInstance.clear();
      const initialLogs = [
        'MURPHY LAW — INVESTIGAÇÕES PRIVADAS.',
        'A chuva não para. O schnapps acabou. O caso não.',
        'Maria Kraft depositou Mk 500 na mesa. Tudo que tinha.',
        'Helena, 9 anos, desaparecida há 3 semanas.',
      ];
      initialLogs.forEach(log => {
        xtermInstance.writeln('\x1b[32;1m> ' + log + '\x1b[0m');
      });
      setTimeout(() => {
        addLog(`Entrou em: ${currentRoom.name}`);
        addLog(currentRoom.description);
        fitAddon.current.fit();
      }, 50);
    }
  }, [xtermInstance]);

  const addLog = (msg: string) => {
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
  };

  const discoverContact = (contactId: string) => {
    let wasNew = false;
    setDiscoveredContacts(prev => {
      if (prev.has(contactId)) return prev;
      wasNew = true;
      const next = new Set(prev);
      next.add(contactId);
      return next;
    });
    if (!discoveredContacts.has(contactId) && PHONE_CONTACTS[contactId]) {
      addLog(`[AGENDA] Novo contato: ${PHONE_CONTACTS[contactId].name} — ${PHONE_CONTACTS[contactId].number}`);
    }
  };

  const updateSelectedObj = (updates: Partial<Interactable>) => {
    if (!selectedObjId) return;
    setLocalRooms((prev) => {
      const next = { ...prev };
      const room = { ...next[currentRoomId] };
      room.interactables = room.interactables.map((obj) =>
        obj.id === selectedObjId ? { ...obj, ...updates } : obj
      );
      next[currentRoomId] = room;
      return next;
    });
  };

  const [dragState, setDragState] = useState<{
    objId: string; type: 'move' | 'resize';
    startMouseX: number; startMouseY: number;
    startX: number; startY: number; startW: number; startH: number;
  } | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);

  const handleDragMouseDown = useCallback((e: React.MouseEvent, obj: Interactable, type: 'move' | 'resize') => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedObjId(obj.id);
    setDragState({
      objId: obj.id, type,
      startMouseX: e.clientX, startMouseY: e.clientY,
      startX: obj.x, startY: obj.y, startW: obj.width || 0, startH: obj.height || 0,
    });
  }, []);

  useEffect(() => {
    if (!dragState) return;
    const handleMouseMove = (e: MouseEvent) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const rect = vp.getBoundingClientRect();
      const dxPct = ((e.clientX - dragState.startMouseX) / rect.width) * 100;
      const dyPct = ((e.clientY - dragState.startMouseY) / rect.height) * 100;
      setLocalRooms((prev) => {
        const next = { ...prev };
        const room = { ...next[currentRoomId] };
        room.interactables = room.interactables.map((obj) => {
          if (obj.id !== dragState.objId) return obj;
          if (dragState.type === 'move') {
            return { ...obj, x: Math.round((dragState.startX + dxPct) * 10) / 10, y: Math.round((dragState.startY + dyPct) * 10) / 10 };
          } else {
            const newW = Math.max(3, Math.round((dragState.startW + dxPct) * 10) / 10);
            const newH = Math.max(3, Math.round((dragState.startH + dyPct) * 10) / 10);
            return { ...obj, width: newW, height: newH };
          }
        });
        next[currentRoomId] = room;
        return next;
      });
    };
    const handleMouseUp = () => { setDragState(null); };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, currentRoomId]);

  const handleDownloadJSON = useCallback(() => {
    const exportData = {
      ITEM_NAMES,
      GAME_ROOMS: Object.fromEntries(
        Object.entries(localRooms).map(([id, room]) => [id, {
          id: (room as Room).id,
          name: (room as Room).name,
          description: (room as Room).description,
interactables: (room as Room).interactables.map(({ id, icon, x, y, width, height, hideIcon, type, label, description, requiredItem, failedMessage, successMessage, targetRoom, pickupItem, phoneCallId, documentData, hideAfterInteract }) => {
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
  }, [localRooms]);

  const currentRoom: Room = localRooms[currentRoomId] || localRooms['escritorio'];

  useEffect(() => {
    if (!visitedRooms.includes(currentRoomId)) {
      setVisitedRooms((prev) => [...prev, currentRoomId]);
    }
    if (currentRoomId !== 'escritorio' || visitedRooms.length > 1) {
      addLog(`Entrou em: ${currentRoom.name}`);
      addLog(currentRoom.description);
    }
  }, [currentRoomId]);

  const handleInteract = (obj: Interactable, e?: React.MouseEvent) => {
    if (devMode) {
      if (e) e.stopPropagation();
      setSelectedObjId(obj.id);
      return;
    }

    if (obj.requiredItem && !inventory.includes(obj.requiredItem)) {
      Audio.playDenied();
      addLog(obj.failedMessage || `[ACESSO NEGADO] Requer o item apropriado para interagir com: ${obj.label}`);
      return;
    }

    if (obj.type === 'travel' && obj.targetRoom) {
      Audio.playDoor();
      if (obj.successMessage) addLog(obj.successMessage);
      setCurrentRoomId(obj.targetRoom);
} else if (obj.type === 'pickup' && obj.pickupItem) {
    Audio.playPickup();
    if (!inventory.includes(obj.pickupItem)) {
      setInventory([...inventory, obj.pickupItem]);
      addLog(obj.description || `Você pegou: ${ITEM_NAMES[obj.pickupItem] || obj.pickupItem}`);
    }
    if (obj.pickupItem === 'cartao_visita') {
      discoverContact('diretora_elvira');
    }
  } else if (obj.type === 'terminal_read' && obj.documentData) {
    if (obj.id === 'puzzle_deduction_terminal') {
      Audio.playTerminal();
      setDeductionOpen(true);
      setDeductionResult(null);
      addLog('Acessando quadro de dedução...');
      Audio.speak(obj.id);
    } else {
      Audio.playTerminal();
      setDocumentData(obj.documentData);
      addLog(`Acessando arquivo: ${obj.label}...`);
      Audio.speak(obj.id);
    }
  } else if (obj.type === 'inspect') {
    Audio.playTypewriter();
    addLog(`[${obj.label}] ${obj.description}`);
      } else if (obj.type === 'phone_call') {
      if (obj.phoneCallId) {
        const contact = PHONE_CONTACTS[obj.phoneCallId];
        if (!contact) return;
        discoverContact(obj.phoneCallId);
        if (calledContacts.has(obj.phoneCallId)) {
          if (inventory.includes('gravador_cassete')) {
            Audio.playTerminal();
            addLog(`[FITA] A fita cassete captou a conversa com ${contact.name}. Use a agenda para ouvir.`);
          } else {
            Audio.playDenied();
            addLog(`[TELEFONE] Linha ocupada. ${contact.name} não atende.`);
          }
          return;
        }
        if (obj.phoneCallId === 'seu_jonas') {
          Audio.playTypewriter();
        } else {
          Audio.playTerminal();
        }
        setActivePhoneCall({ contactId: obj.phoneCallId, nodeId: 'initial', linesShown: 0, visitedNodes: [] });
        addLog(obj.phoneCallId === 'seu_jonas'
          ? `[CARTA] Lendo carta de ${contact.name}...`
          : `[TELEFONE] Ligando para ${contact.name}...`);
      } else {
        Audio.playTerminal();
        setPhoneAgendaOpen(true);
        addLog('[TELEFONE] Abrindo agenda telefônica...');
      }
  }

  if (obj.id.startsWith('puzzle_hint_')) {
    setReadHints(prev => { const next = new Set(prev); next.add(obj.id); return next; });
  }

  if (obj.hideAfterInteract && !interactedItems.includes(obj.id)) {
      setInteractedItems([...interactedItems, obj.id]);
    }
  };

  const closeDocument = () => {
    Audio.playHover();
    Audio.stopSpeak();
    setDocumentData(null);
  };

  const handleMapTravel = (roomId: string) => {
    if (!visitedRooms.includes(roomId)) {
      Audio.playDenied();
      addLog(`[NAVEGAÇÃO] ${GAME_ROOMS[roomId].name} ainda não foi explorado.`);
      return;
    }
    if (currentRoomId === roomId) {
      Audio.playDenied();
      return;
    }
    Audio.playDoor();
    setIsMapOpen(false);
    setCurrentRoomId(roomId);
    addLog(`[NAVEGAÇÃO] Indo para: ${GAME_ROOMS[roomId].name}`);
  };

  const mapLayout: Record<string, { x: number; y: number }> = {
    escritorio: { x: 30, y: 60 },
    rua_chuva: { x: 50, y: 60 },
    bar: { x: 20, y: 40 },
    escola: { x: 50, y: 35 },
    diretoria: { x: 70, y: 25 },
    delegacia: { x: 75, y: 50 },
    beco: { x: 35, y: 25 },
    armazem: { x: 55, y: 15 },
  };

  return (
    <div className="flex flex-col h-screen w-full bg-noir-dark text-white font-mono uppercase relative overflow-hidden select-none">
      <div className="crt-overlay" />
      <div className="scanline" />

      {/* Header */}
      <header className="border-b-2 border-noir-amber h-16 flex items-center px-4 justify-between bg-black z-20">
        <div className="flex items-center gap-3 text-noir-amber">
          <Briefcase size={28} />
          <div>
            <h1 className="text-xl font-bold tracking-widest border-b border-noir-amber inline-block border-opacity-30" style={{ fontFamily: 'Playfair Display, serif' }}>
              MURPHY LAW
            </h1>
            <p className="text-[10px] text-amber-600 tracking-wider">INVESTIGAÇÕES PRIVADAS</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={() => { Audio.playHover(); setIsSettingsOpen(true); }}
            className="text-zinc-500 hover:text-noir-amber transition-colors"
            title="Configurações"
          >
            <Settings size={20} />
          </button>
          {/* HUD */}
          <div className="flex items-center gap-4 text-xs">
          </div>
          <button
            onClick={() => { setDevMode(!devMode); setSelectedObjId(null); }}
            className={`flex items-center gap-2 px-3 py-1 border text-xs ${devMode ? 'bg-noir-amber text-black border-noir-amber' : 'text-gray-500 border-zinc-700 hover:text-zinc-300 hover:border-zinc-500'} transition-colors`}
          >
            <Bug size={14} /> DEV
          </button>
          <div className="text-right">
            <p className="text-zinc-500 text-xs">LOCAL:</p>
            <p className="text-sm font-bold text-noir-amber">{currentRoom.name}</p>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <div className="flex flex-1 overflow-hidden z-10 relative">

        {/* Environment Viewport */}
        <div ref={viewportRef} className="flex-1 bg-zinc-950 relative border-r border-zinc-900 overflow-hidden shadow-inner group">
          <div className="absolute inset-0 bg-black pointer-events-none" />

          {currentRoom.bgImage && (
            <img
              src={currentRoom.bgImage}
              alt={currentRoom.name}
              className="absolute inset-0 w-full h-full object-cover opacity-90 pointer-events-none transition-opacity duration-1000"
            />
          )}

          <div className="rain-overlay" />
          <div className="fog-overlay" />
          <div className="vignette-overlay" />

          {currentRoom.interactables.map((obj) => {
            if (!devMode && interactedItems.includes(obj.id)) return null;

            const IconCmp = IconMap[obj.icon] || IconMap['Search'];
            const hasItemImage = obj.type === 'pickup' && obj.pickupItem && ITEM_IMAGES[obj.pickupItem];
            const isSelected = devMode && selectedObjId === obj.id;
            const isBoxArea = obj.width && obj.height;
            const isHiddenIcon = obj.hideIcon;
            const isDragging = dragState?.objId === obj.id;

            return (
              <div
                key={obj.id}
                className={`absolute ${isBoxArea ? '' : '-translate-x-1/2 -translate-y-1/2'} z-30 ${isSelected ? 'ring-4 ring-noir-amber ring-offset-2 ring-offset-zinc-900' : ''} ${devMode && isHiddenIcon ? 'border-2 border-dashed border-noir-red bg-noir-red/20' : ''}`}
                style={{
                  left: `${obj.x}%`, top: `${obj.y}%`,
                  width: isBoxArea ? `${obj.width}%` : undefined,
                  height: isBoxArea ? `${obj.height}%` : undefined,
                  ...(isDragging ? { userSelect: 'none' as const } : {}),
                }}
                onMouseDown={devMode ? (e) => handleDragMouseDown(e, obj, 'move') : undefined}
                onClick={!devMode ? (e) => handleInteract(obj, e) : undefined}
                onMouseEnter={!devMode ? () => Audio.playHover() : undefined}
              >
                <button
                  className={`w-full h-full flex flex-col items-center justify-center text-zinc-300 ${!devMode ? 'hover:text-noir-amber hover:scale-110 cursor-pointer' : 'cursor-grab'} transition-all duration-200 ${isBoxArea ? '' : 'p-4'}`}
                  style={{ pointerEvents: 'auto' }}
                  tabIndex={-1}
                >
                  {!isHiddenIcon && hasItemImage ? (
                    <img src={ITEM_IMAGES[obj.pickupItem!]} alt={obj.label} className={`w-16 h-16 object-cover border border-zinc-500 rounded shadow-[0_0_15px_rgba(212,168,71,0.3)] transition-all ${!devMode ? 'opacity-0' : 'opacity-100'}`} />
                  ) : (!isHiddenIcon ? (
                    <IconCmp size={isBoxArea ? 24 : 48} className={`drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] filter ${!devMode ? 'opacity-0' : 'opacity-100'}`} />
                  ) : null)}

                  {devMode && (
                    <span className="text-xs font-bold tracking-widest bg-black bg-opacity-80 px-2 py-1 rounded shadow-lg border border-zinc-800 mt-2 whitespace-nowrap pointer-events-none">
                      {obj.label}
                    </span>
                  )}
                </button>

                {devMode && isSelected && isBoxArea && (
                  <div
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-noir-amber border-2 border-black z-40"
                    onMouseDown={(e) => handleDragMouseDown(e, obj, 'resize')}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Right Panel: Inventory */}
        <div className="w-56 bg-black p-4 flex flex-col z-20">
          <h2 className="text-noir-amber border-b border-noir-amber mb-4 text-sm tracking-widest">EVIDÊNCIAS</h2>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
            {inventory.length === 0 ? (
              <p className="text-zinc-600 text-xs text-center py-8">VAZIO</p>
            ) : (
              inventory.map((item) => (
                <div key={item} className="bg-zinc-900 border border-zinc-800 p-2 text-xs flex flex-col items-center gap-2 text-zinc-300">
                  {ITEM_IMAGES[item] ? (
                    <img src={ITEM_IMAGES[item]} alt={ITEM_NAMES[item] || item} className="w-12 h-12 object-cover border border-zinc-700 shadow-md" />
                  ) : (
                    <IconMap.Key size={24} className="text-noir-amber" />
                  )}
                  <span className="text-center text-[10px]">{ITEM_NAMES[item] || item}</span>
                </div>
              ))
)}

{/* Phone Agenda Modal */}
{phoneAgendaOpen && !activePhoneCall && (
  <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-8">
    <div className="border border-noir-amber bg-zinc-950 w-full max-w-lg max-h-full flex flex-col shadow-[0_0_30px_rgba(212,168,71,0.15)] relative animate-in fade-in zoom-in duration-200">
      <div className="border-b border-noir-amber p-4 bg-black flex justify-between items-center text-noir-amber">
        <h2 className="font-bold text-lg tracking-widest flex items-center gap-3" style={{ fontFamily: 'Playfair Display, serif' }}>
          <Phone size={20} />
          AGENDA TELEFÔNICA
        </h2>
        <button
          onClick={() => { Audio.playHover(); setPhoneAgendaOpen(false); }}
          onMouseEnter={() => Audio.playHover()}
          className="text-noir-amber hover:text-white bg-zinc-900 px-4 py-1 text-sm border border-zinc-700 flex items-center gap-2"
        >
          <X size={16} /> FECHAR
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {discoveredContacts.size === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-8 tracking-widest">NENHUM CONTATO CONHECIDO</p>
        ) : (
                (Array.from(discoveredContacts) as string[]).map((contactId) => {
                  const contact = PHONE_CONTACTS[contactId];
                  if (!contact) return null;
                  const isLetter = contactId === 'seu_jonas';
                  const wasCalled = calledContacts.has(contactId);
                  const hasRecorder = inventory.includes('gravador_cassete');
                  const hasRecording = !!phoneRecordings[contactId];
                  return (
                    <button
                      key={contactId}
                      onClick={() => {
                        if (wasCalled) {
                          if (hasRecorder && hasRecording) {
                            Audio.playTerminal();
                            setPhoneAgendaOpen(false);
                            setCassettePlayback({ contactId, lines: phoneRecordings[contactId] });
                            addLog(isLetter
                              ? `[FITA] Reouvido gravação da carta de ${contact.name}...`
                              : `[FITA] Reouvindo gravação de ${contact.name}...`);
                          } else {
                            Audio.playDenied();
                            addLog(`[TELEFONE] ${isLetter ? 'Carta já lida.' : 'Linha ocupada.'} ${hasRecorder ? '' : 'Gravador cassete necessário para gravar conversas.'}`);
                          }
                          return;
                        }
                        Audio.playTerminal();
                        setPhoneAgendaOpen(false);
                        setActivePhoneCall({ contactId, nodeId: 'initial', linesShown: 0, visitedNodes: [] });
                        addLog(isLetter
                          ? `[CARTA] Lendo carta de ${contact.name}...`
                          : `[TELEFONE] Ligando para ${contact.name} (${contact.number})...`);
                      }}
                      onMouseEnter={() => Audio.playHover()}
                      className={`w-full bg-zinc-900 border border-zinc-800 hover:border-noir-amber p-3 flex items-center gap-4 text-left transition-colors group ${wasCalled && !hasRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="w-10 h-10 border border-zinc-700 group-hover:border-noir-amber flex items-center justify-center bg-black">
                        {wasCalled && hasRecording && hasRecorder ? (
                          <Play size={18} className="text-noir-amber" />
                        ) : isLetter ? (
                          <Mail size={18} className="text-zinc-500 group-hover:text-noir-amber" />
                        ) : (
                          <PhoneCall size={18} className="text-zinc-500 group-hover:text-noir-amber" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-300 text-xs font-bold tracking-wider truncate group-hover:text-noir-amber transition-colors">{contact.name}</p>
                        <p className="text-zinc-600 text-[10px] tracking-wide">{isLetter ? 'CARTA NO BECO' : contact.number}</p>
                      </div>
                      <span className={`text-[9px] tracking-widest ${wasCalled && hasRecording && hasRecorder ? 'text-noir-amber' : wasCalled ? 'text-zinc-700' : 'text-zinc-700 group-hover:text-zinc-400'}`}>
                        {wasCalled && hasRecording && hasRecorder ? 'OUVIR FITA' : wasCalled ? (isLetter ? 'GELESEN' : 'GETRENNT') : (isLetter ? 'LER' : 'LIGAR')}
                      </span>
                    </button>
                  );
                })
        )}
      </div>

      <div className="h-8 bg-black border-t border-noir-amber text-noir-amber text-xs flex items-center px-4 justify-between">
        <span>CONTATOS: {discoveredContacts.size}</span>
        <span className="animate-pulse">LINHA ESTATAL</span>
      </div>
    </div>
  </div>
)}

{/* Phone Call / Letter Dialogue Modal */}
{activePhoneCall && (() => {
  const contact = PHONE_CONTACTS[activePhoneCall.contactId];
  if (!contact) return null;
  const node = contact.dialogue[activePhoneCall.nodeId];
  if (!node) return null;
  const isLetter = activePhoneCall.contactId === 'seu_jonas';
  const isCallEnded = node.choices.length === 0;

      const handleChoice = (choice: { text: string; goto: string; hint: boolean }) => {
        if (choice.hint) {
          setReadHints(prev => { const next = new Set(prev); next.add(`phone_${activePhoneCall.contactId}_${choice.goto}`); return next; });
        }
        if (choice.goto === 'reveal_dra_cunha' || activePhoneCall.contactId === 'zeca' && choice.text.includes('Dra. Cunha')) {
          discoverContact('dra_cunha');
        }
        Audio.playTypewriter();
        setActivePhoneCall(prev => prev ? { ...prev, nodeId: choice.goto, linesShown: 0, visitedNodes: [...prev.visitedNodes, prev.nodeId] } : null);
      };

    const handleClose = () => {
      Audio.playHover();
      Audio.stopSpeak();
      if (!calledContacts.has(activePhoneCall.contactId)) {
        const allNodes = [...activePhoneCall.visitedNodes, activePhoneCall.nodeId];
        const recording: { speaker: string; lines: string[] }[] = [];
        for (const nid of allNodes) {
          const n = contact.dialogue[nid];
          if (n) recording.push({ speaker: n.speaker, lines: n.lines });
        }
        setCalledContacts(prev => { const next = new Set(prev); next.add(activePhoneCall.contactId); return next; });
        setPhoneRecordings(prev => ({ ...prev, [activePhoneCall.contactId]: recording }));
      }
      setActivePhoneCall(null);
    };

  return (
    <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="border border-noir-amber bg-zinc-950 w-full max-w-xl max-h-full flex flex-col shadow-[0_0_30px_rgba(212,168,71,0.15)] relative">
        <div className="border-b border-noir-amber p-4 bg-black flex justify-between items-center">
          <h2 className="text-noir-amber font-bold text-sm tracking-widest flex items-center gap-3" style={{ fontFamily: 'Playfair Display, serif' }}>
            {isLetter ? <Mail size={18} /> : <PhoneCall size={18} />}
            {isLetter ? `CARTA — ${contact.name.toUpperCase()}` : `${contact.number} — ${contact.name.toUpperCase()}`}
          </h2>
          <button
            onClick={handleClose}
            onMouseEnter={() => Audio.playHover()}
            className="text-white hover:text-noir-amber bg-zinc-900 px-4 py-1 text-sm border border-zinc-700 flex items-center gap-2"
          >
            <X size={16} /> {isCallEnded ? 'FECHAR' : 'DESLIGAR'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[200px] max-h-[50vh]">
          {activePhoneCall.nodeId === 'initial' && contact.greeting && (
            <p className="text-zinc-500 text-xs italic tracking-wide border-b border-zinc-800 pb-3">
              {contact.greeting}
            </p>
          )}

          <div className="space-y-2">
            <p className="text-noir-amber text-[10px] font-bold tracking-widest border-b border-zinc-900 pb-1">
              {node.speaker.toUpperCase()}:
            </p>
            {node.lines.map((line, i) => (
              <p key={i} className="text-zinc-300 text-sm tracking-wide leading-relaxed pl-2 border-l-2 border-zinc-800">
                {line}
              </p>
            ))}
          </div>
        </div>

        {!isCallEnded ? (
          <div className="border-t border-noir-amber p-4 bg-black/50 space-y-2">
            <p className="text-zinc-600 text-[10px] tracking-widest mb-2">SUAS OPÇÕES:</p>
            {node.choices.map((choice, i) => (
              <button
                key={i}
                onClick={() => handleChoice(choice)}
                onMouseEnter={() => Audio.playHover()}
                className="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-noir-amber text-zinc-300 hover:text-noir-amber p-3 text-xs tracking-wide transition-colors flex items-center gap-3"
              >
                <span className="text-noir-amber font-bold text-[10px]">{String(i + 1).padStart(2, '0')}</span>
                <span className="flex-1">{choice.text}</span>
                {choice.hint && <span className="text-[8px] text-amber-700 border border-amber-900 px-1">PISTA</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="border-t border-noir-amber p-4 bg-black/50">
            <p className="text-noir-red text-xs tracking-widest text-center animate-pulse">
              {isLetter ? '— FIM DA CARTA —' : '*C L I C*'}
            </p>
          </div>
        )}

        <div className="h-8 bg-black border-t border-noir-amber text-noir-amber text-xs flex items-center px-4 justify-between">
          <span>{isLetter ? 'BRIEF' : 'TELEFON'}</span>
          <span className="animate-pulse">{isLetter ? 'GELESEN' : isCallEnded ? 'GETRENNT' : 'VERBUNDEN'}</span>
        </div>
      </div>
    </div>
  );
              })()}

              {/* Cassette Playback Modal */}
              {cassettePlayback && (() => {
                const contact = PHONE_CONTACTS[cassettePlayback.contactId];
                if (!contact) return null;
                const isLetter = cassettePlayback.contactId === 'seu_jonas';
                return (
                  <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="border border-noir-amber bg-zinc-950 w-full max-w-xl max-h-full flex flex-col shadow-[0_0_30px_rgba(212,168,71,0.15)] relative">
                      <div className="border-b border-noir-amber p-4 bg-black flex justify-between items-center">
                        <h2 className="text-noir-amber font-bold text-sm tracking-widest flex items-center gap-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                          <Play size={18} />
                          {isLetter ? `FITA — CARTA DE ${contact.name.toUpperCase()}` : `FITA — ${contact.number}`}
                        </h2>
                        <button
                          onClick={() => { Audio.playHover(); setCassettePlayback(null); }}
                          onMouseEnter={() => Audio.playHover()}
                          className="text-white hover:text-noir-amber bg-zinc-900 px-4 py-1 text-sm border border-zinc-700 flex items-center gap-2"
                        >
                          <X size={16} /> PARAR
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[200px] max-h-[50vh]">
                        {cassettePlayback.contactId !== 'seu_jonas' && (
                          <p className="text-zinc-600 text-xs italic tracking-wide border-b border-zinc-800 pb-3">
                            *estática* ... gravação recuperada da fita cassete ...
                          </p>
                        )}
                        {cassettePlayback.lines.map((block, i) => (
                          <div key={i} className="space-y-2">
                            <p className="text-noir-amber text-[10px] font-bold tracking-widest border-b border-zinc-900 pb-1">
                              {block.speaker.toUpperCase()}:
                            </p>
                            {block.lines.map((line, j) => (
                              <p key={j} className="text-zinc-400 text-sm tracking-wide leading-relaxed pl-2 border-l-2 border-zinc-800 italic">
                                {line}
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-noir-amber p-4 bg-black/50">
                        <p className="text-amber-800 text-xs tracking-widest text-center">
                          — FIM DA FITA —
                        </p>
                      </div>

                      <div className="h-8 bg-black border-t border-noir-amber text-noir-amber text-xs flex items-center px-4 justify-between">
                        <span>KASSETTE</span>
                        <span className="animate-pulse">ABGESPIELT</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

</div>
<button
      onClick={() => { Audio.playTypewriter(); setIsMapOpen(true); }}
      onMouseEnter={() => Audio.playHover()}
      className="mt-4 border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-noir-amber hover:border-noir-amber p-2 flex items-center justify-center gap-2 text-xs tracking-widest transition-colors"
    >
      <MapIcon size={14} /> MAPA DA CIDADE
    </button>
    <button
      onClick={() => { Audio.playTerminal(); setPhoneAgendaOpen(true); }}
      onMouseEnter={() => Audio.playHover()}
      className="mt-2 border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-noir-amber hover:border-noir-amber p-2 flex items-center justify-center gap-2 text-xs tracking-widest transition-colors"
    >
      <Phone size={14} /> AGENDA <span className="text-noir-amber">({discoveredContacts.size})</span>
    </button>
        </div>
      </div>

      {/* Bottom Panel: Log Terminal / Dev Inspector */}
      {devMode ? (
        <footer className="h-48 bg-zinc-950 border-t-2 border-noir-amber p-4 font-mono text-sm overflow-y-auto flex flex-col relative z-20">
          <div className="text-noir-amber mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2"><Bug size={14}/> INSPECTOR</span>
            <button onClick={handleDownloadJSON} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-400 px-2 py-1 transition-colors"><Download size={12}/> BAIXAR JSON</button>
          </div>
          {selectedObjId ? (() => {
            const obj = currentRoom.interactables.find(i => i.id === selectedObjId);
            if (!obj) return <p className="text-zinc-500">Objeto não encontrado.</p>;
const fields: [string, string | number | boolean | undefined][] = [
      ['id', obj.id], ['type', obj.type], ['icon', obj.icon], ['label', obj.label],
      ['x', obj.x], ['y', obj.y], ['width', obj.width], ['height', obj.height],
      ['hideIcon', obj.hideIcon], ['description', obj.description],
      ['requiredItem', obj.requiredItem], ['failedMessage', obj.failedMessage],
      ['successMessage', obj.successMessage], ['targetRoom', obj.targetRoom],
      ['pickupItem', obj.pickupItem], ['phoneCallId', obj.phoneCallId],
      ['hideAfterInteract', obj.hideAfterInteract],
    ];
            return (
              <div className="flex-1 overflow-y-auto space-y-0.5 text-xs">
                {fields.map(([key, val]) => val !== undefined && val !== '' ? (
                  <div key={key} className="flex">
                    <span className="text-noir-amber w-28 shrink-0">{key}:</span>
                    <span className="text-zinc-300 break-all">{typeof val === 'string' ? `"${val}"` : String(val)}</span>
                  </div>
                ) : null)}
                {obj.documentData && (
                  <div className="mt-1">
                    <span className="text-noir-amber">documentData:</span>
                    <div className="ml-4 mt-0.5 text-zinc-400">
                      <div>title: <span className="text-zinc-300">"{obj.documentData.title}"</span></div>
                      <div>content: <span className="text-zinc-300">[{obj.documentData.content.length} items]</span></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })() : (
            <p className="text-zinc-500 text-xs">Clique em um objeto para inspecionar.</p>
          )}
        </footer>
      ) : (
        <footer className="h-48 bg-zinc-950 border-t-2 border-zinc-900 p-4 font-mono text-sm overflow-hidden flex flex-col relative z-20">
          <div className="text-noir-amber mb-2 flex items-center gap-2 bg-transparent">
            <Wine size={14} /> DIÁRIO DE MURPHY
          </div>
          <div className="flex-1 w-full overflow-hidden" ref={xtermRef} />
        </footer>
      )}

      {/* Map Modal */}
      {isMapOpen && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="border border-noir-amber bg-zinc-950 w-full max-w-4xl h-[80vh] flex flex-col shadow-[0_0_30px_rgba(212,168,71,0.15)] relative animate-in fade-in zoom-in duration-200">
            <div className="border-b border-noir-amber p-4 bg-black flex justify-between items-center text-noir-amber">
              <h2 className="font-bold text-xl tracking-widest flex items-center gap-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                <MapIcon />
                MAPA DA CIDADE
              </h2>
              <button
                onClick={() => { Audio.playHover(); setIsMapOpen(false); }}
                onMouseEnter={() => Audio.playHover()}
                className="text-noir-amber hover:text-white bg-zinc-900 px-4 py-1 text-sm border border-zinc-700 flex items-center gap-2"
              >
                <X size={16} /> FECHAR
              </button>
            </div>

            <div className="flex-1 relative bg-black overflow-hidden">
              <div className="absolute inset-0 bg-zinc-950/50" />
              <div className="absolute inset-0 pointer-events-none border-[10px] border-black/50" />

              {/* Connections */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30 stroke-noir-amber" strokeWidth="1" strokeDasharray="8 4">
                <line x1="30%" y1="60%" x2="50%" y2="60%" />
                <line x1="50%" y1="60%" x2="20%" y2="40%" />
                <line x1="50%" y1="60%" x2="50%" y2="35%" />
                <line x1="50%" y1="35%" x2="70%" y2="25%" />
                <line x1="50%" y1="60%" x2="75%" y2="50%" />
                <line x1="50%" y1="35%" x2="35%" y2="25%" />
                <line x1="35%" y1="25%" x2="55%" y2="15%" />
              </svg>

              {/* Map Nodes */}
              {Object.keys(GAME_ROOMS).map((roomId) => {
                const room = GAME_ROOMS[roomId];
                const isVisited = visitedRooms.includes(roomId);
                const isCurrent = currentRoomId === roomId;
                const coords = mapLayout[roomId] || { x: 50, y: 50 };

                return (
                  <button
                    key={roomId}
                    onClick={() => handleMapTravel(roomId)}
                    onMouseEnter={() => Audio.playHover()}
                    className={`absolute w-28 h-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center text-[10px] tracking-wider transition-all duration-300 overflow-hidden rounded-sm
                      ${isCurrent ? 'border-2 border-noir-amber text-noir-amber scale-110 shadow-[0_0_15px_rgba(212,168,71,0.5)] z-20'
                        : isVisited ? 'border border-zinc-600 text-zinc-300 hover:border-noir-amber hover:text-noir-amber z-10'
                        : 'bg-black border border-zinc-800 text-zinc-700 border-dashed cursor-not-allowed z-0'}`}
                    style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                    title={isVisited ? "Ir para " + room.name : "Não explorado"}
                  >
                    {isVisited && room.mapImage && (
                      <div className="absolute inset-0 z-0">
                        <img src={room.mapImage} alt={room.name} className="w-full h-full object-cover opacity-50" />
                        <div className="absolute inset-0 bg-black/40" />
                      </div>
                    )}

                    {!isVisited && <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-[1px] flex items-center justify-center text-[9px] text-zinc-600 z-10">[?]</div>}

                    <div className="font-bold mb-0.5 z-10 relative px-1 bg-black/60 rounded text-[9px]">{room.name.split('—')[0].trim()}</div>
                    {isCurrent && <span className="absolute -bottom-5 text-noir-amber bg-black px-2 py-0.5 rounded shadow whitespace-nowrap text-[8px] animate-pulse z-10">VOCÊ ESTÁ AQUI</span>}
                  </button>
                );
              })}
            </div>

            <div className="h-8 bg-black border-t border-noir-amber text-noir-amber text-xs flex items-center px-4 justify-between">
              <span>LOCAIS: {visitedRooms.length} / {Object.keys(GAME_ROOMS).length}</span>
              <span className="animate-pulse">RASTREAMENTO ATIVO</span>
            </div>
          </div>
        </div>
      )}

      {/* Deduction Board Modal */}
      {deductionOpen && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="border border-noir-amber bg-zinc-950 w-full max-w-5xl max-h-full flex flex-col shadow-[0_0_30px_rgba(212,168,71,0.15)] relative">
            <div className="border-b border-noir-amber p-4 bg-black flex justify-between items-center">
              <h2 className="text-noir-amber font-bold text-lg tracking-widest flex items-center gap-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                <CheckCircle size={20} />
                DEDUKTIONSSYSTEM — FALL HELENA KRAFT
              </h2>
              <button
                onClick={() => { Audio.playHover(); setDeductionOpen(false); Audio.stopSpeak(); }}
                onMouseEnter={() => Audio.playHover()}
                className="text-white hover:text-noir-amber bg-zinc-900 px-4 py-1 text-sm border border-zinc-700 flex items-center gap-2"
              >
                <X size={16} /> FECHAR
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-zinc-500 text-xs mb-4 tracking-wide">CADA COLUNA = UM LOCAL DE INVESTIGAÇÃO. SELECIONE UM VALOR POR CATEGORIA. NENHUM VALOR PODE SE REPETIR NA MESMA LINHA.</p>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="border border-zinc-800 bg-black text-zinc-600 p-2 text-left w-24">CATEGORIA</th>
                      {DEDUCTION_LOCATIONS.map(loc => (
                        <th key={loc} className="border border-zinc-800 bg-black text-noir-amber p-2 text-center min-w-[140px]">{loc}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(['suspeito', 'local_crime', 'arma', 'motivo', 'horario'] as DeductionCategory[]).map(cat => {
                      const catLabel = { suspeito: 'SUSPEITO', local_crime: 'LOCAL DO CRIME', arma: 'ARMA', motivo: 'MOTIVO', horario: 'HORÁRIO' }[cat];
                      const options = DEDUCTION_CATEGORIES[cat];
                      const usedInRow: string[] = [];
                      DEDUCTION_LOCATIONS.forEach(loc => {
                        if (deductionGrid[loc][cat]) usedInRow.push(deductionGrid[loc][cat]);
                      });
                      return (
                        <tr key={cat}>
                          <td className="border border-zinc-800 bg-zinc-900 text-noir-amber p-2 font-bold tracking-wider">{catLabel}</td>
                          {DEDUCTION_LOCATIONS.map(loc => {
                            const current = deductionGrid[loc][cat];
                            const availableOptions = [...options].filter(o => !usedInRow.includes(o) || o === current);
                            const isDuplicate = current && usedInRow.filter(v => v === current).length > 1;
                            return (
                              <td key={loc} className={`border border-zinc-800 p-1 ${isDuplicate ? 'bg-noir-red/10' : 'bg-zinc-950'}`}>
                                <select
                                  value={current}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDeductionGrid(prev => ({
                                      ...prev,
                                      [loc]: { ...prev[loc], [cat]: val }
                                    }));
                                    Audio.playTypewriter();
                                  }}
                                  className={`w-full bg-black border ${isDuplicate ? 'border-noir-red' : current ? 'border-noir-amber' : 'border-zinc-700'} text-zinc-300 p-1.5 text-[11px] tracking-wide appearance-none cursor-pointer hover:border-noir-amber transition-colors ${current ? 'text-noir-amber font-bold' : ''}`}
                                >
                                  <option value="">—</option>
                                  {availableOptions.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {deductionResult === 'correct' && (
                <div className="mt-4 p-3 border border-green-800 bg-green-900/20 text-green-400 flex items-center gap-2 text-xs tracking-wider">
                  <CheckCircle size={16} />
                  DEDUÇÃO CORRETA — FALL HELENA KRAFT RESOLVIDO. O arquivo pode ser fechado.
                </div>
              )}
              {deductionResult === 'wrong' && (
                <div className="mt-4 p-3 border border-noir-red bg-noir-red/10 text-noir-red flex items-center gap-2 text-xs tracking-wider">
                  <AlertTriangle size={16} />
                  DEDUÇÃO INCORRETA — HÁ INCONSISTÊNCIAS. REVISE AS PISTAS.
                </div>
              )}

              <div className="mt-4 flex justify-between items-center">
                <p className="text-zinc-600 text-[10px]">
                  PISTAS COLETADAS: {readHints.size}
                </p>
                <button
                  onClick={() => {
                    Audio.playTerminal();
                    let allFilled = true;
                    let allCorrect = true;
                    for (const loc of DEDUCTION_LOCATIONS) {
                      for (const cat of Object.keys(DEDUCTION_CATEGORIES) as DeductionCategory[]) {
                        if (!deductionGrid[loc][cat]) { allFilled = false; break; }
                        if (deductionGrid[loc][cat] !== DEDUCTION_SOLUTION[loc][cat]) allCorrect = false;
                      }
                      if (!allFilled) break;
                    }
                    if (!allFilled) {
                      setDeductionResult('wrong');
                      addLog('[DEDUÇÃO] Preencha todos os campos antes de submeter.');
                    } else if (allCorrect) {
                      setDeductionResult('correct');
                      addLog('[DEDUÇÃO] ✅ DEDUÇÃO CORRETA — Caso Helena Kraft resolvido!');
                      Audio.playPickup();
                    } else {
                      setDeductionResult('wrong');
                      addLog('[DEDUÇÃO] ❌ Dedução incorreta. Revise as pistas.');
                      Audio.playDenied();
                    }
                  }}
                  onMouseEnter={() => Audio.playHover()}
                  className="border-2 border-noir-amber text-noir-amber px-6 py-2 hover:bg-noir-amber hover:text-black font-bold tracking-widest transition-colors text-sm"
                >
                  SUBMETER DEDUÇÃO
                </button>
              </div>
            </div>

            <div className="h-8 bg-black border-t border-noir-amber text-noir-amber text-xs flex items-center px-4 justify-between">
              <span>QUADRO DE DEDUÇÃO — DELEGACIA</span>
              <span className="animate-pulse">RASTREAMENTO ATIVO</span>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-8">
          <div className="border border-noir-amber bg-zinc-950 w-full max-w-md flex flex-col shadow-[0_0_30px_rgba(212,168,71,0.15)] animate-in fade-in zoom-in duration-200">
            <div className="border-b border-noir-amber p-4 bg-black flex justify-between items-center text-noir-amber">
              <h2 className="font-bold text-xl tracking-widest flex items-center gap-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                <Settings />
                CONFIGURAÇÕES
              </h2>
              <button
                onClick={() => { Audio.playHover(); setIsSettingsOpen(false); }}
                className="text-noir-amber hover:text-white bg-zinc-900 px-4 py-1 text-sm border border-zinc-700"
              >
                <X size={16} />
              </button>
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
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={Audio.volumes[item.id as keyof typeof Audio.volumes]}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        Audio.setVolume(item.id as any, val);
                        // Trigger re-render to update percentages
                        setLocalRooms({...localRooms});
                      }}
                      className="flex-1 accent-noir-amber bg-zinc-800 h-1 appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-zinc-900 bg-black/50 text-[10px] text-zinc-600 text-center tracking-widest">
              OPERAÇÕES DE ÁUDIO EM TEMPO REAL — SISTEMA MURPHY
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Document Modal */}
      {documentData && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="border border-noir-amber bg-zinc-950 w-full max-w-3xl max-h-full flex flex-col shadow-[0_0_30px_rgba(212,168,71,0.15)] relative animate-in fade-in zoom-in duration-200">
            <div className="border-b border-noir-amber p-4 bg-black flex justify-between items-center">
              <h2 className="text-noir-amber font-bold text-xl tracking-widest flex items-center gap-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                <FileText />
                {documentData.title}
              </h2>
              <button
                onClick={closeDocument}
                onMouseEnter={() => Audio.playHover()}
                className="text-white hover:text-noir-amber bg-zinc-900 px-4 py-1 text-sm border border-zinc-700"
              >
                FECHAR
              </button>
            </div>
            <div className="p-8 overflow-y-auto text-zinc-300 space-y-4 tracking-wide leading-relaxed text-sm h-[60vh]">
              {documentData.content.map((paragraph, index) => (
                <p key={index} className={paragraph.startsWith('>') || paragraph.startsWith('AVISO') || paragraph.startsWith('URGENTE') || paragraph.startsWith('CONFIDENCIAL') ? 'text-noir-red font-bold' : paragraph.startsWith('//') ? 'text-noir-amber italic' : ''}>
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);

  if (!hasStarted) {
    return (
      <div className="flex flex-col h-screen w-full bg-noir-dark text-white font-mono uppercase relative items-center justify-center select-none">
        <div className="crt-overlay" />
        <div className="scanline" />
        <div className="rain-overlay" />
        <div className="vignette-overlay" />
        <h1 className="text-5xl text-noir-amber font-bold mb-2 tracking-widest text-center shadow-black drop-shadow-lg" style={{ fontFamily: 'Playfair Display, serif' }}>
          MURPHY LAW
        </h1>
        <p className="text-lg text-amber-700 mb-8 tracking-widest">INVESTIGAÇÕES PRIVADAS</p>
    <p className="text-zinc-500 text-xs mb-8 max-w-md text-center normal-case tracking-normal">
      A chuva não para. O schnapps acabou. Maria Kraft depositou Mk 500 na mesa — tudo que tinha.
      Helena, 9 anos, desaparecida há 3 semanas. A Volkspolizei arquiva. A cidade esquece.
      Murphy Law não esquece.
    </p>
        <button
          onClick={() => { Audio.init(); Audio.startAmbient(); setHasStarted(true); }}
          className="relative z-50 border-2 border-noir-amber text-noir-amber px-8 py-4 hover:bg-noir-amber hover:text-black font-bold tracking-widest transition-colors"
        >
          ACEITAR O CASO
        </button>
      </div>
    );
  }

  return <Game />;
}
