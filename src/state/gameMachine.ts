import { createMachine, assign } from 'xstate';
import type { Room } from '../data';
import { GAME_ROOMS } from '../data';

export interface GameContext {
  currentRoomId: string;
  inventory: string[];
  visitedRooms: string[];
  discoveredContacts: string[];
  calledContacts: string[];
  pdCutoffContacts: string[];
  pdChoiceHistory: Record<string, string[]>;
  phoneRecordings: Record<string, { speaker: string; lines: string[] }[]>;
  readHints: string[];
  deductionGrid: Record<string, Record<string, string>>;
  deductionResult: 'correct' | 'wrong' | null;
  unlockedObjects: string[];
  interactedItems: string[];
  readInterviewClues: string[];
  deductionAttempts: number;
  murphyCommentaryMap: Record<string, string[]>;
  gameCompleted: boolean;
  diretoraPhoneUnlocked: boolean;
  localRooms: Record<string, Room>;
}

export type GameEvent =
  | { type: 'MOVE_ROOM'; target: string }
  | { type: 'PICKUP_ITEM'; itemKey: string; objId: string }
  | { type: 'DISCOVER_CONTACT'; contactId: string }
  | { type: 'CALL_CONTACT'; contactId: string }
  | { type: 'CUT_OFF_CONTACT'; contactId: string }
  | { type: 'RECORD_PD_ACTION'; contactId: string; action: string }
  | { type: 'START_PHONE_CALL'; contactId: string; nodeId?: string }
  | { type: 'END_PHONE_CALL'; contactId: string; recording: { speaker: string; lines: string[] }[] }
  | { type: 'READ_HINT'; hintId: string }
  | { type: 'READ_INTERVIEW_CLUE'; clueId: string }
  | { type: 'SET_DEDUCTION_RESULT'; result: 'correct' | 'wrong' | null }
  | { type: 'UPDATE_DEDUCTION_GRID'; location: string; category: string; value: string }
  | { type: 'UNLOCK_OBJECT'; objId: string }
  | { type: 'INTERACTED_WITH'; objId: string }
  | { type: 'UNLOCK_DIRETORA_PHONE' }
  | { type: 'SET_COMPLETED' }
  | { type: 'SET_MURPHY_COMMENTARY'; contactId: string; commentary: string[] }
  | { type: 'INCREMENT_DEDUCTION_ATTEMPTS' }
  | { type: 'RESTORE_STATE'; state: Partial<GameContext> }
  | { type: 'UPDATE_LOCAL_ROOMS'; updater: (prev: Record<string, Room>) => Record<string, Room> };

export const initialContext: GameContext = {
  currentRoomId: 'escritorio',
  inventory: ['isqueiro', 'gravador_cassete'],
  visitedRooms: ['escritorio'],
  discoveredContacts: [],
  calledContacts: [],
  pdCutoffContacts: [],
  pdChoiceHistory: {},
  phoneRecordings: {},
  readHints: [],
  deductionGrid: {},
  deductionResult: null,
  unlockedObjects: [],
  interactedItems: [],
  readInterviewClues: [],
  deductionAttempts: 0,
  murphyCommentaryMap: {},
  gameCompleted: false,
  diretoraPhoneUnlocked: false,
  localRooms: { ...GAME_ROOMS },
};

export const gameMachine = createMachine({
  id: 'detetive',
  initial: 'exploring',
  context: initialContext,
  types: {} as { context: GameContext; events: GameEvent },
  states: {
    exploring: {
      on: {
        MOVE_ROOM: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'MOVE_ROOM') return {};
            const visitedRooms = context.visitedRooms.includes(event.target)
              ? context.visitedRooms
              : [...context.visitedRooms, event.target];
            return { currentRoomId: event.target, visitedRooms };
          }),
        },
        PICKUP_ITEM: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'PICKUP_ITEM') return {};
            if (context.inventory.includes(event.itemKey)) return {};
            const interacted = event.objId && context.interactedItems.includes(event.objId)
              ? context.interactedItems
              : [...context.interactedItems, event.objId];
            return { inventory: [...context.inventory, event.itemKey], interactedItems: interacted };
          }),
        },
        DISCOVER_CONTACT: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'DISCOVER_CONTACT') return {};
            if (context.discoveredContacts.includes(event.contactId)) return {};
            return { discoveredContacts: [...context.discoveredContacts, event.contactId] };
          }),
        },
        CALL_CONTACT: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'CALL_CONTACT') return {};
            if (context.calledContacts.includes(event.contactId)) return {};
            return { calledContacts: [...context.calledContacts, event.contactId] };
          }),
        },
        CUT_OFF_CONTACT: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'CUT_OFF_CONTACT') return {};
            if (context.pdCutoffContacts.includes(event.contactId)) return {};
            return { pdCutoffContacts: [...context.pdCutoffContacts, event.contactId] };
          }),
        },
        RECORD_PD_ACTION: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'RECORD_PD_ACTION') return {};
            const history = context.pdChoiceHistory[event.contactId] || [];
            return { pdChoiceHistory: { ...context.pdChoiceHistory, [event.contactId]: [...history, event.action] } };
          }),
        },
        READ_HINT: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'READ_HINT') return {};
            if (context.readHints.includes(event.hintId)) return {};
            return { readHints: [...context.readHints, event.hintId] };
          }),
        },
        READ_INTERVIEW_CLUE: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'READ_INTERVIEW_CLUE') return {};
            if (context.readInterviewClues.includes(event.clueId)) return {};
            return { readInterviewClues: [...context.readInterviewClues, event.clueId] };
          }),
        },
        UPDATE_DEDUCTION_GRID: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'UPDATE_DEDUCTION_GRID') return {};
            const grid = { ...context.deductionGrid };
            grid[event.location] = { ...grid[event.location], [event.category]: event.value };
            return { deductionGrid: grid };
          }),
        },
        SET_DEDUCTION_RESULT: {
          actions: assign(({ event }) => {
            if (event.type !== 'SET_DEDUCTION_RESULT') return {};
            return { deductionResult: event.result };
          }),
        },
        UNLOCK_OBJECT: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'UNLOCK_OBJECT') return {};
            if (context.unlockedObjects.includes(event.objId)) return {};
            return { unlockedObjects: [...context.unlockedObjects, event.objId] };
          }),
        },
        INTERACTED_WITH: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'INTERACTED_WITH') return {};
            if (context.interactedItems.includes(event.objId)) return {};
            return { interactedItems: [...context.interactedItems, event.objId] };
          }),
        },
        UNLOCK_DIRETORA_PHONE: {
          actions: assign({ diretoraPhoneUnlocked: true }),
        },
        SET_COMPLETED: {
          actions: assign({ gameCompleted: true }),
        },
        INCREMENT_DEDUCTION_ATTEMPTS: {
          actions: assign(({ context }) => ({ deductionAttempts: context.deductionAttempts + 1 })),
        },
        SET_MURPHY_COMMENTARY: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'SET_MURPHY_COMMENTARY') return {};
            return { murphyCommentaryMap: { ...context.murphyCommentaryMap, [event.contactId]: event.commentary } };
          }),
        },
        RESTORE_STATE: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'RESTORE_STATE') return {};
            return { ...context, ...event.state };
          }),
        },
        UPDATE_LOCAL_ROOMS: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'UPDATE_LOCAL_ROOMS') return {};
            return { localRooms: event.updater(context.localRooms) };
          }),
        },
        START_PHONE_CALL: { target: 'in_dialogue' },
      },
    },
    in_dialogue: {
      on: {
        END_PHONE_CALL: {
          target: 'exploring',
          actions: assign(({ context, event }) => {
            if (event.type !== 'END_PHONE_CALL') return {};
            const recordings = { ...context.phoneRecordings, [event.contactId]: event.recording };
            const called = context.calledContacts.includes(event.contactId)
              ? context.calledContacts
              : [...context.calledContacts, event.contactId];
            return { phoneRecordings: recordings, calledContacts: called };
          }),
        },
        RECORD_PD_ACTION: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'RECORD_PD_ACTION') return {};
            const history = context.pdChoiceHistory[event.contactId] || [];
            return { pdChoiceHistory: { ...context.pdChoiceHistory, [event.contactId]: [...history, event.action] } };
          }),
        },
        CUT_OFF_CONTACT: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'CUT_OFF_CONTACT') return {};
            if (context.pdCutoffContacts.includes(event.contactId)) return {};
            return { pdCutoffContacts: [...context.pdCutoffContacts, event.contactId] };
          }),
        },
        SET_MURPHY_COMMENTARY: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'SET_MURPHY_COMMENTARY') return {};
            return { murphyCommentaryMap: { ...context.murphyCommentaryMap, [event.contactId]: event.commentary } };
          }),
        },
        UNLOCK_DIRETORA_PHONE: {
          actions: assign({ diretoraPhoneUnlocked: true }),
        },
        RESTORE_STATE: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'RESTORE_STATE') return {};
            return { ...context, ...event.state };
          }),
        },
        UPDATE_LOCAL_ROOMS: {
          actions: assign(({ context, event }) => {
            if (event.type !== 'UPDATE_LOCAL_ROOMS') return {};
            return { localRooms: event.updater(context.localRooms) };
          }),
        },
      },
    },
  },
});
