import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { GAME_ROOMS, Interactable, ITEM_NAMES, ITEM_IMAGES, Room, PHONE_CONTACTS, PhoneContact } from './data';
import { IconMap } from './Icons';
import { Audio } from './audio';
import { FileText, Map as MapIcon, X, Bug, Download, Wine, Briefcase, CheckCircle, AlertTriangle, Settings, Volume2, Phone, PhoneCall, Mail, Play, Archive, Package, Terminal, Eye } from 'lucide-react';
import { useXTerm } from 'react-xtermjs';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipTitle, TooltipBody } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody, DialogClose } from '@/components/ui/dialog';
import { Toaster } from 'sonner';
import { DevInspector } from '@/components/DevInspector';
import DetectiveBoard from '@/components/DetectiveBoard';
import { resolveItemUse, INTERACT } from '@/lib/itemUse';
import { adjustMenuPosition } from '@/lib/useMenuPosition';

function Game() {
  const PERMANENT_ITEMS = ['isqueiro', 'gravador_cassete'];
  const [currentRoomId, setCurrentRoomId] = useState<string>('escritorio');
  const [inventory, setInventory] = useState<string[]>(['isqueiro', 'gravador_cassete']);
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
  // Objects unlocked by using the right item — persists for the session: a
  // door/drawer opened once stays open and never asks for the item again.
  const [unlockedObjects, setUnlockedObjects] = useState<Set<string>>(new Set());
  // Left-click item context menu, anchored at the cursor (same pattern as
  // DevInspector's context menu — proven to work over the scene overlays).
  const [objMenu, setObjMenu] = useState<{ x: number; y: number; obj: Interactable } | null>(null);
  const objMenuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (objMenu && objMenuRef.current) adjustMenuPosition(objMenuRef.current, objMenu.x, objMenu.y);
  }, [objMenu]);
  const [readHints, setReadHints] = useState<Set<string>>(new Set());
  const [deductionOpen, setDeductionOpen] = useState(false);
  const [deductionResult, setDeductionResult] = useState<'correct' | 'wrong' | null>(null);

  const [discoveredContacts, setDiscoveredContacts] = useState<Set<string>>(new Set());
  const [calledContacts, setCalledContacts] = useState<Set<string>>(new Set());
  const [pdCutoffContacts, setPdCutoffContacts] = useState<Set<string>>(new Set());
const [pdChoiceHistory, setPdChoiceHistory] = useState<Record<string, string[]>>({});
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
  const [murphyCommentaryMap, setMurphyCommentaryMap] = useState<Record<string, string[]>>({});
  const [gameCompleted, setGameCompleted] = useState(false);
  const [readInterviewClues, setReadInterviewClues] = useState<Set<string>>(new Set());
const [cassetteMenuOpen, setCassetteMenuOpen] = useState(false);
const [mobileInventoryOpen, setMobileInventoryOpen] = useState(false);
const [mobileTerminalOpen, setMobileTerminalOpen] = useState(false);
const [deductionAttempts, setDeductionAttempts] = useState(0);

const calculateGameCompletion = () => {
const totalHints = 18;
const totalContacts = 5;
const hintsFound = readHints.size / totalHints;
const interviewsCompleted = [...calledContacts].filter(c => c !== 'agente_scp' && !pdCutoffContacts.has(c)).length / totalContacts;
const cluesRead = readInterviewClues.size / totalContacts;
const deductionScore = deductionResult === 'correct' ? Math.max(0.5, 1 - 0.1 * Math.max(0, deductionAttempts - 1)) : 0;

let tftCompliant = true;
const contactIds = Object.keys(PHONE_CONTACTS);
let anyInterviewHeld = false;
for (const cid of contactIds) {
if (cid === 'agente_scp') continue;
const history = pdChoiceHistory[cid] || [];
const contact = PHONE_CONTACTS[cid];
if (!contact || history.length === 0) continue;
anyInterviewHeld = true;
if (history[0] !== 'C') { tftCompliant = false; continue; }
const npcMoves: string[] = ['C'];
for (let i = 1; i < history.length; i++) {
const strategy = contact.axelrodStrategy;
const playerPrev = history[i - 1];
const playerAllDs = history.slice(0, i).filter(a => a === 'D').length;
let npcMove = 'C';
if (strategy === 'Grudger' && playerAllDs > 0) npcMove = 'D';
else if (strategy === 'TitForTat') npcMove = playerPrev === 'D' ? 'D' : 'C';
else if (strategy === 'SoftGrudger' && playerAllDs >= 2) npcMove = 'D';
else if (strategy === 'WinStayLoseShift') npcMove = playerPrev === 'D' ? 'D' : (i >= 2 && history[i - 2] === 'D' ? 'D' : 'C');
npcMoves.push(npcMove);
}
for (let i = 1; i < history.length; i++) {
if (history[i] === 'E') continue;
const expectedTft = npcMoves[i - 1];
if (history[i] !== expectedTft && history[i] !== 'E') { tftCompliant = false; break; }
}
}
if (!anyInterviewHeld) tftCompliant = false;

const weights = { hints: 0.20, interviews: 0.25, clues: 0.15, deduction: 0.25, tft: 0.15 };
const base = hintsFound * weights.hints
+ interviewsCompleted * weights.interviews
+ cluesRead * weights.clues
+ deductionScore * weights.deduction;
const tftBonus = tftCompliant ? weights.tft : 0;
const percent = Math.round((base + tftBonus) * 100);
return { percent, tftCompliant, hintsFound: readHints.size, interviewsCompleted: [...calledContacts].filter(c => c !== 'agente_scp' && !pdCutoffContacts.has(c)).length, cluesRead: readInterviewClues.size, deductionCorrect: deductionResult === 'correct', deductionAttempts };
};

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

useEffect(() => {
discoverContact('agente_scp');
}, []);

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

  const handleUpdateObj = useCallback((roomId: string, objId: string, updated: Interactable) => {
    setLocalRooms(prev => {
      const next = { ...prev };
      const room = { ...next[roomId] };
      room.interactables = room.interactables.map(obj => obj.id === objId ? updated : obj);
      next[roomId] = room;
      return next;
    });
  }, []);

  const handleAddObj = useCallback((roomId: string, obj: Interactable) => {
    setLocalRooms(prev => {
      const next = { ...prev };
      const room = { ...next[roomId] };
      room.interactables = [...room.interactables, obj];
      next[roomId] = room;
      return next;
    });
  }, []);

  const handleRemoveObj = useCallback((roomId: string, objId: string) => {
    setLocalRooms(prev => {
      const next = { ...prev };
      const room = { ...next[roomId] };
      room.interactables = room.interactables.filter(obj => obj.id !== objId);
      next[roomId] = room;
      return next;
    });
    if (selectedObjId === objId) setSelectedObjId(null);
  }, [selectedObjId]);

  const [dragState, setDragState] = useState<{
    objId: string; type: 'move' | 'resize';
    startMouseX: number; startMouseY: number;
    startX: number; startY: number; startW: number; startH: number;
  } | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const [panX, setPanX] = useState(0);
  const panState = useRef<{ startX: number; panStart: number; dragging: boolean } | null>(null);
  const wasPanning = useRef(false);

  const handlePanStart = useCallback((clientX: number) => {
    panState.current = { startX: clientX, panStart: panX, dragging: false };
  }, [panX]);

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
    setPanX(Math.max(minPan, Math.min(maxPan, panState.current.panStart + dx)));
  }, []);

  const handlePanEnd = useCallback(() => {
    if (panState.current?.dragging) wasPanning.current = true;
    panState.current = null;
    requestAnimationFrame(() => { wasPanning.current = false; });
  }, []);

  useEffect(() => {
    setPanX(0);
  }, [currentRoomId]);

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

  // Close the item menu on any outside click or Escape. Opening handlers call
  // stopPropagation so the opening click does not immediately close it.
  useEffect(() => {
    const close = () => setObjMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setObjMenu(null); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', onKey); };
  }, []);

  const handleInteract = (obj: Interactable, e?: React.MouseEvent) => {
    if (devMode) {
      if (e) e.stopPropagation();
      setSelectedObjId(obj.id);
      return;
    }

    // Item-gating + success/failed messaging now live in handleMenuSelect
    // (the left-click context menu). handleInteract just performs the action.
    if (obj.type === 'travel' && obj.targetRoom) {
      Audio.playDoor();
      setIsMapOpen(true);
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
if (obj.interviewGate && pdCutoffContacts.has(obj.interviewGate)) {
Audio.playDenied();
addLog(`[ACESSO NEGADO] Entrevista com ${obj.interviewGate} falhou. Documento selado.`);
} else if (obj.id === 'puzzle_deduction_terminal' || obj.id === 'detective_board') {
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
if (obj.id.startsWith('interview_clue_')) {
setReadInterviewClues(prev => { const next = new Set(prev); next.add(obj.id); return next; });
}
}
  } else if (obj.type === 'inspect') {
    Audio.playTypewriter();
    addLog(`[${obj.label}] ${obj.description}`);
} else if (obj.type === 'phone_call') {
if (obj.phoneCallId === 'seu_jonas') {
      const contact = PHONE_CONTACTS[obj.phoneCallId];
      if (!contact) return;
      discoverContact(obj.phoneCallId);
      if (pdCutoffContacts.has(obj.phoneCallId)) {
        Audio.playDenied();
        addLog(`[CARTA] Seu Jonas se recusa a escrever mais. A correspondência foi cortada.`);
        return;
      }
  if (calledContacts.has(obj.phoneCallId)) {
        Audio.playTerminal();
        addLog(`[FITA] A fita cassete captou a leitura da carta de ${contact.name}. Use a agenda para ouvir.`);
        return;
      }
    Audio.playTypewriter();
    setActivePhoneCall({ contactId: obj.phoneCallId, nodeId: 'initial', linesShown: 0, visitedNodes: [] });
    addLog(`[CARTA] Lendo carta de ${contact.name}...`);
  } else if (currentRoomId !== 'escritorio') {
    if (obj.phoneCallId) {
      const contact = PHONE_CONTACTS[obj.phoneCallId];
      if (contact) {
        discoverContact(obj.phoneCallId);
        Audio.playDenied();
        addLog(`[TELEFONE] Você encontrou o número de ${contact.name}. Volte ao escritório para ligar.`);
      }
    } else {
      Audio.playDenied();
      addLog('[TELEFONE] Você precisa voltar ao escritório para usar a agenda telefônica.');
    }
  } else {
if (obj.phoneCallId) {
        const contact = PHONE_CONTACTS[obj.phoneCallId];
        if (!contact) return;
        discoverContact(obj.phoneCallId);
        if (pdCutoffContacts.has(obj.phoneCallId)) {
          Audio.playDenied();
          addLog(`[TELEFONE] ${contact.name} não atende mais. O número foi cortado.`);
          return;
        }
  if (calledContacts.has(obj.phoneCallId)) {
      Audio.playTerminal();
      addLog(`[FITA] A fita cassete captou a conversa com ${contact.name}. Use a agenda para ouvir.`);
      return;
    }
      Audio.playTerminal();
      setActivePhoneCall({ contactId: obj.phoneCallId, nodeId: 'initial', linesShown: 0, visitedNodes: [] });
      addLog(`[TELEFONE] Ligando para ${contact.name}...`);
    } else {
      Audio.playTerminal();
      setPhoneAgendaOpen(true);
      addLog('[TELEFONE] Abrindo agenda telefônica...');
    }
  }
} else {
  // No actionable branch (e.g. travel without target, terminal without
  // document, or an unhandled type): always give the player feedback.
  Audio.playTypewriter();
  addLog(`[${obj.label}] Não há nada que você possa fazer aqui.`);
}

  if (obj.id.startsWith('puzzle_hint_')) {
    setReadHints(prev => { const next = new Set(prev); next.add(obj.id); return next; });
  }

  if (obj.hideAfterInteract && !interactedItems.includes(obj.id)) {
      setInteractedItems([...interactedItems, obj.id]);
    }
  };

  // Entry point for the left-click context menu. The player picks INTERACT
  // ("▸ Interagir") or an inventory item; resolveItemUse decides the outcome.
  const handleMenuSelect = (obj: Interactable, selection: string) => {
    const isUnlocked = unlockedObjects.has(obj.id);
    const outcome = resolveItemUse({ requiredItem: obj.requiredItem, selection, isUnlocked });

    if (outcome === 'denied') {
      Audio.playDenied();
      addLog(obj.failedMessage || `[ACESSO NEGADO] Requer o item apropriado para interagir com: ${obj.label}`);
      return;
    }
    if (outcome === 'not-applicable') {
      Audio.playHover();
      addLog(`[${obj.label}] Esse item não serve aqui.`);
      return;
    }
    if (outcome === 'unlock') {
      setUnlockedObjects((prev) => { const next = new Set(prev); next.add(obj.id); return next; });
      if (obj.successMessage) addLog(obj.successMessage);
    }
    // 'unlock' or 'interact' → perform the object's normal action.
    handleInteract(obj);
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
      <Button variant="frame" onClick={() => { Audio.playHover(); setIsSettingsOpen(true); }} className="text-zinc-500 hover:text-noir-amber transition-colors border-none bg-transparent px-2 py-1">
        <Settings size={18} className="md:w-5 md:h-5" />
      </Button>
      <Button variant="frame" onClick={() => { setDevMode(!devMode); setSelectedObjId(null); }} className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 text-xs ${devMode ? 'bg-noir-amber text-black border-noir-amber' : 'text-gray-500 border-zinc-700 hover:text-zinc-300 hover:border-zinc-500'} transition-colors`}>
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
{/* Scene layer: image at natural aspect, panned horizontally */}
        <div
          ref={sceneRef}
          className="relative h-full inline-block"
          style={{ transform: `translateX(${panX}px)`, transition: panState.current?.dragging ? 'none' : 'transform 0.15s ease-out' }}
        >
          {currentRoom.bgImage && (
            <img
              src={currentRoom.bgImage}
              alt={currentRoom.name}
              className="h-full w-auto opacity-90 pointer-events-none transition-opacity duration-1000 block"
              draggable={false}
              style={{ maxWidth: 'none' }}
            />
          )}
          <div className="rain-overlay" />

  {currentRoom.interactables.map((obj) => {
  if (!devMode && interactedItems.includes(obj.id)) return null;

  const IconCmp = IconMap[obj.icon] || IconMap['Search'];
  const hasItemImage = obj.type === 'pickup' && obj.pickupItem && ITEM_IMAGES[obj.pickupItem];
  const isSelected = devMode && selectedObjId === obj.id;
  const isBoxArea = obj.width && obj.height;
  const isHiddenIcon = obj.hideIcon;
  const isDragging = dragState?.objId === obj.id;
  const tooltipVariant = obj.type === 'pickup' ? 'safe' as const : obj.type === 'travel' ? 'euclid' as const : obj.type === 'terminal_read' ? 'keter' as const : 'thaumiel' as const;

  const wrapperClassName = `absolute ${isBoxArea ? '' : '-translate-x-1/2 -translate-y-1/2'} z-30 ${isSelected ? 'ring-4 ring-noir-amber ring-offset-2 ring-offset-zinc-900' : ''} ${devMode && isHiddenIcon ? 'border-2 border-dashed border-noir-red bg-noir-red/20' : ''}`;
  const wrapperStyle = {
    left: `${obj.x}%`, top: `${obj.y}%`,
    width: isBoxArea ? `${obj.width}%` : undefined,
    height: isBoxArea ? `${obj.height}%` : undefined,
    ...(isDragging ? { userSelect: 'none' as const } : {}),
  };

  const innerContent = (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className={`w-full h-full min-w-[44px] min-h-[44px] flex flex-col items-center justify-center text-zinc-300 ${!devMode ? 'hover:text-noir-amber cursor-pointer' : 'cursor-grab'} transition-colors duration-200 ${isBoxArea ? '' : 'p-4 md:p-4'} border-none bg-transparent`}
            style={{ pointerEvents: 'auto' }}
            tabIndex={-1}
          >
            {!isHiddenIcon && hasItemImage ? (
              <img src={ITEM_IMAGES[obj.pickupItem!]} alt={obj.label} className={`w-16 h-16 object-cover border border-zinc-500 rounded shadow-[0_0_15px_rgba(212,168,71,0.3)] transition-all ${!devMode ? 'opacity-0' : 'opacity-100'}`} />
            ) : (!isHiddenIcon ? (
              <IconCmp size={isBoxArea ? 24 : 48} className={`drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] filter ${!devMode ? 'opacity-0' : 'opacity-100'}`} />
            ) : null)}

            {devMode && (
              <Badge classification={tooltipVariant} size="sm" className="mt-2">{obj.label}</Badge>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent variant={tooltipVariant}>
          <TooltipTitle>{obj.label}</TooltipTitle>
          {obj.description && <TooltipBody>{obj.description.slice(0, 120)}{obj.description.length > 120 ? '...' : ''}</TooltipBody>}
        </TooltipContent>
      </Tooltip>

      {devMode && isSelected && isBoxArea && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-noir-amber border-2 border-black z-40"
          onMouseDown={(e) => handleDragMouseDown(e, obj, 'resize')}
        />
      )}
    </>
  );

  // Dev mode: keep direct drag + click-to-select (no context menu).
  if (devMode) {
    return (
      <div
        key={obj.id}
        className={wrapperClassName}
        style={wrapperStyle}
        onMouseDown={(e) => handleDragMouseDown(e, obj, 'move')}
        onClick={(e) => handleInteract(obj, e)}
      >
        {innerContent}
      </div>
    );
  }

  // Play mode: left-click (or right-click) opens the item context menu at the
  // cursor. The menu itself is rendered once below the map (see {objMenu}).
  const triggerTitle = obj.description ? `${obj.label} — ${obj.description.slice(0, 120)}${obj.description.length > 120 ? '…' : ''}` : obj.label;
  const openObjMenu = (e: React.MouseEvent) => {
    if (panState.current?.dragging || wasPanning.current) return;
    e.preventDefault();
    e.stopPropagation();
    Audio.playHover();
    setObjMenu({ x: e.clientX, y: e.clientY, obj });
  };
  return (
    <button
      key={obj.id}
      type="button"
      title={triggerTitle}
      aria-label={obj.label}
      className={`${wrapperClassName} min-w-[44px] min-h-[44px] flex flex-col items-center justify-center text-zinc-300 hover:text-noir-amber cursor-pointer transition-colors duration-200 ${isBoxArea ? '' : 'p-4'} border-none bg-transparent`}
      style={wrapperStyle}
      onMouseEnter={() => Audio.playHover()}
      onClick={openObjMenu}
      onContextMenu={openObjMenu}
    >
      {!isHiddenIcon && hasItemImage ? (
        <img src={ITEM_IMAGES[obj.pickupItem!]} alt={obj.label} className="w-16 h-16 object-cover border border-zinc-500 rounded shadow-[0_0_15px_rgba(212,168,71,0.3)] transition-all opacity-0" />
      ) : (!isHiddenIcon ? (
        <IconCmp size={isBoxArea ? 24 : 48} className="drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] filter opacity-0" />
      ) : null)}
    </button>
        );
        })}
          </div>{/* end scene layer */}

        <div className="fog-overlay" style={{ position: 'absolute' }} />
        <div className="vignette-overlay" style={{ position: 'absolute' }} />

        {objMenu && (
    <div
      ref={objMenuRef}
      className="fixed z-[9999] bg-zinc-900 border border-noir-amber/40 rounded shadow-xl py-1 min-w-[200px] max-h-[60vh] overflow-y-auto institutional"
      style={{ left: objMenu.x, top: objMenu.y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div className="px-3 py-1.5 text-xs uppercase tracking-wider text-noir-amber/80 border-b border-zinc-700/60 truncate">{objMenu.obj.label}</div>
      <button
        type="button"
        className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800 hover:text-noir-amber transition-colors"
        onClick={(e) => { e.stopPropagation(); const o = objMenu.obj; setObjMenu(null); handleMenuSelect(o, INTERACT); }}
      >▸ Interagir</button>
      <div className="my-1 h-px bg-zinc-700/60" />
      {inventory.map((it) => (
        <button
          key={it}
          type="button"
          className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-noir-amber transition-colors"
          onClick={(e) => { e.stopPropagation(); const o = objMenu.obj; setObjMenu(null); handleMenuSelect(o, it); }}
        >{ITEM_NAMES[it] || it}</button>
      ))}
    </div>
  )}
        </div>

  {/* Right Panel: Sidebar (desktop) */}
  <div className="hidden md:flex w-56 bg-black border-0 border-l border-noir-amber rounded-none z-20 flex-col">
    {devMode ? (
      <DevInspector
        rooms={localRooms}
        currentRoomId={currentRoomId}
        selectedObjId={selectedObjId}
        onSelectObj={setSelectedObjId}
        onUpdateObj={handleUpdateObj}
        onAddObj={handleAddObj}
        onRemoveObj={handleRemoveObj}
        onDownloadJSON={handleDownloadJSON}
      />
    ) : (
      <>
        <div className="p-4 pb-2">
          <p className="text-noir-amber text-sm tracking-widest">FERRAMENTAS</p>
        </div>
        <div className="flex flex-col gap-2 px-4 pb-2">
          {inventory.filter(i => PERMANENT_ITEMS.includes(i)).map((item) => (
            <div key={item} className="flex flex-col items-center gap-2 text-zinc-300 p-2 rounded-sm bg-zinc-900/50 border border-zinc-800/40">
              {ITEM_IMAGES[item] ? (
                <img src={ITEM_IMAGES[item]} alt={ITEM_NAMES[item] || item} className="w-12 h-12 object-cover border border-zinc-700 shadow-md" />
              ) : (
                <IconMap.Key size={24} className="text-noir-amber" />
              )}
              <Badge classification="thaumiel" size="sm">{ITEM_NAMES[item] || item}</Badge>
            </div>
          ))}
        </div>
        <div className="p-4 pb-2 pt-2 border-t border-zinc-800/40">
          <p className="text-noir-amber text-sm tracking-widest">EVIDÊNCIAS</p>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 px-4 pb-2">
          {(() => {
            const evidence = inventory.filter(i => !PERMANENT_ITEMS.includes(i));
            return evidence.length === 0 ? (
              <p className="text-zinc-600 text-xs text-center py-4">VAZIO</p>
            ) : (
              evidence.map((item) => (
                <div key={item} className="flex flex-col items-center gap-2 text-zinc-300 p-2 rounded-sm bg-zinc-900/50 border border-zinc-800/40">
                  {ITEM_IMAGES[item] ? (
                    <img src={ITEM_IMAGES[item]} alt={ITEM_NAMES[item] || item} className="w-12 h-12 object-cover border border-zinc-700 shadow-md" />
                  ) : (
                    <IconMap.Key size={24} className="text-noir-amber" />
                  )}
                  <Badge classification="safe" size="sm">{ITEM_NAMES[item] || item}</Badge>
                </div>
              ))
            );
          })()}
        </div>
        <div className="p-4 space-y-2">
          <Button variant="ghost" onClick={() => { Audio.playTypewriter(); setIsMapOpen(true); }} onMouseEnter={() => Audio.playHover()} className="w-full text-zinc-300 hover:text-noir-amber transition-colors text-xs tracking-widest justify-start">
            <MapIcon size={14} /> MAPA DA CIDADE
          </Button>
          <Button variant="ghost" onClick={() => {
            if (currentRoomId !== 'escritorio') {
              Audio.playDenied();
              addLog('[TELEFONE] Você precisa voltar ao escritório para usar a agenda telefônica.');
              return;
            }
            Audio.playTerminal();
            setPhoneAgendaOpen(true);
          }} onMouseEnter={() => Audio.playHover()} className="w-full text-zinc-300 hover:text-noir-amber transition-colors text-xs tracking-widest justify-start">
            <Phone size={14} /> AGENDA <Badge classification="euclid" size="sm" className="ml-1">{discoveredContacts.size}</Badge>
          </Button>
          <Button variant="ghost" onClick={() => { Audio.playTypewriter(); setCassetteMenuOpen(true); }} onMouseEnter={() => Audio.playHover()} className="w-full text-zinc-300 hover:text-noir-amber transition-colors text-xs tracking-widest justify-start">
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
      <DevInspector
        rooms={localRooms}
        currentRoomId={currentRoomId}
        selectedObjId={selectedObjId}
        onSelectObj={setSelectedObjId}
        onUpdateObj={handleUpdateObj}
        onAddObj={handleAddObj}
        onRemoveObj={handleRemoveObj}
        onDownloadJSON={handleDownloadJSON}
      />
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
    <button onClick={() => { Audio.playTypewriter(); setIsMapOpen(true); }} className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-noir-amber active:text-noir-amber transition-colors px-2 py-1 min-w-[44px] min-h-[44px] justify-center">
      <MapIcon size={18} />
      <span className="text-[8px] tracking-widest">MAPA</span>
    </button>
    <button onClick={() => {
      if (currentRoomId !== 'escritorio') {
        Audio.playDenied();
        addLog('[TELEFONE] Volte ao escritório para usar a agenda.');
        return;
      }
      Audio.playTerminal();
      setPhoneAgendaOpen(true);
    }} className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-noir-amber active:text-noir-amber transition-colors px-2 py-1 min-w-[44px] min-h-[44px] justify-center">
      <Phone size={18} />
      <span className="text-[8px] tracking-widest">AGENDA</span>
    </button>
    <button onClick={() => { Audio.playTypewriter(); setCassetteMenuOpen(true); }} className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-noir-amber active:text-noir-amber transition-colors px-2 py-1 min-w-[44px] min-h-[44px] justify-center">
      <Archive size={18} />
      <span className="text-[8px] tracking-widest">FITA</span>
    </button>
    <button onClick={() => setMobileInventoryOpen(true)} className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-noir-amber active:text-noir-amber transition-colors px-2 py-1 min-w-[44px] min-h-[44px] justify-center relative">
      <Package size={18} />
      <span className="text-[8px] tracking-widest">ITENS</span>
      {inventory.length > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-noir-amber text-black text-[8px] font-bold rounded-full flex items-center justify-center">{inventory.length}</span>}
    </button>
    <button onClick={() => setMobileTerminalOpen(!mobileTerminalOpen)} className={`flex flex-col items-center gap-0.5 transition-colors px-2 py-1 min-w-[44px] min-h-[44px] justify-center ${mobileTerminalOpen ? 'text-noir-amber' : 'text-zinc-500 hover:text-noir-amber active:text-noir-amber'}`}>
      <Terminal size={18} />
      <span className="text-[8px] tracking-widest">LOG</span>
    </button>
  </div>

  {/* Mobile Terminal Sheet */}
  {mobileTerminalOpen && !devMode && (
    <div className="md:hidden fixed bottom-14 left-0 right-0 h-48 bg-zinc-950 border-t border-noir-amber z-40 flex flex-col p-2 font-mono text-sm">
      <div className="text-noir-amber mb-1 flex items-center gap-2 text-xs">
        <Wine size={14} /> DIÁRIO DE MURPHY
      </div>
      <div className="flex-1 w-full overflow-hidden" ref={xtermRef} />
    </div>
  )}

  {/* Mobile Inventory Modal */}
  <Dialog open={mobileInventoryOpen} onOpenChange={(open) => { if (!open) setMobileInventoryOpen(false); }}>
    <DialogContent className="md:hidden max-w-full h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <Package size={20} /> INVENTÁRIO
        </DialogTitle>
        <DialogClose onClick={() => setMobileInventoryOpen(false)} />
      </DialogHeader>
      <DialogBody className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <p className="text-noir-amber text-xs tracking-widest mb-2">FERRAMENTAS</p>
          <div className="grid grid-cols-3 gap-3">
            {inventory.filter(i => PERMANENT_ITEMS.includes(i)).map((item) => (
              <div key={item} className="flex flex-col items-center gap-2 text-zinc-300 p-3 rounded-sm bg-zinc-900/50 border border-zinc-800/40">
                {ITEM_IMAGES[item] ? (
                  <img src={ITEM_IMAGES[item]} alt={ITEM_NAMES[item] || item} className="w-16 h-16 object-cover border border-zinc-700 shadow-md" />
                ) : (
                  <IconMap.Key size={32} className="text-noir-amber" />
                )}
                <Badge classification="thaumiel" size="sm">{ITEM_NAMES[item] || item}</Badge>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-zinc-800/40 pt-3">
          <p className="text-noir-amber text-xs tracking-widest mb-2">EVIDÊNCIAS</p>
          {(() => {
            const evidence = inventory.filter(i => !PERMANENT_ITEMS.includes(i));
            return evidence.length === 0 ? (
              <p className="text-zinc-600 text-xs text-center py-4 tracking-widest">VAZIO</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {evidence.map((item) => (
                  <div key={item} className="flex flex-col items-center gap-2 text-zinc-300 p-3 rounded-sm bg-zinc-900/50 border border-zinc-800/40">
                    {ITEM_IMAGES[item] ? (
                      <img src={ITEM_IMAGES[item]} alt={ITEM_NAMES[item] || item} className="w-16 h-16 object-cover border border-zinc-700 shadow-md" />
                    ) : (
                      <IconMap.Key size={32} className="text-noir-amber" />
                    )}
                    <Badge classification="safe" size="sm">{ITEM_NAMES[item] || item}</Badge>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </DialogBody>
    </DialogContent>
  </Dialog>

  {/* Phone Agenda Modal */}
  <Dialog open={phoneAgendaOpen && !activePhoneCall} onOpenChange={(open) => { if (!open) setPhoneAgendaOpen(false); }}>
    <DialogContent className="max-w-full md:max-w-lg max-h-[90vh] md:max-h-none flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <Phone size={20} /> AGENDA TELEFÔNICA
        </DialogTitle>
        <DialogClose onClick={() => { Audio.playHover(); setPhoneAgendaOpen(false); }} />
      </DialogHeader>

      <DialogBody className="p-4 space-y-2 overflow-y-auto flex-1">
        {discoveredContacts.size === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-8 tracking-widest">NENHUM CONTATO CONHECIDO</p>
        ) : (
(Array.from(discoveredContacts) as string[]).map((contactId) => {
const contact = PHONE_CONTACTS[contactId];
if (!contact) return null;
const isLetter = contactId === 'seu_jonas';
const isScp = contactId === 'agente_scp';
const wasCalled = calledContacts.has(contactId);
const isCutoff = pdCutoffContacts.has(contactId);
const hasRecording = !!phoneRecordings[contactId];
const contactBadge = isCutoff ? 'keter' as const : isScp && !gameCompleted ? 'thaumiel' as const : wasCalled ? 'safe' as const : 'euclid' as const;
return (
<Button
key={contactId}
variant="ghost"
onClick={() => {
if (isCutoff) {
Audio.playDenied();
addLog(`[${isLetter ? 'CARTA' : 'TELEFONE'}] ${contact.name} cortou relações. Impossível reconectar.`);
return;
}
if (isScp) {
if (gameCompleted && hasRecording) {
Audio.playTerminal();
setPhoneAgendaOpen(false);
setCassettePlayback({ contactId, lines: phoneRecordings[contactId] });
addLog(`[FITA] Reouvindo gravação de ${contact.name}...`);
} else if (hasRecording) {
Audio.playTerminal();
setPhoneAgendaOpen(false);
setCassettePlayback({ contactId, lines: phoneRecordings[contactId] });
addLog(`[FITA] Reouvindo última transmissão de ${contact.name}...`);
} else {
Audio.playTerminal();
setPhoneAgendaOpen(false);
setActivePhoneCall({ contactId, nodeId: 'initial', linesShown: 0, visitedNodes: [] });
addLog(`[SCP] Canal seguro — ${contact.name}...`);
}
return;
}
if (wasCalled) {
                    if (hasRecording) {
                      Audio.playTerminal();
                      setPhoneAgendaOpen(false);
                      setCassettePlayback({ contactId, lines: phoneRecordings[contactId] });
                      addLog(isLetter
                        ? `[FITA] Reouvido gravação da carta de ${contact.name}...`
                        : `[FITA] Reouvindo gravação de ${contact.name}...`);
                    } else {
                      Audio.playDenied();
                      addLog(`[TELEFONE] ${isLetter ? 'Carta já lida.' : 'Linha ocupada.'}`);
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
{isScp ? (
<Eye size={18} className="text-noir-amber" />
) : wasCalled && hasRecording ? (
<Play size={18} className="text-noir-amber" />
) : isLetter ? (
<Mail size={18} className="text-zinc-500 group-hover:text-noir-amber" />
) : (
<PhoneCall size={18} className="text-zinc-500 group-hover:text-noir-amber" />
)}
</div>
<div className="flex-1 min-w-0">
<p className="text-zinc-300 text-xs font-bold tracking-wider truncate group-hover:text-noir-amber transition-colors">{contact.name}</p>
<p className="text-zinc-600 text-[10px] tracking-wide">{isScp ? 'CANAL SEGURO' : isLetter ? 'CARTA NO BECO' : contact.number}</p>
</div>
<Badge classification={contactBadge} size="sm">
{isScp ? (gameCompleted ? 'OUVIR FITA' : hasRecording ? 'OUVIR FITA' : 'SCP') : isCutoff ? 'CORTADO' : wasCalled && hasRecording ? 'OUVIR FITA' : wasCalled ? (isLetter ? 'GELESEN' : 'GETRENNT') : (isLetter ? 'LER' : 'LIGAR')}
</Badge>
              </Button>
            );
          })
        )}
      </DialogBody>

      <DialogFooter className="h-8 text-noir-amber text-xs flex items-center px-4 justify-between">
        <span>CONTATOS: {discoveredContacts.size}</span>
        <span className="animate-pulse">LINHA ESTATAL</span>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  {/* Phone Call / Letter Dialogue Modal */}
  <Dialog open={!!activePhoneCall} onOpenChange={(open) => { if (!open && activePhoneCall) { Audio.playHover(); Audio.stopSpeak(); const closingContactId = activePhoneCall.contactId; const closingNodeId = activePhoneCall.nodeId; const closingVisitedNodes = [...activePhoneCall.visitedNodes]; const allNodes = [...closingVisitedNodes, closingNodeId]; const ct = PHONE_CONTACTS[closingContactId]; if (closingContactId === 'agente_scp') { const recording: { speaker: string; lines: string[] }[] = []; for (const nid of allNodes) { const n = ct?.dialogue[nid]; if (n) recording.push({ speaker: n.speaker, lines: n.lines }); } setPhoneRecordings(prev => ({ ...prev, [closingContactId]: recording })); if (ct?.murphyCommentary) { const commentary: string[] = []; for (const nid of allNodes) { if (ct.murphyCommentary[nid]) { commentary.push(...ct.murphyCommentary[nid]); } } if (commentary.length > 0) { setMurphyCommentaryMap(prev => ({ ...prev, [closingContactId]: commentary })); } } if (allNodes.includes('deduction_correct')) {
setCalledContacts(prev => { const next = new Set(prev); next.add(closingContactId); return next; });
setDeductionResult('correct');
setGameCompleted(true);
addLog('[DEDUÇÃO] ✅ DEDUÇÃO CONFIRMADA — Fall Helena Kraft encerrado.');
Audio.playPickup();
} else if (allNodes.includes('deduction_wrong')) {
setDeductionResult('wrong');
addLog('[DEDUÇÃO] Stern rejeitou a dedução. Revise as pistas.');
Audio.playDenied();
setTimeout(() => setDeductionOpen(true), 300);
} else if (allNodes.includes('deduction_incomplete')) {
setDeductionResult('wrong');
addLog('[DEDUÇÃO] Dedução incompleta. Preencha todos os campos.');
Audio.playDenied();
setTimeout(() => setDeductionOpen(true), 300);
} } else if (!calledContacts.has(closingContactId)) { const recording: { speaker: string; lines: string[] }[] = []; for (const nid of allNodes) { const n = ct?.dialogue[nid]; if (n) recording.push({ speaker: n.speaker, lines: n.lines }); } setCalledContacts(prev => { const next = new Set(prev); next.add(closingContactId); return next; }); setPhoneRecordings(prev => ({ ...prev, [closingContactId]: recording })); if (ct?.murphyCommentary) { const commentary: string[] = []; for (const nid of allNodes) { if (ct.murphyCommentary[nid]) { commentary.push(...ct.murphyCommentary[nid]); } } if (commentary.length > 0) { setMurphyCommentaryMap(prev => ({ ...prev, [closingContactId]: commentary })); } } } setActivePhoneCall(null); } }}>
    <DialogContent className="max-w-full md:max-w-xl max-h-[90vh] md:max-h-none flex flex-col">
      {activePhoneCall && (() => {
        const contact = PHONE_CONTACTS[activePhoneCall.contactId];
        if (!contact) return null;
        const node = contact.dialogue[activePhoneCall.nodeId];
        if (!node) return null;
const isLetter = activePhoneCall.contactId === 'seu_jonas';
const isScp = activePhoneCall.contactId === 'agente_scp';
const isCallEnded = node.choices.length === 0;

        const handleChoice = (choice: { text: string; goto: string; pdAction?: string }) => {
          if (activePhoneCall.contactId === 'zeca' && choice.text.includes('Dra. Cunha')) {
            discoverContact('dra_cunha');
          }
          if (choice.pdAction) {
            setPdChoiceHistory(prev => ({
              ...prev,
              [activePhoneCall.contactId]: [...(prev[activePhoneCall.contactId] || []), choice.pdAction!],
            }));
          }
          const ct = PHONE_CONTACTS[activePhoneCall.contactId];
          if (ct && choice.pdAction === 'D') {
            const targetNode = ct.dialogue[choice.goto];
            if (targetNode && targetNode.choices.length === 0) {
              const strategy = ct.axelrodStrategy;
              const isCutoff = strategy === 'Grudger'
                || strategy === 'TitForTat'
                || (strategy === 'SoftGrudger' && activePhoneCall.visitedNodes.reduce((count, prev) => {
                  const prevNode = ct.dialogue[prev];
                  return count + (prevNode?.choices.filter(c => c.pdAction === 'D').length || 0);
                }, 0) >= 3);
              if (isCutoff) {
                setPdCutoffContacts(prev => { const next = new Set(prev); next.add(activePhoneCall.contactId); return next; });
              }
            }
          }
          Audio.playTypewriter();
          setActivePhoneCall(prev => prev ? { ...prev, nodeId: choice.goto, linesShown: 0, visitedNodes: [...prev.visitedNodes, prev.nodeId] } : null);
        };

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
            </DialogBody>

            {!isCallEnded ? (
              <DialogFooter className="p-3 md:p-4 bg-black/50 space-y-2 flex-col items-stretch">
                <p className="text-zinc-600 text-[10px] tracking-widest mb-2">SUAS OPÇÕES:</p>
                {node.choices.map((choice, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    onClick={() => handleChoice(choice)}
                    onMouseEnter={() => Audio.playHover()}
                    className="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-noir-amber text-zinc-300 hover:text-noir-amber p-3 text-xs tracking-wide transition-colors flex items-center gap-3 justify-start min-h-[44px]"
                  >
                    <span className="text-noir-amber font-bold text-[10px]">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1">{choice.text}</span>
                  </Button>
                ))}
              </DialogFooter>
            ) : (
              <DialogFooter className="p-4 bg-black/50">
<Badge classification="keter" className="mx-auto animate-pulse">
{isScp ? '*CANAL ENCERRADO*' : isLetter ? '— FIM DA CARTA —' : '*C L I C*'}
</Badge>
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
  <Dialog open={cassetteMenuOpen} onOpenChange={(open) => { if (!open) setCassetteMenuOpen(false); }}>
    <DialogContent className="max-w-full md:max-w-lg flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <Archive size={20} /> FITA CASSETE
        </DialogTitle>
        <DialogClose onClick={() => setCassetteMenuOpen(false)} />
      </DialogHeader>
      <DialogBody className="p-4 space-y-2 overflow-y-auto max-h-[60vh]">
        {Object.keys(phoneRecordings).length === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-8 tracking-widest">NENHUMA GRAVAÇÃO</p>
        ) : (
          Object.entries(phoneRecordings).map(([contactId, recording]) => {
            const contact = PHONE_CONTACTS[contactId];
            if (!contact) return null;
            const isLetter = contactId === 'seu_jonas';
            const commentary = murphyCommentaryMap[contactId];
            return (
              <Button
                key={contactId}
                variant="ghost"
                onClick={() => {
                  setCassetteMenuOpen(false);
                  setCassettePlayback({ contactId, lines: recording });
                  Audio.playTerminal();
                  addLog(isLetter
                    ? `[FITA] Reouvido gravação da carta de ${contact.name}...`
                    : `[FITA] Reouvindo gravação de ${contact.name}...`);
                }}
                onMouseEnter={() => Audio.playHover()}
                className="w-full bg-zinc-900 border border-zinc-800 hover:border-noir-amber p-3 flex items-center gap-4 text-left transition-colors group"
              >
                <div className="w-10 h-10 border border-zinc-700 group-hover:border-noir-amber flex items-center justify-center bg-black">
                  <Play size={18} className="text-noir-amber" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-300 text-xs font-bold tracking-wider truncate group-hover:text-noir-amber transition-colors">{contact.name}</p>
                  <p className="text-zinc-600 text-[10px] tracking-wide">{isLetter ? 'CARTA' : contact.number} — {recording.length} blocos</p>
                </div>
                <Badge classification={commentary ? 'safe' : 'euclid'} size="sm">
                  {commentary ? 'COM NOTAS' : 'GELESEN'}
                </Badge>
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
  <Dialog open={!!cassettePlayback} onOpenChange={(open) => { if (!open) { Audio.playHover(); setCassettePlayback(null); } }}>
    <DialogContent className="max-w-full md:max-w-xl max-h-[90vh] md:max-h-none flex flex-col">
      {cassettePlayback && (() => {
        const contact = PHONE_CONTACTS[cassettePlayback.contactId];
        if (!contact) return null;
        const isLetter = cassettePlayback.contactId === 'seu_jonas';
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Play size={18} />
                {isLetter ? `FITA — CARTA DE ${contact.name.toUpperCase()}` : `FITA — ${contact.number}`}
              </DialogTitle>
              <DialogClose />
            </DialogHeader>

            <DialogBody className="p-4 md:p-6 space-y-4 min-h-[200px] max-h-[50vh] overflow-y-auto flex-1">
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
              {murphyCommentaryMap[cassettePlayback.contactId] && (
                <div className="space-y-2 border-t border-zinc-800 pt-4 mt-2">
                  <p className="text-noir-amber text-[10px] font-bold tracking-widest border-b border-zinc-900 pb-1">
                    MURPHY — NOTAS PESSOAIS:
                  </p>
                  {murphyCommentaryMap[cassettePlayback.contactId].map((line, i) => (
                    <p key={i} className="text-zinc-500 text-xs tracking-wide leading-relaxed pl-2 border-l-2 border-amber-900/50 italic">
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </DialogBody>

            <DialogFooter className="p-4 bg-black/50">
              <Badge classification="safe" className="mx-auto">
                — FIM DA FITA —
              </Badge>
            </DialogFooter>

            <div className="h-8 bg-black border-t border-noir-amber text-noir-amber text-xs flex items-center px-4 justify-between">
              <span>KASSETTE</span>
              <Badge classification="safe" size="sm" className="animate-pulse">ABGESPIELT</Badge>
            </div>
          </>
        );
      })()}
    </DialogContent>
  </Dialog>

  {/* Map Modal */}
  <Dialog open={isMapOpen} onOpenChange={(open) => { if (!open) setIsMapOpen(false); }}>
    <DialogContent className="max-w-full md:max-w-4xl h-[90vh] md:h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <MapIcon /> MAPA DA CIDADE
        </DialogTitle>
        <DialogClose onClick={() => { Audio.playHover(); setIsMapOpen(false); }} />
      </DialogHeader>

      <DialogBody className="relative bg-black overflow-hidden flex-1 p-0">
        <div className="absolute inset-0 bg-zinc-950/50" />
        <div className="absolute inset-0 pointer-events-none border-[10px] border-black/50" />

        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30 stroke-noir-amber" strokeWidth="1" strokeDasharray="8 4">
          <line x1="30%" y1="60%" x2="50%" y2="60%" />
          <line x1="50%" y1="60%" x2="20%" y2="40%" />
          <line x1="50%" y1="60%" x2="50%" y2="35%" />
          <line x1="50%" y1="35%" x2="70%" y2="25%" />
          <line x1="50%" y1="60%" x2="75%" y2="50%" />
          <line x1="50%" y1="35%" x2="35%" y2="25%" />
          <line x1="35%" y1="25%" x2="55%" y2="15%" />
        </svg>

        {Object.keys(GAME_ROOMS).map((roomId) => {
          const room = GAME_ROOMS[roomId];
          const isVisited = visitedRooms.includes(roomId);
          const isCurrent = currentRoomId === roomId;
          const coords = mapLayout[roomId] || { x: 50, y: 50 };

          return (
            <Button
              key={roomId}
              variant="ghost"
              onClick={() => handleMapTravel(roomId)}
              onMouseEnter={() => Audio.playHover()}
              className={`absolute w-24 h-16 md:w-28 md:h-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center text-[10px] tracking-wider transition-colors duration-300 overflow-hidden rounded-sm border-none min-w-[44px] min-h-[44px]
                ${isCurrent ? 'border-2 border-noir-amber text-noir-amber shadow-[0_0_15px_rgba(212,168,71,0.5)] z-20'
                : isVisited ? 'text-zinc-300 hover:text-noir-amber z-10' : 'text-zinc-700 cursor-not-allowed z-0'}`}
              style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
            >
              {isVisited && room.mapImage && (
                <div className="absolute inset-0 z-0">
                  <img src={room.mapImage} alt={room.name} className="w-full h-full object-cover opacity-50" />
                  <div className="absolute inset-0 bg-black/40" />
                </div>
              )}

              {!isVisited && <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-[1px] flex items-center justify-center text-[9px] text-zinc-600 z-10">[?]</div>}

              <div className="font-bold mb-0.5 z-10 relative px-1 bg-black/60 rounded text-[9px]">{room.name.split('—')[0].trim()}</div>
              {isCurrent && <Badge classification="euclid" size="sm" className="absolute -bottom-5 whitespace-nowrap animate-pulse z-10">VOCÊ ESTÁ AQUI</Badge>}
            </Button>
          );
        })}
      </DialogBody>

      <DialogFooter className="h-8 text-noir-amber text-xs flex items-center px-4 justify-between">
        <span>LOCAIS: {visitedRooms.length} / {Object.keys(GAME_ROOMS).length}</span>
        <Badge classification="euclid" size="sm" className="animate-pulse">RASTREAMENTO ATIVO</Badge>
      </DialogFooter>
    </DialogContent>
  </Dialog>

      {/* Detective Board */}
      {deductionOpen && (
        <DetectiveBoard
          grid={deductionGrid}
          onGridChange={setDeductionGrid}
          readHints={readHints}
          result={deductionResult}
onSubmit={() => {
Audio.playTerminal();
setDeductionAttempts(prev => prev + 1);
let allFilled = true;
let allCorrect = true;
for (const loc of DEDUCTION_LOCATIONS) {
for (const cat of Object.keys(DEDUCTION_CATEGORIES) as DeductionCategory[]) {
if (!deductionGrid[loc][cat]) { allFilled = false; break; }
if (deductionGrid[loc][cat] !== DEDUCTION_SOLUTION[loc][cat]) allCorrect = false;
}
if (!allFilled) break;
}
setDeductionOpen(false);
if (!allFilled) {
addLog('[DEDUÇÃO] Submetendo ao canal seguro da Fundação...');
setActivePhoneCall({ contactId: 'agente_scp', nodeId: 'deduction_incomplete', linesShown: 0, visitedNodes: [] });
} else if (allCorrect) {
addLog('[DEDUÇÃO] Submetendo ao canal seguro da Fundação...');
setActivePhoneCall({ contactId: 'agente_scp', nodeId: 'deduction_correct', linesShown: 0, visitedNodes: [] });
} else {
addLog('[DEDUÇÃO] Submetendo ao canal seguro da Fundação...');
setActivePhoneCall({ contactId: 'agente_scp', nodeId: 'deduction_wrong', linesShown: 0, visitedNodes: [] });
}
}}
          onClose={() => { Audio.playHover(); setDeductionOpen(false); Audio.stopSpeak(); }}
          playHover={Audio.playHover}
          playTypewriter={Audio.playTypewriter}
        />
      )}


{/* Game Completion Overlay */}
{gameCompleted && (() => {
const completion = calculateGameCompletion();
return (
<div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
<div className="crt-overlay" />
<div className="scanline" />
<div className="border border-noir-amber bg-zinc-950 w-full max-w-lg shadow-[0_0_60px_rgba(212,168,71,0.3)] relative">
<div className="border-b border-noir-amber p-6 bg-black text-center">
<h1 className="text-3xl text-noir-amber font-bold tracking-widest mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
FALL HELENA KRAFT
</h1>
<p className="text-zinc-500 text-xs tracking-widest">ARQUIVO FECHADO</p>
</div>
<div className="p-8 text-center space-y-6">
<div>
<p className="text-noir-amber text-6xl font-bold tracking-widest" style={{ fontFamily: 'Playfair Display, serif' }}>
{completion.percent}%
</p>
<p className="text-zinc-500 text-xs tracking-widest mt-2">CONCLUSÃO DO CASO</p>
</div>
<div className="space-y-3 text-left border border-zinc-800 p-4 bg-black/50">
<div className="flex justify-between items-center">
<span className="text-zinc-400 text-xs tracking-wide">Pistas descobertas</span>
<span className="text-zinc-300 text-xs font-bold">{completion.hintsFound}/18</span>
</div>
<div className="flex justify-between items-center">
<span className="text-zinc-400 text-xs tracking-wide">Entrevistas bem-sucedidas</span>
<span className="text-zinc-300 text-xs font-bold">{completion.interviewsCompleted}/5</span>
</div>
<div className="flex justify-between items-center">
<span className="text-zinc-400 text-xs tracking-wide">Documentos de entrevista lidos</span>
<span className="text-zinc-300 text-xs font-bold">{completion.cluesRead}/5</span>
</div>
<div className="flex justify-between items-center">
<span className="text-zinc-400 text-xs tracking-wide">Dedução correta</span>
<span className={`text-xs font-bold ${completion.deductionCorrect ? 'text-green-500' : 'text-noir-red'}`}>{completion.deductionCorrect ? 'SIM' : 'NÃO'}</span>
</div>
{completion.deductionCorrect && completion.deductionAttempts > 1 && (
<div className="flex justify-between items-center">
<span className="text-zinc-400 text-xs tracking-wide">Tentativas de dedução</span>
<span className="text-noir-amber text-xs font-bold">{completion.deductionAttempts} {completion.deductionAttempts === 1 ? 'tentativa' : 'tentativas'}</span>
</div>
)}
<div className="flex justify-between items-center border-t border-zinc-800 pt-3">
<span className="text-zinc-400 text-xs tracking-wide">Estratégia Tit-for-Tat</span>
<span className={`text-xs font-bold ${completion.tftCompliant ? 'text-noir-amber' : 'text-noir-red'}`}>{completion.tftCompliant ? 'CONFORME' : 'NÃO CONFORME'}</span>
</div>
</div>
{!completion.tftCompliant && (
<p className="text-zinc-600 text-[10px] tracking-wider italic border-t border-zinc-900 pt-4">
O investigador ideal segue Tit-for-Tat: cooperar primeiro, espelhar o oponente. 100% exige conformidade.
</p>
)}
{completion.tftCompliant && completion.percent === 100 && (
<p className="text-noir-amber text-xs tracking-widest font-bold border-t border-noir-amber pt-4">
INVESTIGADOR EXEMPLAR — TIT-FOR-TAT
</p>
)}
</div>
<div className="h-8 bg-black border-t border-noir-amber text-noir-amber text-xs flex items-center px-4 justify-between">
<span>MURPHY LAW</span>
<span className="animate-pulse">ABGESCHLOSSEN</span>
</div>
</div>
</div>
);
})()}

{/* Settings Modal */}
  {isSettingsOpen && (
    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-2 md:p-8">
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
    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-8">
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
            <div className="p-4 md:p-8 overflow-y-auto text-zinc-300 space-y-4 tracking-wide leading-relaxed text-sm h-[50vh] md:h-[60vh]">
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
