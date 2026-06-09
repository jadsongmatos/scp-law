import { GAME_ROOMS, ITEM_NAMES, PHONE_CONTACTS, Room, Interactable } from '../data';
import { resolveItemUse, INTERACT, ItemUseSelection, ItemUseOutcome } from '../lib/itemUse';

export type DeductionCategory = 'suspeito' | 'local' | 'arma' | 'motivo' | 'horario';

export const DEDUCTION_SOLUTION: Record<string, Record<DeductionCategory, string>> = {
  'Escritório Murphy': { suspeito: 'Dra. Cunha', local: 'Gasthof Vila Nova', arma: 'Chave Inglesa', motivo: 'Extorsão', horario: '04:00' },
  'Rua Sieben': { suspeito: 'Zeca do Gasthof', local: 'Volkspolizeistation 8', arma: 'Arame de Piano', motivo: 'Tráfico de Crianças', horario: '02:30' },
  'Gasthof Vila Nova': { suspeito: 'Seu Jonas', local: 'Volksschule Vila Nova', arma: 'Faca de Cozinha', motivo: 'Vingança Pessoal', horario: '01:00' },
  'Volksschule': { suspeito: 'Diretora Elvira', local: 'Beco da Rua Sieben', arma: 'Revolver .38', motivo: 'Dívida de Jogo', horario: '23:30' },
  'Volkspolizeistation 8': { suspeito: 'Kommissar Mendes', local: 'Lagerhaus 7', arma: 'Veneno Injetável', motivo: 'Cobertura de Crime', horario: '22:00' },
};

export const DEDUCTION_LOCATIONS = [
  'Escritório Murphy',
  'Rua Sieben',
  'Gasthof Vila Nova',
  'Volksschule',
  'Volkspolizeistation 8',
];

export const DEDUCTION_CATEGORIES: DeductionCategory[] = [
  'suspeito', 'local', 'arma', 'motivo', 'horario',
];

export const HINT_VALUES: Record<string, Record<string, string[]>> = {
  suspeito: {
    'Dra. Cunha': ['puzzle_hint_3', 'puzzle_hint_8', 'puzzle_hint_15'],
    'Zeca do Gasthof': ['puzzle_hint_1', 'puzzle_hint_6', 'puzzle_hint_16'],
    'Seu Jonas': ['puzzle_hint_4', 'puzzle_hint_11', 'puzzle_hint_14'],
    'Diretora Elvira': ['puzzle_hint_5', 'puzzle_hint_10', 'puzzle_hint_17'],
    'Kommissar Mendes': ['puzzle_hint_2', 'puzzle_hint_7', 'puzzle_hint_9', 'puzzle_hint_12', 'puzzle_hint_13', 'puzzle_hint_18'],
  },
  local: {
    'Gasthof Vila Nova': ['puzzle_hint_1', 'puzzle_hint_4'],
    'Volkspolizeistation 8': ['puzzle_hint_5', 'puzzle_hint_8'],
    'Volksschule Vila Nova': ['puzzle_hint_11', 'puzzle_hint_14'],
    'Beco da Rua Sieben': ['puzzle_hint_3', 'puzzle_hint_10'],
    'Lagerhaus 7': ['puzzle_hint_2', 'puzzle_hint_6'],
  },
  arma: {
    'Chave Inglesa': ['puzzle_hint_3', 'puzzle_hint_9'],
    'Arame de Piano': ['puzzle_hint_6', 'puzzle_hint_12'],
    'Faca de Cozinha': ['puzzle_hint_4', 'puzzle_hint_14'],
    'Revolver .38': ['puzzle_hint_5', 'puzzle_hint_15'],
    'Veneno Injetável': ['puzzle_hint_7', 'puzzle_hint_16'],
  },
  motivo: {
    'Extorsão': ['puzzle_hint_8', 'puzzle_hint_17'],
    'Tráfico de Crianças': ['puzzle_hint_9', 'puzzle_hint_18'],
    'Vingança Pessoal': ['puzzle_hint_14'],
    'Dívida de Jogo': ['puzzle_hint_10'],
    'Cobertura de Crime': ['puzzle_hint_7', 'puzzle_hint_13'],
  },
  horario: {
    '04:00': ['puzzle_hint_8', 'puzzle_hint_15'],
    '02:30': ['puzzle_hint_6', 'puzzle_hint_12'],
    '01:00': ['puzzle_hint_4'],
    '23:30': ['puzzle_hint_5', 'puzzle_hint_10'],
    '22:00': ['puzzle_hint_2', 'puzzle_hint_7'],
  },
};

const PERMANENT_ITEMS = ['isqueiro', 'gravador_cassete'];

export class GameState {
  currentRoomId: string = 'escritorio';
  inventory: string[] = ['isqueiro', 'gravador_cassete'];
  visitedRooms: Set<string> = new Set(['escritorio']);
  interactedItems: Set<string> = new Set();
  unlockedObjects: Set<string> = new Set();
  readHints: Set<string> = new Set();
  readInterviewClues: Set<string> = new Set();
  discoveredContacts: Set<string> = new Set();
  calledContacts: Set<string> = new Set();
  pdCutoffContacts: Set<string> = new Set();
  pdChoiceHistory: Record<string, string[]> = {};
  phoneRecordings: Record<string, { speaker: string; lines: string[] }[]> = {};
  murphyCommentaryMap: Record<string, string[]> = {};
  gameCompleted: boolean = false;
  deductionOpen: boolean = false;
  deductionResult: 'correct' | 'wrong' | null = null;
  deductionAttempts: number = 0;
  deductionGrid: Record<string, Record<DeductionCategory, string>> = {};
  terminalLogs: string[] = [];
  localRooms: { [key: string]: Room } = {};

  private listeners: Map<string, (() => void)[]> = new Map();

  constructor() {
    this.localRooms = {};
    for (const [k, v] of Object.entries(GAME_ROOMS)) {
      this.localRooms[k] = JSON.parse(JSON.stringify(v));
    }
    for (const loc of DEDUCTION_LOCATIONS) {
      this.deductionGrid[loc] = { suspeito: '', local: '', arma: '', motivo: '', horario: '' };
    }
  }

  on(event: string, cb: () => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(cb);
  }

  off(event: string, cb: () => void) {
    const arr = this.listeners.get(event);
    if (arr) {
      const idx = arr.indexOf(cb);
      if (idx >= 0) arr.splice(idx, 1);
    }
  }

  emit(event: string) {
    const arr = this.listeners.get(event);
    if (arr) arr.forEach(cb => cb());
  }

  get currentRoom(): Room {
    return this.localRooms[this.currentRoomId];
  }

  travelTo(roomId: string) {
    if (!this.localRooms[roomId]) return;
    this.currentRoomId = roomId;
    this.visitedRooms.add(roomId);
    this.emit('roomChanged');
  }

  addItem(itemId: string) {
    if (!this.inventory.includes(itemId)) {
      this.inventory.push(itemId);
      this.emit('inventoryChanged');
    }
  }

  removeInteracted(objId: string) {
    this.interactedItems.add(objId);
    this.emit('interactablesChanged');
  }

  unlock(objId: string) {
    this.unlockedObjects.add(objId);
    this.emit('unlockedChanged');
  }

  handleInteract(obj: Interactable): ItemUseOutcome {
    const outcome = resolveItemUse({
      requiredItem: obj.requiredItem,
      selection: INTERACT,
      isUnlocked: this.unlockedObjects.has(obj.id),
    });

    if (outcome === 'denied') return outcome;

    this.executeAction(obj, outcome);
    return outcome;
  }

  handleItemUse(obj: Interactable, itemId: string): ItemUseOutcome {
    const outcome = resolveItemUse({
      requiredItem: obj.requiredItem,
      selection: itemId,
      isUnlocked: this.unlockedObjects.has(obj.id),
    });

    if (outcome === 'unlock') {
      this.unlock(obj.id);
    }

    this.executeAction(obj, outcome);
    return outcome;
  }

  private executeAction(obj: Interactable, outcome: ItemUseOutcome) {
    if (outcome === 'denied') return;

    if (obj.type === 'pickup' && outcome !== 'not-applicable') {
      if (obj.pickupItem) this.addItem(obj.pickupItem);
      if (obj.hideAfterInteract) this.removeInteracted(obj.id);
      if (obj.pickupItem === 'cartao_visita') {
        this.discoveredContacts.add('diretora_elvira');
        this.emit('contactsChanged');
      }
    }

    if (obj.type === 'travel' && outcome !== 'not-applicable') {
      if (obj.targetRoom) this.travelTo(obj.targetRoom);
    }

    if (obj.type === 'terminal_read' && outcome !== 'not-applicable') {
      if (obj.id.startsWith('puzzle_hint_')) this.readHints.add(obj.id);
      if (obj.id.startsWith('interview_clue_')) this.readInterviewClues.add(obj.id);
      this.emit('terminalRead');
    }

    if (obj.type === 'phone_call' && outcome !== 'not-applicable') {
      if (obj.phoneCallId) {
        this.discoveredContacts.add(obj.phoneCallId);
        this.emit('contactsChanged');
      }
    }

    if (obj.type === 'inspect' && obj.hideAfterInteract && outcome !== 'not-applicable') {
      this.removeInteracted(obj.id);
    }
  }

  isPermanentItem(itemId: string): boolean {
    return PERMANENT_ITEMS.includes(itemId);
  }

  getVisibleInteractables(): Interactable[] {
    const room = this.currentRoom;
    if (!room) return [];
    return room.interactables.filter(obj => !this.interactedItems.has(obj.id));
  }

  canCallPhone(): boolean {
    return this.currentRoomId === 'escritorio';
  }

  canSendLetter(contactId: string): boolean {
    return contactId === 'seu_jonas';
  }

  addTerminalLog(message: string, color: string = '#33ff33') {
    this.terminalLogs.push(`[color=${color}]${message}[/color]`);
    this.emit('terminalLog');
  }

  checkDeduction(): 'correct' | 'wrong' | 'incomplete' {
    for (const loc of DEDUCTION_LOCATIONS) {
      for (const cat of DEDUCTION_CATEGORIES) {
        if (!this.deductionGrid[loc]?.[cat]) return 'incomplete';
      }
    }

    for (const loc of DEDUCTION_LOCATIONS) {
      for (const cat of DEDUCTION_CATEGORIES) {
        if (this.deductionGrid[loc][cat] !== DEDUCTION_SOLUTION[loc][cat]) {
          this.deductionResult = 'wrong';
          this.deductionAttempts++;
          this.emit('deductionChecked');
          return 'wrong';
        }
      }
    }

    this.deductionResult = 'correct';
    this.gameCompleted = true;
    this.emit('deductionChecked');
    return 'correct';
  }

  calculateGameCompletion(): number {
    const totalHints = 18;
    const totalContacts = 5;
    const hintsFound = this.readHints.size / totalHints;
    const interviewsCompleted = [...this.calledContacts].filter(
      c => c !== 'agente_scp' && !this.pdCutoffContacts.has(c)
    ).length / totalContacts;
    const cluesRead = this.readInterviewClues.size / totalContacts;
    const deductionScore = this.deductionResult === 'correct'
      ? Math.max(0.5, 1 - 0.1 * Math.max(0, this.deductionAttempts - 1))
      : 0;
    const tftCompliance = this.calculateTFTCompliance();
    return hintsFound * 0.20 + interviewsCompleted * 0.25 + cluesRead * 0.15 + deductionScore * 0.25 + tftCompliance * 0.15;
  }

  private calculateTFTCompliance(): number {
    const contacts = Object.keys(this.pdChoiceHistory);
    if (contacts.length === 0) return 0;
    let tftScore = 0;
    for (const contactId of contacts) {
      const history = this.pdChoiceHistory[contactId];
      const contact = PHONE_CONTACTS[contactId];
      if (!contact) continue;
      const nodes = Object.keys(contact.dialogue);
      let contactNpcChoices: string[] = [];
      for (const nodeId of nodes) {
        const node = contact.dialogue[nodeId];
        for (const choice of node.choices) {
          if (choice.pdAction) contactNpcChoices.push(choice.pdAction);
        }
      }
      let tftCorrect = 0;
      for (let i = 0; i < history.length; i++) {
        const playerChoice = history[i];
        const npcChoice = i < contactNpcChoices.length ? contactNpcChoices[i] : 'C';
        if (i === 0) {
          if (playerChoice === 'C') tftCorrect++;
        } else {
          const prevNpc = i - 1 < contactNpcChoices.length ? contactNpcChoices[i - 1] : 'C';
          if (playerChoice === prevNpc) tftCorrect++;
        }
      }
      tftScore += history.length > 0 ? tftCorrect / history.length : 0;
    }
    return tftScore / contacts.length;
  }
}

export const gameState = new GameState();
