import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMachine } from '@xstate/react';
import { createPortal } from 'react-dom';
import { GAME_ROOMS, Interactable, ITEM_NAMES, ITEM_IMAGES, Room, PHONE_CONTACTS } from './data';
import { IconMap } from './Icons';
import { Audio } from './audio';
import { FileText, Map as MapIcon, X, Bug, Download, Wine, Briefcase, Settings, Volume2, Phone, PhoneCall, Radio, Mail, Play, Archive, Package, Terminal, ChevronLeft, ChevronRight } from 'lucide-react';
import { useXTerm } from './useXTerm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipTitle, TooltipBody } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody, DialogClose } from '@/components/ui/dialog';
import { Toaster } from 'sonner';
import { DevInspector } from '@/components/DevInspector';
import { MuralOverlay } from '@/components/board/MuralOverlay';
import { clueFromHint, type HintSource } from '@/components/board/data';
import { BONUS_CONNECTED, POINTS_PER_CLUE, POINTS_PER_CONNECTION, scoreMural, type MuralScore } from '@/lib/muralScore';
import { resolveItemUse, INTERACT } from '@/lib/itemUse';
import { createEugineNier } from '@/lib/eugineNier';
import { HardProber, C, D } from '@/lib/hardProber';
import { SneakyTitForTat, ZDGTFT2, Detective } from '@/lib/axelrod';
import { rng42 } from '@/lib/rng';
import { DIALOGUE_REVEALS, contactRevealedByItem } from '@/lib/contactDiscovery';
import gameData from './game_data.json';
import { buildGameDataExport } from '@/lib/devExport';
import { gameMachine } from './state/gameMachine';

const PERMANENT_ITEMS = ['isqueiro', 'gravador_cassete'];
const SAVE_KEY = 'scp_law_save';

// Catálogo das 5 pistas dedutivas do jogo (os depoimentos interview_clue_*,
// um por contato entrevistado): fonte dos cartões do mural. O índice é
// estável (ordem de declaração em game_data.json) e define a posição
// determinística do cartão.
const HINT_CATALOG: Map<string, HintSource> = (() => {
  const catalog = new Map<string, HintSource>();
  for (const room of Object.values(GAME_ROOMS)) {
    for (const obj of room.interactables) {
      if (!/^interview_clue_/.test(obj.id)) continue;
      catalog.set(obj.id, { id: obj.id, label: obj.label, roomName: room.name, lines: obj.documentData?.content ?? [], index: catalog.size });
    }
  }
  return catalog;
})();
// Total de itens de investigação: 5 depoimentos + 9 contatos.
const INVESTIGATION_TOTAL = HINT_CATALOG.size + Object.keys(PHONE_CONTACTS).length;

function Game({ loadFromSave }: { loadFromSave?: boolean }) {
  const [snapshot, send] = useMachine(gameMachine);
  const state = snapshot.context;

  // UI-only state (local, not in XState)
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);
  const [documentData, setDocumentData] = useState<{ title: string; content: string[] } | null>(null);
  const [objMenu, setObjMenu] = useState<{ x: number; y: number; obj: Interactable } | null>(null);
  const [muralOpen, setMuralOpen] = useState(false);
  const [phoneAgendaOpen, setPhoneAgendaOpen] = useState(false);
  const [activePhoneCall, setActivePhoneCall] = useState<{
    contactId: string; nodeId: string; linesShown: number; visitedNodes: string[];
  } | null>(null);
  const [cassettePlayback, setCassettePlayback] = useState<{
    contactId: string; lines: { speaker: string; lines: string[] }[];
  } | null>(null);
  const [cassetteMenuOpen, setCassetteMenuOpen] = useState(false);
  const [mobileInventoryOpen, setMobileInventoryOpen] = useState(false);
  const [mobileTerminalOpen, setMobileTerminalOpen] = useState(false);
  const [dragState, setDragState] = useState<{
    objId: string; type: 'move' | 'resize';
    startMouseX: number; startMouseY: number;
    startX: number; startY: number; startW: number; startH: number;
  } | null>(null);
  const [panX, setPanX] = useState(0);
  const [scrollPos, setScrollPos] = useState(0);

  useEffect(() => {
    if (!loadFromSave) return;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      send({ type: 'RESTORE_STATE', state: { ...saved, localRooms: { ...GAME_ROOMS } } });
    } catch {}
  }, []);

  const currentRoomId = state.currentRoomId;
  const inventory = state.inventory;
  const visitedRooms = state.visitedRooms;
  const discoveredContacts = state.discoveredContacts;
  const calledContacts = state.calledContacts;
  const pdCutoffContacts = state.pdCutoffContacts;
  const pdChoiceHistory = state.pdChoiceHistory;
  const phoneRecordings = state.phoneRecordings;
  const mural = state.mural;
  const unlockedObjects = new Set(state.unlockedObjects);
  const interactedItems = state.interactedItems;
  const readInterviewClues = state.readInterviewClues;
  const murphyCommentaryMap = state.murphyCommentaryMap;
  const gameCompleted = state.gameCompleted;
  const diretoraPhoneUnlocked = state.diretoraPhoneUnlocked;
  const localRooms = state.localRooms;

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


  const currentRoom: Room = localRooms[currentRoomId] || localRooms['escritorio'];

  const saveGame = () => {
    const data = {
      currentRoomId: state.currentRoomId,
      inventory: state.inventory,
      visitedRooms: state.visitedRooms,
      discoveredContacts: state.discoveredContacts,
      calledContacts: state.calledContacts,
      pdCutoffContacts: state.pdCutoffContacts,
      pdChoiceHistory: state.pdChoiceHistory,
      phoneRecordings: state.phoneRecordings,
      mural: state.mural,
      unlockedObjects: state.unlockedObjects,
      interactedItems: state.interactedItems,
      readInterviewClues: state.readInterviewClues,
      murphyCommentaryMap: state.murphyCommentaryMap,
      gameCompleted: state.gameCompleted,
      diretoraPhoneUnlocked: state.diretoraPhoneUnlocked,
      version: 1,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
  };

  const calculateGameCompletion = () => {
    // Conformidade ZD-GTFT-2: replay de cada contato contra sua estratégia;
    // trair diante de cooperação quebra o selo (badge informativo no final).
    let zdgtft2Compliant = true;
    const contactIds = Object.keys(PHONE_CONTACTS);
    let anyInteraction = false;
    for (const cid of contactIds) {
      const history = pdChoiceHistory[cid] || [];
      if (!history.length) continue;
      anyInteraction = true;
      const contact = PHONE_CONTACTS[cid];
      const strategy = contact.axelrodStrategy;
      let npcMoves: string[] = [];
      const playerMoves = history.filter(a => a !== 'E') as ("C" | "D")[];
      if (strategy === 'EugineNier') {
        const eugine = createEugineNier();
        for (let i = 0; i < playerMoves.length; i++) npcMoves.push(eugine(playerMoves.slice(0, i)));
      } else if (strategy === 'HardProber') {
        const prober = new HardProber();
        for (let i = 0; i < playerMoves.length; i++) npcMoves.push(prober.play(playerMoves[i]));
      } else if (strategy === 'SneakyTitForTat') {
        const sneaky = new SneakyTitForTat();
        for (let i = 0; i < playerMoves.length; i++) npcMoves.push(sneaky.play(playerMoves[i]));
      } else {
        npcMoves = ['C'];
        for (let i = 1; i < playerMoves.length; i++) {
          const playerPrev = playerMoves[i - 1];
          const playerAllDs = playerMoves.slice(0, i).filter(a => a === 'D').length;
          let npcMove = 'C';
          if (strategy === 'Grudger' && playerAllDs > 0) npcMove = 'D';
          else if (strategy === 'TitForTat') npcMove = playerPrev === 'D' ? 'D' : 'C';
          else if (strategy === 'SoftGrudger' && playerAllDs >= 2) npcMove = 'D';
          else if (strategy === 'WinStayLoseShift') npcMove = playerPrev === 'D' ? 'D' : (i >= 2 && playerMoves[i - 2] === 'D' ? 'D' : 'C');
          else if (strategy === 'Forgiver' && playerAllDs > 0) npcMove = 'D';
          else if (strategy === 'RandomStrategy') npcMove = rng42() < 0.5 ? 'C' : 'D';
          npcMoves.push(npcMove);
        }
      }
      const npcMirror = npcMoves.slice(0, playerMoves.length);
      for (let i = 0; i < playerMoves.length; i++) {
        if (playerMoves[i] === 'D' && npcMirror[i] === 'C') { zdgtft2Compliant = false; break; }
      }
      if (!zdgtft2Compliant) break;
    }
    if (!anyInteraction) zdgtft2Compliant = false;
    return {
      percent: Math.round(100 * (readInterviewClues.length + calledContacts.length) / INVESTIGATION_TOTAL),
      zdgtft2Compliant,
      interviewsCompleted: calledContacts.length,
      cluesRead: readInterviewClues.length,
      muralScore: scoreMural(mural),
    };
  };
  // Ao continuar um save, o snapshot do primeiro commit ainda não reflete o
  // RESTORE_STATE — pular a primeira escrita evita sobrescrever o save com o
  // contexto inicial; o commit seguinte grava o estado já restaurado.
  const firstSaveSkipRef = useRef(loadFromSave);
  useEffect(() => {
    if (firstSaveSkipRef.current) { firstSaveSkipRef.current = false; return; }
    saveGame();
  }, [
    state.currentRoomId, state.inventory, state.visitedRooms,
    state.discoveredContacts, state.calledContacts, state.pdCutoffContacts,
    state.pdChoiceHistory, state.phoneRecordings,
    state.mural, state.unlockedObjects,
    state.interactedItems, state.readInterviewClues,
    state.murphyCommentaryMap, state.gameCompleted, state.diretoraPhoneUnlocked,
  ]);

  // Sincroniza depoimentos descobertos → cartões do mural. Idempotente pelo
  // id (o id do cartão É o id da pista), seguro sob StrictMode e reloads.
  useEffect(() => {
    const known = new Set(mural.clues.map(c => c.id));
    const fresh = readInterviewClues
      .filter(id => HINT_CATALOG.has(id) && !known.has(id))
      .map(id => clueFromHint(HINT_CATALOG.get(id)!));
    if (!fresh.length) return;
    send({ type: 'UPDATE_MURAL', mural: { ...mural, clues: [...mural.clues, ...fresh] } });
  }, [readInterviewClues, mural]);

  const didLogRoom = useRef<string | null>(null);
  const objMenuRef = useRef<HTMLDivElement>(null);

  useEffect(function() {
    const handleResize = () => { try { fitAddon.current.fit(); } catch {} };
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
        'Maria Kraft pediu ajuda à Fundação. Burocracia travou.',
        'Helena, 9 anos, desaparecida há 3 semanas.',
        'Uma amiga na Fundação me chamou. Disse que precisam de mim.',
        'Não aceitei dinheiro. Não quando é uma criança.',
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
    const wasNew = !state.discoveredContacts.includes(contactId);
    send({ type: 'DISCOVER_CONTACT', contactId });
    if (wasNew && PHONE_CONTACTS[contactId]) {
      addLog(`[AGENDA] Novo contato: ${PHONE_CONTACTS[contactId].name} — ${PHONE_CONTACTS[contactId].number}`);
    }
  };

  const updateSelectedObj = (updates: Partial<Interactable>) => {
    if (!selectedObjId) return;
    send({ type: 'UPDATE_LOCAL_ROOMS', updater: (prev: Record<string, Room>) => {
      const next = { ...prev };
      const room = { ...next[currentRoomId] };
      room.interactables = room.interactables.map((obj) =>
        obj.id === selectedObjId ? { ...obj, ...updates } : obj
      );
      next[currentRoomId] = room;
      return next;
    }});
  };

  const handleUpdateObj = useCallback((roomId: string, objId: string, updated: Interactable) => {
    send({ type: 'UPDATE_LOCAL_ROOMS', updater: (prev: Record<string, Room>) => {
      const next = { ...prev };
      const room = { ...next[roomId] };
      room.interactables = room.interactables.map(obj => obj.id === objId ? updated : obj);
      next[roomId] = room;
      return next;
    }});
  }, []);

  const handleAddObj = useCallback((roomId: string, obj: Interactable) => {
    send({ type: 'UPDATE_LOCAL_ROOMS', updater: (prev: Record<string, Room>) => {
      const next = { ...prev };
      const room = { ...next[roomId] };
      room.interactables = [...room.interactables, obj];
      next[roomId] = room;
      return next;
    }});
  }, []);

  const handleRemoveObj = useCallback((roomId: string, objId: string) => {
    send({ type: 'UPDATE_LOCAL_ROOMS', updater: (prev: Record<string, Room>) => {
      const next = { ...prev };
      const room = { ...next[roomId] };
      room.interactables = room.interactables.filter(obj => obj.id !== objId);
      next[roomId] = room;
      return next;
    }});
    if (selectedObjId === objId) setSelectedObjId(null);
  }, [selectedObjId]);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
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

  const handleViewportScroll = useCallback(() => {
    const vp = viewportRef.current;
    if (vp) setScrollPos(vp.scrollLeft);
  }, []);

  const canPanLeft = scrollPos > 0;
  const canPanRight = (() => {
    const vp = viewportRef.current;
    const sc = sceneRef.current;
    if (!vp || !sc) return false;
    return scrollPos < sc.clientWidth - vp.clientWidth;
  })();

  const panNudge = useCallback((direction: 'left' | 'right') => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.scrollBy({ left: direction === 'left' ? -120 : 120, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const vp = viewportRef.current;
    if (vp) vp.scrollLeft = 0;
    setPanX(0);
    setScrollPos(0);
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
      send({ type: 'UPDATE_LOCAL_ROOMS', updater: (prev: Record<string, Room>) => {
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
      }});
    };
    const handleMouseUp = () => setDragState(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, currentRoomId]);

  const handleDownloadJSON = useCallback(() => {
    const exportData = buildGameDataExport(gameData, localRooms);
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'game_data.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [localRooms]);

  useEffect(() => {
    if (!visitedRooms.includes(currentRoomId) && didLogRoom.current !== currentRoomId) {
      didLogRoom.current = currentRoomId;
    }
    if (currentRoomId !== 'escritorio' || visitedRooms.length > 1) {
      if (didLogRoom.current !== currentRoomId) {
        didLogRoom.current = currentRoomId;
        addLog(`Entrou em: ${currentRoom.name}`);
        addLog(currentRoom.description);
      }
    }
  }, [currentRoomId]);

  useEffect(() => {
    const close = () => setObjMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setObjMenu(null); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', onKey); };
  }, []);

  // FAZER A DENÚNCIA (mural): encerra o caso a qualquer momento — o botão
  // está sempre disponível; os pontos dependem de quanto o jogador investigou
  // e conectou antes de assinar o relatório final.
  const handleAccuse = (score: MuralScore) => {
    Audio.playTerminal();
    send({ type: 'SET_COMPLETED' });
    addLog(`[DENÚNCIA] Relatório assinado e enviado à redação. ${score.points} pontos no mural — ${score.clues} pista${score.clues === 1 ? '' : 's'}, ${score.connections} fio${score.connections === 1 ? '' : 's'}${score.singleComponent ? ', grafo conexo' : ''}.`);
    Audio.stopSpeak();
    setMuralOpen(false);
  };

  const handleInteract = (obj: Interactable, e?: React.MouseEvent) => {
    if (devMode) {
      if (e) e.stopPropagation();
      setSelectedObjId(obj.id);
      return;
    }

    if (obj.type === 'travel' && obj.targetRoom) {
      if (obj.id === 'escola_fachada' && !visitedRooms.includes('casa_mae')) {
        Audio.playDenied();
        addLog('[BLOQUEIO] Você não tem motivo para entrar na escola. Fale com as pessoas certas primeiro.');
        return;
      }
      Audio.playDoor();
      send({ type: 'MOVE_ROOM', target: obj.targetRoom });
      const targetRoomData = localRooms[obj.targetRoom];
      if (targetRoomData?.rain?.volume !== undefined) Audio.setRainVolume(targetRoomData.rain.volume);
      addLog(`[NAVEGAÇÃO] Indo para: ${GAME_ROOMS[obj.targetRoom].name}`);
    } else if (obj.type === 'pickup' && obj.pickupItem) {
      Audio.playPickup();
      if (!inventory.includes(obj.pickupItem)) {
        send({ type: 'PICKUP_ITEM', itemKey: obj.pickupItem, objId: obj.id });
        addLog(obj.description || `Você pegou: ${ITEM_NAMES[obj.pickupItem] || obj.pickupItem}`);
        const revealedContact = contactRevealedByItem(PHONE_CONTACTS, obj.pickupItem);
        if (revealedContact) discoverContact(revealedContact);
      }
    } else if (obj.type === 'terminal_read' && obj.documentData) {
      if (obj.interviewGate && pdCutoffContacts.includes(obj.interviewGate)) {
        Audio.playDenied();
        addLog(`[ACESSO NEGADO] Entrevista com ${obj.interviewGate} falhou. Documento selado.`);
      } else {
        Audio.playTerminal();
        setDocumentData(obj.documentData);
        addLog(`Acessando arquivo: ${obj.label}...`);
        Audio.speak(obj.id);
        if (obj.id.startsWith('interview_clue_')) {
          send({ type: 'READ_INTERVIEW_CLUE', clueId: obj.id });
        }
        if (obj.id === 'carta_jonas') {
          discoverContact('seu_jonas');
        }
      }
    } else if (obj.type === 'inspect') {
      if (obj.id === 'detective_board') {
        Audio.playTypewriter();
        setMuralOpen(true);
        addLog('[MURAL] Você se inclina sobre o quadro de investigações. Fotos, recortes e fios vermelhos.');
      } else {
        Audio.playTypewriter();
        addLog(`[${obj.label}] ${obj.description}`);
      }
    } else if (obj.type === 'phone_call') {
      if (obj.phoneCallId === 'seu_jonas') {
        const contact = PHONE_CONTACTS[obj.phoneCallId];
        if (!contact) return;
        discoverContact(obj.phoneCallId);
        if (pdCutoffContacts.includes(obj.phoneCallId)) {
          Audio.playDenied();
          addLog(`[CARTA] Seu Jonas se recusa a escrever mais. A correspondência foi cortada.`);
          return;
        }
        if (calledContacts.includes(obj.phoneCallId)) {
          Audio.playTerminal();
          addLog(`[FITA] A fita cassete captou a leitura da carta de ${contact.name}. Use a agenda para ouvir.`);
          return;
        }
        Audio.playTypewriter();
        send({ type: 'START_PHONE_CALL', contactId: obj.phoneCallId });
        setActivePhoneCall({ contactId: obj.phoneCallId, nodeId: 'initial', linesShown: 0, visitedNodes: [] });
        addLog(`[CARTA] Lendo carta de ${contact.name}...`);
      } else if (obj.phoneCallId === 'zeca' && currentRoomId === 'bar') {
        const contact = PHONE_CONTACTS[obj.phoneCallId];
        if (!contact) return;
        discoverContact(obj.phoneCallId);
        if (pdCutoffContacts.includes(obj.phoneCallId)) {
          Audio.playDenied();
          addLog(`[TELEFONE] Zeca se recusa a falar. A confiança foi quebrada.`);
          return;
        }
        if (calledContacts.includes(obj.phoneCallId)) {
          Audio.playTerminal();
          addLog(`[FITA] A fita cassete captou a conversa com Zeca. Use a agenda para ouvir.`);
          return;
        }
        Audio.playTerminal();
        send({ type: 'START_PHONE_CALL', contactId: obj.phoneCallId });
        setActivePhoneCall({ contactId: obj.phoneCallId, nodeId: 'initial', linesShown: 0, visitedNodes: [] });
        addLog(`[ENTREVISTA] Zeca está no bar. Você se senta para conversar...`);
      } else if (obj.phoneCallId === 'padre_miguel' && currentRoomId === 'igreja') {
        const contact = PHONE_CONTACTS[obj.phoneCallId];
        if (!contact) return;
        discoverContact(obj.phoneCallId);
        if (pdCutoffContacts.includes(obj.phoneCallId)) {
          Audio.playDenied();
          addLog(`[IGREJA] Padre Miguel se recusa a falar. A confiança foi quebrada.`);
          return;
        }
        if (calledContacts.includes(obj.phoneCallId)) {
          Audio.playTerminal();
          addLog(`[FITA] A fita cassete captou a conversa com Padre Miguel. Use a agenda para ouvir.`);
          return;
        }
        Audio.playTerminal();
        send({ type: 'START_PHONE_CALL', contactId: obj.phoneCallId });
        setActivePhoneCall({ contactId: obj.phoneCallId, nodeId: 'initial', linesShown: 0, visitedNodes: [] });
        addLog(`[IGREJA] Padre Miguel acena para você se aproximar. A conversa começa em voz baixa...`);
      } else if (obj.phoneCallId === 'dra_cunha' && currentRoomId === 'hospital') {
        const contact = PHONE_CONTACTS[obj.phoneCallId];
        if (!contact) return;
        discoverContact(obj.phoneCallId);
        if (pdCutoffContacts.includes(obj.phoneCallId)) {
          Audio.playDenied();
          addLog(`[HOSPITAL] Dra. Cunha se recusa a falar.`);
          return;
        }
        if (calledContacts.includes(obj.phoneCallId)) {
          Audio.playTerminal();
          addLog(`[FITA] Conversa com Dra. Cunha gravada.`);
          return;
        }
        Audio.playTerminal();
        send({ type: 'START_PHONE_CALL', contactId: obj.phoneCallId });
        setActivePhoneCall({ contactId: obj.phoneCallId, nodeId: 'initial', linesShown: 0, visitedNodes: [] });
        addLog(`[HOSPITAL] Dra. Cunha fecha o prontuário...`);
      } else if (obj.phoneCallId === 'fazendeiro' && currentRoomId === 'fazenda') {
        const contact = PHONE_CONTACTS[obj.phoneCallId];
        if (!contact) return;
        discoverContact(obj.phoneCallId);
        if (pdCutoffContacts.includes(obj.phoneCallId)) {
          Audio.playDenied();
          addLog(`[FAZENDA] Caseiro se recusa a falar.`);
          return;
        }
        if (calledContacts.includes(obj.phoneCallId)) {
          Audio.playTerminal();
          addLog(`[FITA] Conversa com caseiro gravada.`);
          return;
        }
        Audio.playTerminal();
        send({ type: 'START_PHONE_CALL', contactId: obj.phoneCallId });
        setActivePhoneCall({ contactId: obj.phoneCallId, nodeId: 'initial', linesShown: 0, visitedNodes: [] });
        addLog(`[FAZENDA] Caseiro apoia os cotovelos na cerca...`);
      } else if (obj.phoneCallId === 'diretora_elvira' && currentRoomId === 'diretoria') {
        const contact = PHONE_CONTACTS[obj.phoneCallId];
        if (!contact) return;
        discoverContact(obj.phoneCallId);
        if (pdCutoffContacts.includes(obj.phoneCallId)) {
          Audio.playDenied();
          addLog(`[DIRETORIA] Diretora Elvira se recusa a falar.`);
          return;
        }
        if (calledContacts.includes(obj.phoneCallId)) {
          Audio.playTerminal();
          addLog(`[FITA] Conversa com Diretora Elvira gravada.`);
          return;
        }
        Audio.playTerminal();
        send({ type: 'START_PHONE_CALL', contactId: obj.phoneCallId });
        setActivePhoneCall({ contactId: obj.phoneCallId, nodeId: 'initial', linesShown: 0, visitedNodes: [] });
        addLog(`[DIRETORIA] Diretora Elvira ergue o olhar quando você entra.`);
      } else if (currentRoomId !== 'escritorio') {
        if (obj.phoneCallId) {
          const contact = PHONE_CONTACTS[obj.phoneCallId];
          if (contact) {
            discoverContact(obj.phoneCallId);
            Audio.playDenied();
            addLog(`[TELEFONE] Número de ${contact.name}. Volte ao escritório para ligar.`);
          }
        } else {
          Audio.playDenied();
          addLog('[TELEFONE] Volte ao escritório para usar a agenda.');
        }
      } else {
        if (obj.phoneCallId) {
          const contact = PHONE_CONTACTS[obj.phoneCallId];
          if (!contact) return;
          discoverContact(obj.phoneCallId);
          if (pdCutoffContacts.includes(obj.phoneCallId)) {
            Audio.playDenied();
            addLog(`[TELEFONE] ${contact.name} não atende mais.`);
            return;
          }
          if (calledContacts.includes(obj.phoneCallId)) {
            Audio.playTerminal();
            addLog(`[FITA] Conversa com ${contact.name} gravada.`);
            return;
          }
          Audio.playTerminal();
          send({ type: 'START_PHONE_CALL', contactId: obj.phoneCallId });
          setActivePhoneCall({ contactId: obj.phoneCallId, nodeId: 'initial', linesShown: 0, visitedNodes: [] });
          addLog(`[TELEFONE] Ligando para ${contact.name}...`);
        } else {
          Audio.playTerminal();
          setPhoneAgendaOpen(true);
          addLog('[TELEFONE] Abrindo agenda...');
        }
      }
    } else {
      Audio.playTypewriter();
      addLog(`[${obj.label}] Não há nada aqui.`);
    }

    if (obj.hideAfterInteract && !interactedItems.includes(obj.id)) {
      send({ type: 'INTERACTED_WITH', objId: obj.id });
    }
  };

  const handleMenuSelect = (obj: Interactable, selection: string) => {
    const isUnlocked = unlockedObjects.has(obj.id);
    const outcome = resolveItemUse({ requiredItem: obj.requiredItem, selection, isUnlocked });

    if (outcome === 'denied') {
      Audio.playDenied();
      addLog(obj.failedMessage || `[ACESSO NEGADO] Requer o item apropriado: ${obj.label}`);
      return;
    }
    if (outcome === 'not-applicable') {
      Audio.playHover();
      addLog(`[${obj.label}] Esse item não serve aqui.`);
      return;
    }
    if (outcome === 'unlock') {
      send({ type: 'UNLOCK_OBJECT', objId: obj.id });
      if (obj.successMessage) addLog(obj.successMessage);
    }
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
      addLog(`[NAVEGAÇÃO] ${GAME_ROOMS[roomId].name} não explorado.`);
      return;
    }
    if (currentRoomId === roomId) {
      Audio.playDenied();
      return;
    }
    Audio.playDoor();
    setIsMapOpen(false);
    send({ type: 'MOVE_ROOM', target: roomId });
    const room = localRooms[roomId];
    if (room?.rain?.volume !== undefined) Audio.setRainVolume(room.rain.volume);
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

  const endPhoneCall = () => {
    if (!activePhoneCall) return;
    Audio.playHover();
    Audio.stopSpeak();
    const closingContactId = activePhoneCall.contactId;
    const closingNodeId = activePhoneCall.nodeId;
    const closingVisitedNodes = [...activePhoneCall.visitedNodes];
    const allNodes = [...closingVisitedNodes, closingNodeId];
    const ct = PHONE_CONTACTS[closingContactId];
    if (!calledContacts.includes(closingContactId)) {
      const recording: { speaker: string; lines: string[] }[] = [];
      for (const nid of allNodes) {
        const n = ct?.dialogue[nid];
        if (n) recording.push({ speaker: n.speaker, lines: n.lines });
      }
      send({ type: 'END_PHONE_CALL', contactId: closingContactId, recording });
      if (ct?.murphyCommentary) {
        const commentary: string[] = [];
        for (const nid of allNodes) {
          if (ct.murphyCommentary[nid]) commentary.push(...ct.murphyCommentary[nid]);
        }
        if (commentary.length > 0) {
          send({ type: 'SET_MURPHY_COMMENTARY', contactId: closingContactId, commentary });
        }
      }
    }
    setActivePhoneCall(null);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-noir-dark text-white font-mono uppercase relative overflow-hidden select-none pb-14 md:pb-0">
      <div className="crt-overlay" />
      <div className="scanline" />
      <Toaster richColors />

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
          <Button variant="frame" onClick={() => { setDevMode(v => !v); setSelectedObjId(null); }} className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 text-xs ${devMode ? 'bg-noir-amber text-black border-noir-amber' : 'text-gray-500 border-zinc-700 hover:text-zinc-300 hover:border-zinc-500'} transition-colors`}>
            <Bug size={12} className="md:w-3.5 md:h-3.5" /> <span className="hidden md:inline">DEV</span>
          </Button>
          <div className="text-right">
            <Badge classification="euclid" size="sm">{currentRoom.name}</Badge>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden z-10 relative">
        <div ref={viewportRef} className="flex-1 bg-zinc-950 relative md:border-r border-zinc-900 overflow-x-auto overflow-y-hidden shadow-inner group scp-scrollbar"
          onScroll={handleViewportScroll}
        >
          <div ref={sceneRef} className="relative h-full inline-block">
            {currentRoom.bgImage && (
              <img src={currentRoom.bgImage} alt={currentRoom.name}
                className="h-full w-auto opacity-90 pointer-events-none transition-opacity duration-1000 block" draggable={false} style={{ maxWidth: 'none' }} />
            )}
            <div className="rain-overlay" />

            {currentRoom.interactables.map((obj) => {
              if (!devMode && interactedItems.includes(obj.id)) return null;

              const IconCmp = IconMap[obj.icon] || IconMap['Search'];
              const hasItemImage = obj.type === 'pickup' && obj.pickupItem && ITEM_IMAGES[obj.pickupItem];
              const isSelected = devMode && selectedObjId === obj.id;
              const isBoxArea = !!(obj.width && obj.height);
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
                      <Button variant="ghost"
                        className={`w-full h-full min-w-[44px] min-h-[44px] flex flex-col items-center justify-center text-zinc-300 ${!devMode ? 'hover:text-noir-amber cursor-pointer' : 'cursor-grab'} transition-colors duration-200 ${isBoxArea ? '' : 'p-4 md:p-4'} border-none bg-transparent`}
                        style={{ pointerEvents: 'auto' }} tabIndex={-1}>
                        {!isHiddenIcon && hasItemImage ? (
                          <img src={ITEM_IMAGES[obj.pickupItem!]} alt={obj.label} className={`w-16 h-16 object-cover border border-zinc-500 rounded shadow-[0_0_15px_rgba(212,168,71,0.3)] transition-all ${!devMode ? 'opacity-0' : 'opacity-100'}`} />
                        ) : (!isHiddenIcon ? (
                          <IconCmp size={isBoxArea ? 24 : 48} className={`drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] filter ${!devMode ? 'opacity-0' : 'opacity-100'}`} />
                        ) : null)}
                        {devMode && <Badge classification={tooltipVariant} size="sm" className="mt-2">{obj.label}</Badge>}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent variant={tooltipVariant}>
                      <TooltipTitle>{obj.label}</TooltipTitle>
                      {obj.description && <TooltipBody>{obj.description.slice(0, 120)}{obj.description.length > 120 ? '...' : ''}</TooltipBody>}
                    </TooltipContent>
                  </Tooltip>
                  {devMode && isSelected && isBoxArea && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-noir-amber border-2 border-black z-40"
                      onMouseDown={(e) => handleDragMouseDown(e, obj, 'resize')} />
                  )}
                </>
              );

              if (devMode) {
                return (
                  <div key={obj.id} className={wrapperClassName} style={wrapperStyle}
                    onMouseDown={(e) => handleDragMouseDown(e, obj, 'move')}
                    onClick={(e) => handleInteract(obj, e)}>
                    {innerContent}
                  </div>
                );
              }

              const openObjMenu = (e: React.MouseEvent) => {
                if (panState.current?.dragging || wasPanning.current) return;
                e.preventDefault();
                e.stopPropagation();
                setObjMenu({ x: e.clientX, y: e.clientY, obj });
              };
              return (
                <button key={obj.id} type="button" aria-label={obj.label}
                  className={`${wrapperClassName} min-w-[44px] min-h-[44px] flex flex-col items-center justify-center text-zinc-300 cursor-pointer transition-colors duration-200 ${isBoxArea ? '' : 'p-4'} border-none bg-transparent`}
                  style={wrapperStyle} onClick={openObjMenu} onContextMenu={openObjMenu} />
              );
            })}
          </div>

          <div className="fog-overlay" style={{ position: 'absolute' }} />
          <div className="vignette-overlay" style={{ position: 'absolute' }} />

          {!devMode && (canPanLeft || canPanRight) && (
            <>
              {canPanLeft && (
                <button type="button" onClick={() => panNudge('left')}
                  className="absolute left-2 bottom-2 z-40 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/80 text-zinc-500 hover:text-noir-amber transition-colors rounded border border-zinc-700/50 border-none cursor-pointer"
                  aria-label="Mover câmera à esquerda"><ChevronLeft size={18} /></button>
              )}
              {canPanRight && (
                <button type="button" onClick={() => panNudge('right')}
                  className="absolute right-2 bottom-2 z-40 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/80 text-zinc-500 hover:text-noir-amber transition-colors rounded border border-zinc-700/50 border-none cursor-pointer"
                  aria-label="Mover câmera à direita"><ChevronRight size={18} /></button>
              )}
            </>
          )}

          {objMenu && createPortal(
            <div ref={objMenuRef}
              className="fixed z-[9999] bg-zinc-900 border border-noir-amber/40 rounded shadow-xl py-1 min-w-[200px] max-h-[60vh] overflow-y-auto institutional"
              style={{ left: objMenu.x, top: objMenu.y }}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              <div className="px-3 py-1.5 text-xs uppercase tracking-wider text-noir-amber/80 border-b border-zinc-700/60 truncate">{objMenu.obj.label}</div>
              <button type="button"
                className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800 hover:text-noir-amber transition-colors"
                onClick={(e) => { e.stopPropagation(); const o = objMenu.obj; setObjMenu(null); handleMenuSelect(o, INTERACT); }}
              >▸ Interagir</button>
              <div className="my-1 h-px bg-zinc-700/60" />
              {inventory.map((it) => (
                <button key={it} type="button"
                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-noir-amber transition-colors"
                  onClick={(e) => { e.stopPropagation(); const o = objMenu.obj; setObjMenu(null); handleMenuSelect(o, it); }}
                >{ITEM_NAMES[it] || it}</button>
              ))}
            </div>,
            document.body
          )}
        </div>

        <div className="hidden md:flex w-56 bg-black border-0 border-l border-noir-amber rounded-none z-20 flex-col">
          {devMode ? (
            <DevInspector rooms={localRooms} currentRoomId={currentRoomId}
              selectedObjId={selectedObjId} onSelectObj={setSelectedObjId}
              onUpdateObj={handleUpdateObj} onAddObj={handleAddObj}
              onRemoveObj={handleRemoveObj} onDownloadJSON={handleDownloadJSON} />
          ) : (
            <>
              <div className="p-4 pb-2">
                <Button variant="ghost" onClick={() => { Audio.playTypewriter(); setIsMapOpen(true); }}
                  onMouseEnter={() => Audio.playHover()}
                  className="w-full text-zinc-300 hover:text-noir-amber transition-colors text-xs tracking-widest justify-start">
                  <MapIcon size={14} /> MAPA DA CIDADE
                </Button>
              </div>
              <div className="border-t border-zinc-800/40" />
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
                  return evidence.length === 0
                    ? <p className="text-zinc-600 text-xs text-center py-4">VAZIO</p>
                    : evidence.map((item) => (
                        <div key={item} className="flex flex-col items-center gap-2 text-zinc-300 p-2 rounded-sm bg-zinc-900/50 border border-zinc-800/40">
                          {ITEM_IMAGES[item] ? (
                            <img src={ITEM_IMAGES[item]} alt={ITEM_NAMES[item] || item} className="w-12 h-12 object-cover border border-zinc-700 shadow-md" />
                          ) : (
                            <IconMap.Key size={24} className="text-noir-amber" />
                          )}
                          <Badge classification="safe" size="sm">{ITEM_NAMES[item] || item}</Badge>
                        </div>
                      ));
                })()}
              </div>
              <div className="p-4 space-y-2">
                <Button variant="ghost" onClick={() => {
                  if (currentRoomId !== 'escritorio') {
                    Audio.playDenied();
                    addLog('[TELEFONE] Volte ao escritório para usar a agenda.');
                    return;
                  }
                  Audio.playTerminal();
                  setPhoneAgendaOpen(true);
                }} onMouseEnter={() => Audio.playHover()}
                  className="w-full text-zinc-300 hover:text-noir-amber transition-colors text-xs tracking-widest justify-start">
                  <Phone size={14} /> AGENDA <Badge classification="euclid" size="sm" className="ml-1">{discoveredContacts.length}</Badge>
                </Button>
                <Button variant="ghost" onClick={() => { Audio.playTypewriter(); setCassetteMenuOpen(true); }}
                  onMouseEnter={() => Audio.playHover()}
                  className="w-full text-zinc-300 hover:text-noir-amber transition-colors text-xs tracking-widest justify-start">
                  <Archive size={14} /> FITA CASSETE
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {devMode ? (
        <footer className="hidden md:flex h-48 bg-zinc-950 border-t-2 border-noir-amber flex-col relative z-20">
          <DevInspector rooms={localRooms} currentRoomId={currentRoomId}
            selectedObjId={selectedObjId} onSelectObj={setSelectedObjId}
            onUpdateObj={handleUpdateObj} onAddObj={handleAddObj}
            onRemoveObj={handleRemoveObj} onDownloadJSON={handleDownloadJSON} />
        </footer>
      ) : (
        <footer className="h-32 md:h-48 bg-zinc-950 border-t-2 border-zinc-900 p-2 md:p-4 font-mono text-sm overflow-hidden flex flex-col relative z-20">
          <div className="text-noir-amber mb-1 md:mb-2 flex items-center gap-2 bg-transparent text-xs md:text-sm">
            <Wine size={14} /> DIÁRIO DE MURPHY
          </div>
          <div className="flex-1 w-full overflow-hidden" ref={xtermRef} />
        </footer>
      )}

      <div className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-black border-t border-noir-amber z-50 flex items-center justify-around px-1">
        <button onClick={() => { Audio.playTypewriter(); setIsMapOpen(true); }}
          className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-noir-amber active:text-noir-amber transition-colors px-2 py-1 min-w-[44px] min-h-[44px] justify-center">
          <MapIcon size={18} /><span className="text-[8px] tracking-widest">MAPA</span>
        </button>
        <button onClick={() => {
          if (currentRoomId !== 'escritorio') { Audio.playDenied(); addLog('[TELEFONE] Volte ao escritório para usar a agenda.'); return; }
          Audio.playTerminal(); setPhoneAgendaOpen(true);
        }} className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-noir-amber active:text-noir-amber transition-colors px-2 py-1 min-w-[44px] min-h-[44px] justify-center">
          <Phone size={18} /><span className="text-[8px] tracking-widest">AGENDA</span>
        </button>
        <button onClick={() => { Audio.playTypewriter(); setCassetteMenuOpen(true); }}
          className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-noir-amber active:text-noir-amber transition-colors px-2 py-1 min-w-[44px] min-h-[44px] justify-center">
          <Archive size={18} /><span className="text-[8px] tracking-widest">FITA</span>
        </button>
        <button onClick={() => setMobileInventoryOpen(true)}
          className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-noir-amber active:text-noir-amber transition-colors px-2 py-1 min-w-[44px] min-h-[44px] justify-center relative">
          <Package size={18} /><span className="text-[8px] tracking-widest">ITENS</span>
          {inventory.length > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-noir-amber text-black text-[8px] font-bold rounded-full flex items-center justify-center">{inventory.length}</span>}
        </button>
        <button onClick={() => setMobileTerminalOpen(!mobileTerminalOpen)}
          className={`flex flex-col items-center gap-0.5 transition-colors px-2 py-1 min-w-[44px] min-h-[44px] justify-center ${mobileTerminalOpen ? 'text-noir-amber' : 'text-zinc-500 hover:text-noir-amber active:text-noir-amber'}`}>
          <Terminal size={18} /><span className="text-[8px] tracking-widest">DIÁRIO</span>
        </button>
      </div>

      {mobileTerminalOpen && !devMode && (
        <div className="md:hidden fixed bottom-14 left-0 right-0 h-48 bg-zinc-950 border-t border-noir-amber z-40 flex flex-col p-2 font-mono text-sm">
          <div className="text-noir-amber mb-1 flex items-center gap-2 text-xs">
            <Wine size={14} /> DIÁRIO DE MURPHY
          </div>
          <div className="flex-1 w-full overflow-hidden" ref={xtermRef} />
        </div>
      )}

      <Dialog open={mobileInventoryOpen} onOpenChange={(open) => { if (!open) setMobileInventoryOpen(false); }}>
        <DialogContent className="md:hidden max-w-full h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3"><Package size={20} /> INVENTÁRIO</DialogTitle>
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
                return evidence.length === 0
                  ? <p className="text-zinc-600 text-xs text-center py-4 tracking-widest">VAZIO</p>
                  : <div className="grid grid-cols-3 gap-3">
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
                    </div>;
              })()}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={phoneAgendaOpen && !activePhoneCall} onOpenChange={(open) => { if (!open) setPhoneAgendaOpen(false); }}>
        <DialogContent className="max-w-full md:max-w-lg max-h-[90vh] md:max-h-none flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3"><Phone size={20} /> AGENDA TELEFÔNICA</DialogTitle>
            <DialogClose onClick={() => { Audio.playHover(); setPhoneAgendaOpen(false); }} />
          </DialogHeader>
          <DialogBody className="p-4 space-y-2 overflow-y-auto flex-1">
            {discoveredContacts.length === 0 ? (
              <p className="text-zinc-600 text-xs text-center py-8 tracking-widest">NENHUM CONTATO CONHECIDO</p>
            ) : (
              discoveredContacts.map((contactId) => {
                const contact = PHONE_CONTACTS[contactId];
                if (!contact) return null;
                const isLetter = contactId === 'seu_jonas';
                const wasCalled = calledContacts.includes(contactId);
                const isCutoff = pdCutoffContacts.includes(contactId);
                const hasRecording = !!phoneRecordings[contactId];
                const contactBadge = isCutoff ? 'keter' as const : wasCalled ? 'safe' as const : 'euclid' as const;
                const isElviraLocked = contactId === 'diretora_elvira' && !diretoraPhoneUnlocked;
                return (
                  <Button key={contactId} variant="ghost"
                    onClick={() => {
                      if (isCutoff) {
                        Audio.playDenied();
                        addLog(`[${isLetter ? 'CARTA' : 'TELEFONE'}] ${contact.name} cortou relações.`);
                        return;
                      }
                      if (contactId === 'diretora_elvira' && !diretoraPhoneUnlocked) {
                        Audio.playDenied();
                        addLog('[DIRETORIA] Fale com Diretora Elvira pessoalmente na escola.');
                        return;
                      }
                      if (wasCalled) {
                        if (hasRecording) {
                          Audio.playTerminal();
                          setPhoneAgendaOpen(false);
                          setCassettePlayback({ contactId, lines: phoneRecordings[contactId] });
                          addLog(isLetter ? `[FITA] Reouvindo carta de ${contact.name}...` : `[FITA] Reouvindo ${contact.name}...`);
                        } else {
                          Audio.playDenied();
                          addLog(`[TELEFONE] ${isLetter ? 'Carta já lida.' : 'Linha ocupada.'}`);
                        }
                        return;
                      }
                      Audio.playTerminal();
                      setPhoneAgendaOpen(false);
                      send({ type: 'START_PHONE_CALL', contactId });
                      setActivePhoneCall({ contactId, nodeId: 'initial', linesShown: 0, visitedNodes: [] });
                      addLog(isLetter ? `[CARTA] Lendo carta de ${contact.name}...` : `[TELEFONE] Ligando para ${contact.name}...`);
                    }}
                    onMouseEnter={() => Audio.playHover()}
                    className={`w-full bg-zinc-900 border border-zinc-800 hover:border-noir-amber p-3 flex items-center gap-4 text-left transition-colors group ${wasCalled && !hasRecording ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <div className="w-10 h-10 border border-zinc-700 group-hover:border-noir-amber flex items-center justify-center bg-black">
                      {wasCalled && hasRecording ? <Play size={18} className="text-noir-amber" />
                        : isLetter ? <Mail size={18} className="text-zinc-500 group-hover:text-noir-amber" />
                        : <PhoneCall size={18} className="text-zinc-500 group-hover:text-noir-amber" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-300 text-xs font-bold tracking-wider truncate group-hover:text-noir-amber transition-colors">{contact.name}</p>
                      <p className="text-zinc-600 text-[10px] tracking-wide">{isElviraLocked ? 'Diretoria — presencial' : (isLetter ? 'CARTA NO BECO' : contact.number)}</p>
                    </div>
                    <Badge classification={contactBadge} size="sm">
                      {isElviraLocked ? 'VISITAR' : (isCutoff ? 'CORTADO' : wasCalled && hasRecording ? 'OUVIR FITA' : wasCalled ? (isLetter ? 'GELESEN' : 'GETRENNT') : (isLetter ? 'LER' : 'LIGAR'))}
                    </Badge>
                  </Button>
                );
              })
            )}
          </DialogBody>
          <DialogFooter className="h-8 text-noir-amber text-xs flex items-center px-4 justify-between">
            <span>CONTATOS: {discoveredContacts.length}</span>
            <span className="animate-pulse">LINHA ESTATAL</span>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activePhoneCall} onOpenChange={(open) => { if (!open) endPhoneCall(); }}>
        <DialogContent className="max-w-full md:max-w-xl max-h-[90vh] md:max-h-none flex flex-col">
          {activePhoneCall && (() => {
            const contact = PHONE_CONTACTS[activePhoneCall.contactId];
            if (!contact) return null;
            const node = contact.dialogue[activePhoneCall.nodeId];
            if (!node) return null;
            const isLetter = activePhoneCall.contactId === 'seu_jonas';
            const isCallEnded = node.choices.length === 0;

            const handleChoice = (choice: { text: string; goto: string; pdAction?: string }) => {
              if (activePhoneCall.contactId === 'zeca' && choice.text.includes('Dra. Cunha')) {
                addLog('[ZECA] "Posto de saúde do distrito. Perto da Volksschule."');
              }
              if (choice.pdAction) {
                send({ type: 'RECORD_PD_ACTION', contactId: activePhoneCall.contactId, action: choice.pdAction });
              }
              const ct = PHONE_CONTACTS[activePhoneCall.contactId];
              if (ct && choice.pdAction === 'D') {
                const targetNode = ct.dialogue[choice.goto];
                if (targetNode && targetNode.choices.length === 0) {
                  const strategy = ct.axelrodStrategy;
                  let isCutoff = false;
                  if (strategy === 'Grudger' || strategy === 'TitForTat' || strategy === 'HardProber' || strategy === 'Detective') {
                    isCutoff = true;
                  } else if (strategy === 'EugineNier') {
                    const playerAllDs = (pdChoiceHistory[activePhoneCall.contactId] || []).filter(a => a === 'D').length;
                    if (playerAllDs >= 5) isCutoff = true;
                  } else if (strategy === 'SneakyTitForTat') {
                    isCutoff = false;
                  } else if (strategy === 'SoftGrudger' && activePhoneCall.visitedNodes.reduce((count, prev) => {
                      const prevNode = ct.dialogue[prev];
                      return count + (prevNode?.choices.filter(c => c.pdAction === 'D').length || 0);
                    }, 0) >= 3) {
                    isCutoff = true;
                  } else if (strategy === 'Forgiver' && rng42() >= 0.1) {
                    isCutoff = true;
                  } else if (strategy === 'RandomStrategy' && rng42() < 0.5) {
                    isCutoff = true;
                  }
                  if (isCutoff) send({ type: 'CUT_OFF_CONTACT', contactId: activePhoneCall.contactId });
                }
              }
              for (const [revealedId, cfg] of Object.entries(DIALOGUE_REVEALS)) {
                if (cfg.speakerId === activePhoneCall.contactId && choice.goto === cfg.nodeId) {
                  discoverContact(revealedId);
                }
              }

              if (activePhoneCall.contactId === 'diretora_elvira' && activePhoneCall.nodeId === 'de_confirma' && choice.goto === 'de_end_e') {
                if (!diretoraPhoneUnlocked) {
                  send({ type: 'UNLOCK_DIRETORA_PHONE' });
                  addLog('[DIRETORIA] Diretora Elvira anota um número. "Ligue do escritório."');
                }
              }
              Audio.playTypewriter();
              setActivePhoneCall(prev => prev ? { ...prev, nodeId: choice.goto, linesShown: 0, visitedNodes: [...prev.visitedNodes, prev.nodeId] } : null);
            };

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    {isLetter ? <Mail size={18} /> : <Radio size={18} />}
                    {isLetter ? `CARTA — ${contact.name.toUpperCase()}` : `${activePhoneCall.contactId === 'diretora_elvira' ? '314-7721' : contact.number} — ${contact.name.toUpperCase()}`}
                  </DialogTitle>
                  <DialogClose />
                </DialogHeader>

                {isLetter ? (
                  <>
                    <DialogBody className="dlg-carta-body min-h-[200px] max-h-[50vh] flex-1 space-y-3">
                      <div className="dlg-carta-static" />
                      {activePhoneCall.nodeId === 'initial' && contact.greeting && (
                        <div className="dlg-carta-balloon dlg-carta-balloon-left" style={{ animationDelay: '0s' }}>
                          <div className="dlg-carta-speaker">{node.speaker.toUpperCase()}</div>
                          <div>{contact.greeting}</div>
                        </div>
                      )}
                      <div className="dlg-carta-balloon dlg-carta-balloon-left" style={{ animationDelay: '0.05s' }}>
                        <div className="dlg-carta-speaker">{node.speaker.toUpperCase()}</div>
                        {node.lines.map((line, i) => (
                          <p key={i} style={{ marginBottom: i < node.lines.length - 1 ? 4 : 0 }}>{line}</p>
                        ))}
                        <div className="dlg-carta-time">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </DialogBody>
                    {!isCallEnded ? (
                      <div className="dlg-carta-body border-t border-noir-amber/20 space-y-2 p-3">
                        <p className="dlg-carta-speaker" style={{ opacity: 1, color: 'rgba(212,168,71,0.5)', marginBottom: 6 }}>RESPOSTA:</p>
                        {node.choices.map((choice, i) => (
                          <button key={i} onClick={() => handleChoice(choice)}
                            onMouseEnter={() => Audio.playHover()}
                            className="dlg-carta-balloon dlg-carta-balloon-right dlg-carta-choice-row"
                            style={{ cursor: 'pointer', animationDelay: `${i * 0.06}s` }}>
                            <span className="dlg-carta-choice-num" style={{ fontSize: '9px', opacity: 0.5, marginRight: 8 }}>{String(i + 1).padStart(2, '0')}</span>
                            <span>{choice.text}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="dlg-carta-body border-t border-noir-amber/20 py-4">
                        <Badge classification="safe" className="mx-auto">— FIM DA CARTA —</Badge>
                      </div>
                    )}
                    <div className="dlg-radio-status-bar">
                      <span>BRIEF</span>
                      <Badge classification={isCallEnded ? 'safe' : 'euclid'} size="sm" className="animate-pulse">
                        {isCallEnded ? 'GELESEN' : 'UNGELESEN'}
                      </Badge>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="dlg-radio-freq-bar">
                      <span>{'● FUNK'}</span>
                      <div className="dlg-radio-signal">
                        {[8, 11, 14, 14, 14].map((h, i) => (
                          <div key={i} className={`dlg-radio-signal-bar ${isCallEnded ? (i < 2 ? 'active' : 'inactive') : 'active'}`} style={{ height: h }} />
                        ))}
                      </div>
                      <span>{contact.number}</span>
                    </div>
                    <div className="dlg-radio-body flex-1 flex flex-col min-h-[200px] max-h-[50vh]">
                      <div className="dlg-radio-static" />
                      <div className="dlg-radio-content space-y-3">
                        {activePhoneCall.nodeId === 'initial' && contact.greeting && (
                          <p className="dlg-radio-transmission" style={{ fontSize: '11px', opacity: 0.4, fontStyle: 'italic' }}>{contact.greeting}</p>
                        )}
                        <div className="dlg-radio-speaker">{node.speaker.toUpperCase()}</div>
                        {node.lines.map((line, i) => (
                          <p key={i} className="dlg-radio-transmission dlg-radio-line">{line}</p>
                        ))}
                      </div>
                      <div className="dlg-radio-wave"><div className="dlg-radio-wave-line" /></div>
                    </div>
                    {!isCallEnded ? (
                      <div className="dlg-radio-choice-area space-y-1">
                        <p className="dlg-radio-choice-label">TRANSMITIR:</p>
                        {node.choices.map((choice, i) => (
                          <button key={i} onClick={() => handleChoice(choice)}
                            onMouseEnter={() => Audio.playHover()}
                            className="dlg-radio-choice-btn">
                            <span className="dlg-radio-choice-num">{String(i + 1).padStart(2, '0')}</span>
                            <span className="flex-1">{choice.text}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="dlg-radio-choice-area">
                        <div className="dlg-radio-ended-indicator">{'*C L I C*'}</div>
                      </div>
                    )}
                    <div className="dlg-radio-status-bar">
                      <span>TELEFON</span>
                      <Badge classification={isCallEnded ? 'keter' : 'thaumiel'} size="sm" className="animate-pulse">
                        {isCallEnded ? 'GETRENNT' : 'VERBUNDEN'}
                      </Badge>
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={cassetteMenuOpen} onOpenChange={(open) => { if (!open) setCassetteMenuOpen(false); }}>
        <DialogContent className="max-w-full md:max-w-lg flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3"><Archive size={20} /> FITA CASSETE</DialogTitle>
            <DialogClose onClick={() => setCassetteMenuOpen(false)} />
          </DialogHeader>
          <DialogBody className="p-4 space-y-2 overflow-y-auto max-h-[60vh]">
            {Object.keys(phoneRecordings).length === 0 ? (
              <p className="text-zinc-600 text-xs text-center py-8 tracking-widest">NENHUMA GRAVAÇÃO</p>
            ) : (
              Object.entries(phoneRecordings).map(([contactId, recording]) => {
                const blocks = recording as { speaker: string; lines: string[] }[];
                const contact = PHONE_CONTACTS[contactId];
                if (!contact) return null;
                const isLetter = contactId === 'seu_jonas';
                const commentary = murphyCommentaryMap[contactId];
                return (
                  <Button key={contactId} variant="ghost"
                    onClick={() => { setCassetteMenuOpen(false); setCassettePlayback({ contactId, lines: blocks }); Audio.playTerminal(); addLog(isLetter ? `[FITA] Reouvindo carta de ${contact.name}...` : `[FITA] Reouvindo ${contact.name}...`); }}
                    onMouseEnter={() => Audio.playHover()}
                    className="w-full bg-zinc-900 border border-zinc-800 hover:border-noir-amber p-3 flex items-center gap-4 text-left transition-colors group">
                    <div className="w-10 h-10 border border-zinc-700 group-hover:border-noir-amber flex items-center justify-center bg-black">
                      <Play size={18} className="text-noir-amber" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-300 text-xs font-bold tracking-wider truncate group-hover:text-noir-amber transition-colors">{contact.name}</p>
                      <p className="text-zinc-600 text-[10px] tracking-wide">{isLetter ? 'CARTA' : (contactId === 'diretora_elvira' ? '314-7721' : contact.number)} — {blocks.length} blocos</p>
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
                    {isLetter ? `FITA — CARTA DE ${contact.name.toUpperCase()}` : `FITA — ${cassettePlayback.contactId === 'diretora_elvira' ? '314-7721' : contact.number}`}
                  </DialogTitle>
                  <DialogClose />
                </DialogHeader>
                <DialogBody className="p-4 md:p-6 space-y-4 min-h-[200px] max-h-[50vh] overflow-y-auto flex-1">
                  {cassettePlayback.contactId !== 'seu_jonas' && (
                    <p className="text-zinc-600 text-xs italic tracking-wide border-b border-zinc-800 pb-3">*estática* ... gravação recuperada ...</p>
                  )}
                  {cassettePlayback.lines.map((block, i) => (
                    <div key={i} className="space-y-2">
                      <p className="text-noir-amber text-[10px] font-bold tracking-widest border-b border-zinc-900 pb-1">{block.speaker.toUpperCase()}:</p>
                      {block.lines.map((line, j) => (
                        <p key={j} className="text-zinc-400 text-sm tracking-wide leading-relaxed pl-2 border-l-2 border-zinc-800 italic">{line}</p>
                      ))}
                    </div>
                  ))}
                  {murphyCommentaryMap[cassettePlayback.contactId] && (
                    <div className="space-y-2 border-t border-zinc-800 pt-4 mt-2">
                      <p className="text-noir-amber text-[10px] font-bold tracking-widest border-b border-zinc-900 pb-1">MURPHY — NOTAS PESSOAIS:</p>
                      {murphyCommentaryMap[cassettePlayback.contactId].map((line, i) => (
                        <p key={i} className="text-zinc-500 text-xs tracking-wide leading-relaxed pl-2 border-l-2 border-amber-900/50 italic">{line}</p>
                      ))}
                    </div>
                  )}
                </DialogBody>
                <DialogFooter className="p-4 bg-black/50">
                  <Badge classification="safe" className="mx-auto">— FIM DA FITA —</Badge>
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

      <Dialog open={isMapOpen} onOpenChange={(open) => { if (!open) setIsMapOpen(false); }}>
        <DialogContent className="max-w-full md:max-w-4xl h-[90vh] md:h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3"><MapIcon /> MAPA DA CIDADE</DialogTitle>
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
                <Button key={roomId} variant="ghost" onClick={() => handleMapTravel(roomId)}
                  onMouseEnter={() => Audio.playHover()}
                  className={`absolute w-24 h-16 md:w-28 md:h-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center text-[10px] tracking-wider transition-colors duration-300 overflow-hidden rounded-sm border-none min-w-[44px] min-h-[44px]
                    ${isCurrent ? 'border-2 border-noir-amber text-noir-amber shadow-[0_0_15px_rgba(212,168,71,0.5)] z-20'
                    : isVisited ? 'text-zinc-300 hover:text-noir-amber z-10' : 'text-zinc-700 cursor-not-allowed z-0'}`}
                  style={{ left: `${coords.x}%`, top: `${coords.y}%` }}>
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

      {muralOpen && (
        <MuralOverlay
          mural={mural}
          onChange={next => send({ type: 'UPDATE_MURAL', mural: next })}
          onClose={() => setMuralOpen(false)}
          onAccuse={handleAccuse}
        />
      )}

      {gameCompleted && (() => {
        const completion = calculateGameCompletion();
        const score = completion.muralScore;
        return (
          <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="crt-overlay" /><div className="scanline" />
            <div className="border border-noir-amber bg-zinc-950 w-full max-w-lg shadow-[0_0_60px_rgba(212,168,71,0.3)] relative">
              <div className="border-b border-noir-amber p-6 bg-black text-center">
                <h1 className="text-3xl text-noir-amber font-bold tracking-widest mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>FALL HELENA KRAFT</h1>
                <p className="text-zinc-500 text-xs tracking-widest">ARQUIVO FECHADO</p>
              </div>
              <div className="p-8 text-center space-y-6">
                <div className="flex items-end justify-center gap-8">
                  <div>
                    <p className="text-noir-amber text-6xl font-bold tracking-widest" style={{ fontFamily: 'Playfair Display, serif' }}>{completion.percent}%</p>
                    <p className="text-zinc-500 text-xs tracking-widest mt-2">CONCLUSÃO DO CASO</p>
                  </div>
                  <div>
                    <p className="text-noir-amber text-6xl font-bold tracking-widest" style={{ fontFamily: 'Playfair Display, serif' }}>{score.points}</p>
                    <p className="text-zinc-500 text-xs tracking-widest mt-2">PONTOS DO MURAL</p>
                  </div>
                </div>
                <div className="space-y-3 text-left border border-zinc-800 p-4 bg-black/50">
                  <div className="flex justify-between items-center"><span className="text-zinc-400 text-xs tracking-wide">Entrevistas</span><span className="text-zinc-300 text-xs font-bold">{completion.interviewsCompleted}/9</span></div>
                  <div className="flex justify-between items-center"><span className="text-zinc-400 text-xs tracking-wide">Docs lidos</span><span className="text-zinc-300 text-xs font-bold">{completion.cluesRead}/5</span></div>
                  <div className="flex justify-between items-center border-t border-zinc-800 pt-3"><span className="text-zinc-400 text-xs tracking-wide">Pistas no mural ×{POINTS_PER_CLUE}</span><span className="text-zinc-300 text-xs font-bold">{score.clues} × {POINTS_PER_CLUE} = {score.clues * POINTS_PER_CLUE}</span></div>
                  <div className="flex justify-between items-center"><span className="text-zinc-400 text-xs tracking-wide">Fios no mural ×{POINTS_PER_CONNECTION}</span><span className="text-zinc-300 text-xs font-bold">{score.connections} × {POINTS_PER_CONNECTION} = {score.connections * POINTS_PER_CONNECTION}</span></div>
                  <div className="flex justify-between items-center"><span className="text-zinc-400 text-xs tracking-wide">Grafo conexo</span><span className={`text-xs font-bold ${score.singleComponent ? 'text-green-500' : 'text-zinc-600'}`}>{score.singleComponent ? `+${BONUS_CONNECTED}` : 'NÃO'}</span></div>
                  <div className="flex justify-between items-center border-t border-zinc-800 pt-3">
                    <span className="text-zinc-400 text-xs tracking-wide">ZD-GTFT-2</span>
                    <span className={`text-xs font-bold ${completion.zdgtft2Compliant ? 'text-noir-amber' : 'text-noir-red'}`}>{completion.zdgtft2Compliant ? 'CONFORME' : 'NÃO CONFORME'}</span>
                  </div>
                </div>
                {completion.zdgtft2Compliant && (
                  <p className="text-noir-amber text-xs tracking-widest font-bold border-t border-noir-amber pt-4">INVESTIGADOR EXEMPLAR — ZD-GTFT-2</p>
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

      {isSettingsOpen && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-2 md:p-8">
          <div className="border border-noir-amber bg-zinc-950 w-full max-w-md flex flex-col shadow-[0_0_30px_rgba(212,168,71,0.15)] animate-in fade-in zoom-in duration-200">
            <div className="border-b border-noir-amber p-4 bg-black flex justify-between items-center text-noir-amber">
              <h2 className="font-bold text-xl tracking-widest flex items-center gap-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                <Settings /> CONFIGURAÇÕES
              </h2>
              <button onClick={() => { Audio.playHover(); setIsSettingsOpen(false); }}
                className="text-noir-amber hover:text-white bg-zinc-900 px-4 py-1 text-sm border border-zinc-700"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-6">
              {[
                { id: 'master', label: 'Volume Geral' },
                { id: 'ambient', label: 'Ambiente' },
                { id: 'sfx', label: 'Efeitos' },
                { id: 'voice', label: 'Vozes' },
              ].map((item) => (
                <div key={item.id} className="space-y-2">
                  <div className="flex justify-between text-xs tracking-widest">
                    <span className="text-zinc-400">{item.label}</span>
                    <span className="text-noir-amber">{Math.round(Audio.volumes[item.id as keyof typeof Audio.volumes] * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Volume2 size={14} className="text-zinc-600" />
                    <input type="range" min="0" max="1" step="0.01"
                      value={Audio.volumes[item.id as keyof typeof Audio.volumes]}
                      onChange={(e) => { Audio.setVolume(item.id as any, parseFloat(e.target.value)); setDevMode(d => d); }}
                      className="flex-1 accent-noir-amber bg-zinc-800 h-1 appearance-none cursor-pointer" />
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-zinc-900 bg-black/50 text-[10px] text-zinc-600 text-center tracking-widest">
              ÁUDIO EM TEMPO REAL — SISTEMA MURPHY
            </div>
          </div>
        </div>
      )}

      {documentData && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-8">
          <div className="border border-noir-amber bg-zinc-950 w-full max-w-3xl max-h-full flex flex-col shadow-[0_0_30px_rgba(212,168,71,0.15)] relative animate-in fade-in zoom-in duration-200">
            <div className="border-b border-noir-amber p-4 bg-black flex justify-between items-center">
              <h2 className="text-noir-amber font-bold text-xl tracking-widest flex items-center gap-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                <FileText /> {documentData.title}
              </h2>
              <button onClick={closeDocument} onMouseEnter={() => Audio.playHover()}
                className="text-white hover:text-noir-amber bg-zinc-900 px-4 py-1 text-sm border border-zinc-700">FECHAR</button>
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
  const [hasStarted, setHasStarted] = useState<'new' | 'continue' | null>(null);
  const savedGame = (() => {
    try {
      const raw = localStorage.getItem('scp_law_save');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  })();

  if (!hasStarted) {
    return (
      <div className="flex flex-col h-screen w-full bg-noir-dark text-white font-mono uppercase relative items-center justify-center select-none">
        <div className="crt-overlay" /><div className="scanline" /><div className="rain-overlay" /><div className="vignette-overlay" />
        <div className="border border-noir-amber/20 bg-black/40 p-10 md:p-14 relative max-w-lg w-full mx-4">
          <h1 className="text-5xl text-noir-amber font-bold mb-2 tracking-widest text-center" style={{ fontFamily: 'Playfair Display, serif' }}>MURPHY LAW</h1>
          <p className="text-lg text-amber-700 mb-10 tracking-widest text-center">INVESTIGAÇÕES PRIVADAS</p>
          <div className="space-y-4">
            {savedGame && (
              <button onClick={async () => {
                await Audio.init(); await Audio.startAmbient();
                const room = GAME_ROOMS[savedGame.currentRoomId];
                if (room?.rain?.volume !== undefined) Audio.setRainVolume(room.rain.volume);
                setHasStarted('continue');
              }} className="relative z-50 w-full border border-noir-amber text-noir-amber px-6 py-4 hover:bg-noir-amber hover:text-black font-bold tracking-widest transition-colors text-left flex items-center justify-between">
                <span>CONTINUAR</span>
                <span className="text-[10px] opacity-60 normal-case font-normal">
                  {savedGame.currentRoomId ? GAME_ROOMS[savedGame.currentRoomId]?.name : ''} · {savedGame.gameCompleted ? `${scoreMural(savedGame.mural ?? { clues: [], connections: [] }).points} PTS` : `${savedGame.visitedRooms?.length || 0}/${Object.keys(GAME_ROOMS).length}`}
                </span>
              </button>
            )}
            <button onClick={async () => {
              localStorage.removeItem('scp_law_save');
              await Audio.init(); await Audio.startAmbient();
              const startRoom = GAME_ROOMS['escritorio'];
              if (startRoom?.rain?.volume !== undefined) Audio.setRainVolume(startRoom.rain.volume);
              setHasStarted('new');
            }} className="relative z-50 w-full border-2 border-noir-amber text-noir-amber px-6 py-4 hover:bg-noir-amber hover:text-black font-bold tracking-widest transition-colors">
              {savedGame ? 'NOVA PARTIDA' : 'ACEITAR O CASO'}
            </button>
          </div>
          <p className="text-zinc-600 text-[10px] mt-8 text-center tracking-wider">
            Uma amiga na Fundação pediu minha ajuda. Criança desaparecida. Não aceitei dinheiro.
          </p>
        </div>
      </div>
    );
  }

  return <Game loadFromSave={hasStarted === 'continue'} />;
}