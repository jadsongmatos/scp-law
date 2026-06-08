import { useGameState, DEDUCTION_LOCATIONS, DEDUCTION_CATEGORIES, DEDUCTION_SOLUTION, DeductionCategory, PERMANENT_ITEMS } from './GameState';
import { GAME_ROOMS, Interactable, ITEM_NAMES, PHONE_CONTACTS } from '../data';
import { Audio } from '../audio';
import { resolveItemUse, INTERACT } from '../lib/itemUse';

export function useGameActions() {
  const s = useGameState();

  const addLog = (msg: string) => {
    window.dispatchEvent(new CustomEvent('game-log', { detail: msg }));
  };

  const discoverContact = (contactId: string) => {
    if (s.discoveredContacts.current.includes(contactId)) return;
    s.discoveredContacts.current = [...s.discoveredContacts.current, contactId];
    const contact = PHONE_CONTACTS[contactId];
    if (contact) {
      addLog(`[AGENDA] Novo contato: ${contact.name} — ${contact.number}`);
    }
  };

  const handleInteract = (obj: Interactable) => {
    if (s.devMode.current) {
      s.selectedObjId.current = obj.id;
      return;
    }

    if (obj.type === 'travel' && obj.targetRoom) {
      Audio.playDoor();
      s.isMapOpen.current = true;
    } else if (obj.type === 'pickup' && obj.pickupItem) {
      Audio.playPickup();
      if (!s.inventory.current.includes(obj.pickupItem)) {
        s.inventory.current = [...s.inventory.current, obj.pickupItem];
        addLog(obj.description || `Você pegou: ${ITEM_NAMES[obj.pickupItem] || obj.pickupItem}`);
      }
      if (obj.pickupItem === 'cartao_visita') {
        discoverContact('diretora_elvira');
      }
    } else if (obj.type === 'terminal_read' && obj.documentData) {
      if (obj.interviewGate && s.pdCutoffContacts.current.includes(obj.interviewGate)) {
        Audio.playDenied();
        addLog(`[ACESSO NEGADO] Entrevista com ${obj.interviewGate} falhou. Documento selado.`);
      } else if (obj.id === 'puzzle_deduction_terminal' || obj.id === 'detective_board') {
        Audio.playTerminal();
        s.deductionOpen.current = true;
        s.deductionResult.current = null;
        addLog('Acessando quadro de dedução...');
        Audio.speak(obj.id);
      } else {
        Audio.playTerminal();
        s.documentData.current = obj.documentData;
        addLog(`Acessando arquivo: ${obj.label}...`);
        Audio.speak(obj.id);
        if (obj.id.startsWith('interview_clue_')) {
          if (!s.readInterviewClues.current.includes(obj.id)) {
            s.readInterviewClues.current = [...s.readInterviewClues.current, obj.id];
          }
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
        if (s.pdCutoffContacts.current.includes(obj.phoneCallId)) {
          Audio.playDenied();
          addLog(`[CARTA] Seu Jonas se recusa a escrever mais. A correspondência foi cortada.`);
          return;
        }
        if (s.calledContacts.current.includes(obj.phoneCallId)) {
          Audio.playTerminal();
          addLog(`[FITA] A fita cassete captou a leitura da carta de ${contact.name}. Use a agenda para ouvir.`);
          return;
        }
        Audio.playTypewriter();
        s.activePhoneCall.current = { contactId: obj.phoneCallId, nodeId: 'initial', linesShown: 0, visitedNodes: [] };
        addLog(`[CARTA] Lendo carta de ${contact.name}...`);
      } else if (s.currentRoomId.current !== 'escritorio') {
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
          if (s.pdCutoffContacts.current.includes(obj.phoneCallId)) {
            Audio.playDenied();
            addLog(`[TELEFONE] ${contact.name} não atende mais. O número foi cortado.`);
            return;
          }
          if (s.calledContacts.current.includes(obj.phoneCallId)) {
            Audio.playTerminal();
            addLog(`[FITA] A fita cassete captou a conversa com ${contact.name}. Use a agenda para ouvir.`);
            return;
          }
          Audio.playTerminal();
          s.activePhoneCall.current = { contactId: obj.phoneCallId, nodeId: 'initial', linesShown: 0, visitedNodes: [] };
          addLog(`[TELEFONE] Ligando para ${contact.name}...`);
        } else {
          Audio.playTerminal();
          s.phoneAgendaOpen.current = true;
          addLog('[TELEFONE] Abrindo agenda telefônica...');
        }
      }
    } else {
      Audio.playTypewriter();
      addLog(`[${obj.label}] Não há nada que você possa fazer aqui.`);
    }

    if (obj.id.startsWith('puzzle_hint_')) {
      if (!s.readHints.current.includes(obj.id)) {
        s.readHints.current = [...s.readHints.current, obj.id];
      }
    }

    if (obj.hideAfterInteract && !s.interactedItems.current.includes(obj.id)) {
      s.interactedItems.current = [...s.interactedItems.current, obj.id];
    }
  };

  const handleMenuSelect = (obj: Interactable, selection: string) => {
    const isUnlocked = s.unlockedObjects.current.includes(obj.id);
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
      if (!s.unlockedObjects.current.includes(obj.id)) {
        s.unlockedObjects.current = [...s.unlockedObjects.current, obj.id];
      }
      if (obj.successMessage) addLog(obj.successMessage);
    }
    handleInteract(obj);
  };

  const handleMapTravel = (roomId: string) => {
    if (!s.visitedRooms.current.includes(roomId)) {
      Audio.playDenied();
      addLog(`[NAVEGAÇÃO] ${GAME_ROOMS[roomId].name} ainda não foi explorado.`);
      return;
    }
    if (s.currentRoomId.current === roomId) {
      Audio.playDenied();
      return;
    }
    Audio.playDoor();
    s.isMapOpen.current = false;
    s.currentRoomId.current = roomId;
    addLog(`[NAVEGAÇÃO] Indo para: ${GAME_ROOMS[roomId].name}`);
  };

  const handlePhoneChoice = (choice: { text: string; goto: string; pdAction?: string }) => {
    const call = s.activePhoneCall.current;
    if (!call) return;

    if (call.contactId === 'zeca' && choice.text.includes('Dra. Cunha')) {
      discoverContact('dra_cunha');
    }
    if (choice.pdAction) {
      s.pdChoiceHistory.current = {
        ...s.pdChoiceHistory.current,
        [call.contactId]: [...(s.pdChoiceHistory.current[call.contactId] || []), choice.pdAction!],
      };
    }
    const ct = PHONE_CONTACTS[call.contactId];
    if (ct && choice.pdAction === 'D') {
      const targetNode = ct.dialogue[choice.goto];
      if (targetNode && targetNode.choices.length === 0) {
        const strategy = ct.axelrodStrategy;
        const isCutoff = strategy === 'Grudger'
          || strategy === 'TitForTat'
          || (strategy === 'SoftGrudger' && call.visitedNodes.reduce((count, prev) => {
            const prevNode = ct.dialogue[prev];
            return count + (prevNode?.choices.filter(c => c.pdAction === 'D').length || 0);
          }, 0) >= 3);
        if (isCutoff) {
          if (!s.pdCutoffContacts.current.includes(call.contactId)) {
            s.pdCutoffContacts.current = [...s.pdCutoffContacts.current, call.contactId];
          }
        }
      }
    }
    Audio.playTypewriter();
    s.activePhoneCall.current = { ...call, nodeId: choice.goto, linesShown: 0, visitedNodes: [...call.visitedNodes, call.nodeId] };
  };

  const handleDeductionSubmit = () => {
    Audio.playTerminal();
    s.deductionAttempts.current = s.deductionAttempts.current + 1;
    let allFilled = true;
    let allCorrect = true;
    const grid = s.deductionGrid.current;
    for (const loc of DEDUCTION_LOCATIONS) {
      for (const cat of Object.keys(DEDUCTION_CATEGORIES) as DeductionCategory[]) {
        if (!grid[loc][cat]) { allFilled = false; break; }
        if (grid[loc][cat] !== DEDUCTION_SOLUTION[loc][cat]) allCorrect = false;
      }
      if (!allFilled) break;
    }
    s.deductionOpen.current = false;
    if (!allFilled) {
      addLog('[DEDUÇÃO] Submetendo ao canal seguro da Fundação...');
      s.activePhoneCall.current = { contactId: 'agente_scp', nodeId: 'deduction_incomplete', linesShown: 0, visitedNodes: [] };
    } else if (allCorrect) {
      addLog('[DEDUÇÃO] Submetendo ao canal seguro da Fundação...');
      s.activePhoneCall.current = { contactId: 'agente_scp', nodeId: 'deduction_correct', linesShown: 0, visitedNodes: [] };
    } else {
      addLog('[DEDUÇÃO] Submetendo ao canal seguro da Fundação...');
      s.activePhoneCall.current = { contactId: 'agente_scp', nodeId: 'deduction_wrong', linesShown: 0, visitedNodes: [] };
    }
  };

  const calculateGameCompletion = () => {
    const totalHints = 18;
    const totalContacts = 5;
    const hintsFound = s.readHints.current.length / totalHints;
    const interviewsCompleted = s.calledContacts.current.filter(c => c !== 'agente_scp' && !s.pdCutoffContacts.current.includes(c)).length / totalContacts;
    const cluesRead = s.readInterviewClues.current.length / totalContacts;
    const deductionScore = s.deductionResult.current === 'correct' ? Math.max(0.5, 1 - 0.1 * Math.max(0, s.deductionAttempts.current - 1)) : 0;

    let tftCompliant = true;
    const contactIds = Object.keys(PHONE_CONTACTS);
    let anyInterviewHeld = false;
    for (const cid of contactIds) {
      if (cid === 'agente_scp') continue;
      const history = s.pdChoiceHistory.current[cid] || [];
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
    return {
      percent,
      tftCompliant,
      hintsFound: s.readHints.current.length,
      interviewsCompleted: s.calledContacts.current.filter(c => c !== 'agente_scp' && !s.pdCutoffContacts.current.includes(c)).length,
      cluesRead: s.readInterviewClues.current.length,
      deductionCorrect: s.deductionResult.current === 'correct',
      deductionAttempts: s.deductionAttempts.current,
    };
  };

  return {
    addLog,
    discoverContact,
    handleInteract,
    handleMenuSelect,
    handleMapTravel,
    handlePhoneChoice,
    handleDeductionSubmit,
    calculateGameCompletion,
  };
}
