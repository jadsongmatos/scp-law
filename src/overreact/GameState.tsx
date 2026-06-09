import React, { useContext, createContext, ReactNode, useState, useEffect, useRef } from 'react';
import { useProperty, useKeyboard, Property } from '@overreact/engine';
import { GAME_ROOMS, Room, PHONE_CONTACTS } from '../data';

export type DeductionCategory = 'suspeito' | 'local_crime' | 'arma' | 'motivo' | 'horario';

export const DEDUCTION_LOCATIONS = ['Escritório Murphy', 'Rua Sieben', 'Gasthof Vila Nova', 'Volksschule', 'Volkspolizeistation 8º'] as const;

export const DEDUCTION_CATEGORIES = {
  suspeito: ['Kommissar Mendes', 'Diretora Elvira', 'Seu Jonas', 'Zeca do Gasthof', 'Dra. Cunha'],
  local_crime: ['Lagerhaus 7', 'Beco da Rua Sieben', 'Volksschule Vila Nova', 'Volkspolizeistation 8º', 'Gasthof Vila Nova'],
  arma: ['Revólver .38', 'Faca de Cozinha', 'Arame de Piano', 'Chave Inglesa', 'Veneno Injetável'],
  motivo: ['Dívida de Jogo', 'Vingança Pessoal', 'Tráfico de Crianças', 'Extorsão', 'Cobertura de Crime'],
  horario: ['22:00', '23:30', '01:00', '02:30', '04:00'],
} as const;

export const DEDUCTION_SOLUTION: Record<string, Record<DeductionCategory, string>> = {
  'Escritório Murphy': { suspeito: 'Dra. Cunha', local_crime: 'Gasthof Vila Nova', arma: 'Chave Inglesa', motivo: 'Extorsão', horario: '04:00' },
  'Rua Sieben': { suspeito: 'Zeca do Gasthof', local_crime: 'Volkspolizeistation 8º', arma: 'Arame de Piano', motivo: 'Tráfico de Crianças', horario: '02:30' },
  'Gasthof Vila Nova': { suspeito: 'Seu Jonas', local_crime: 'Volksschule Vila Nova', arma: 'Faca de Cozinha', motivo: 'Vingança Pessoal', horario: '01:00' },
  'Volksschule': { suspeito: 'Diretora Elvira', local_crime: 'Beco da Rua Sieben', arma: 'Revólver .38', motivo: 'Dívida de Jogo', horario: '23:30' },
  'Volkspolizeistation 8º': { suspeito: 'Kommissar Mendes', local_crime: 'Lagerhaus 7', arma: 'Veneno Injetável', motivo: 'Cobertura de Crime', horario: '22:00' },
};

export const PERMANENT_ITEMS = ['isqueiro', 'gravador_cassete'];

export const MAP_LAYOUT: Record<string, { x: number; y: number }> = {
  escritorio: { x: 30, y: 60 },
  rua_chuva: { x: 50, y: 60 },
  bar: { x: 20, y: 40 },
  escola: { x: 50, y: 35 },
  diretoria: { x: 70, y: 25 },
  delegacia: { x: 75, y: 50 },
  beco: { x: 35, y: 25 },
  armazem: { x: 55, y: 15 },
};

export const INTERACTABLE_SCP_CLASS: Record<string, string> = {
  inspect: 'safe',
  pickup: 'safe',
  travel: 'euclid',
  terminal_read: 'keter',
  phone_call: 'thaumiel',
};

const emptyDeductionGrid = () => {
  const grid: Record<string, Record<DeductionCategory, string>> = {};
  DEDUCTION_LOCATIONS.forEach(loc => {
    grid[loc] = { suspeito: '', local_crime: '', arma: '', motivo: '', horario: '' };
  });
  return grid;
};

export interface GameState {
  currentRoomId: Property<string>;
  inventory: Property<string[]>;
  visitedRooms: Property<string[]>;
  isMapOpen: Property<boolean>;
  isSettingsOpen: Property<boolean>;
  devMode: Property<boolean>;
  selectedObjId: Property<string | null>;
  localRooms: Property<{ [key: string]: Room }>;
  documentData: Property<{ title: string; content: string[] } | null>;
  interactedItems: Property<string[]>;
  unlockedObjects: Property<string[]>;
  objMenu: Property<{ x: number; y: number; obj: any } | null>;
  readHints: Property<string[]>;
  deductionOpen: Property<boolean>;
  deductionResult: Property<'correct' | 'wrong' | null>;
  discoveredContacts: Property<string[]>;
  calledContacts: Property<string[]>;
  pdCutoffContacts: Property<string[]>;
  pdChoiceHistory: Property<Record<string, string[]>>;
  phoneRecordings: Property<Record<string, { speaker: string; lines: string[] }[]>>;
  phoneAgendaOpen: Property<boolean>;
  activePhoneCall: Property<{
    contactId: string;
    nodeId: string;
    linesShown: number;
    visitedNodes: string[];
  } | null>;
  cassettePlayback: Property<{
    contactId: string;
    lines: { speaker: string; lines: string[] }[];
  } | null>;
  murphyCommentaryMap: Property<Record<string, string[]>>;
  gameCompleted: Property<boolean>;
  readInterviewClues: Property<string[]>;
  cassetteMenuOpen: Property<boolean>;
  mobileInventoryOpen: Property<boolean>;
  mobileTerminalOpen: Property<boolean>;
  deductionAttempts: Property<number>;
  deductionGrid: Property<Record<string, Record<DeductionCategory, string>>>;
  panX: Property<number>;
}

const GameContext = createContext<GameState | null>(null);

export function useGameState(): GameState {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGameState must be used within GameProvider');
  return ctx;
}

export function useReactiveGameState(): GameState {
  const s = useGameState();
  const [, bump] = useState(0);

  useEffect(() => {
    const unlistens: (() => void)[] = [];
    const forceUpdate = () => bump(v => v + 1);
    for (const key of Object.keys(s as unknown as Record<string, unknown>)) {
      const prop = (s as unknown as Record<string, unknown>)[key];
      if (prop && typeof prop === 'object' && 'listen' in (prop as object) && typeof (prop as Property<unknown>).listen === 'function') {
        unlistens.push((prop as Property<unknown>).listen(forceUpdate));
      }
    }
    return () => unlistens.forEach(fn => fn());
  }, [s]);

  return s;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const state: GameState = {
    currentRoomId: useProperty('escritorio'),
    inventory: useProperty(['isqueiro', 'gravador_cassete']),
    visitedRooms: useProperty(['escritorio']),
    isMapOpen: useProperty(false),
    isSettingsOpen: useProperty(false),
    devMode: useProperty(false),
    selectedObjId: useProperty<string | null>(null),
    localRooms: useProperty<{ [key: string]: Room }>(GAME_ROOMS),
    documentData: useProperty<{ title: string; content: string[] } | null>(null),
    interactedItems: useProperty<string[]>([]),
  unlockedObjects: useProperty<string[]>([]),
  objMenu: useProperty<{ x: number; y: number; obj: any } | null>(null),
  readHints: useProperty<string[]>([]),
  deductionOpen: useProperty(false),
  deductionResult: useProperty<'correct' | 'wrong' | null>(null),
  discoveredContacts: useProperty<string[]>([]),
  calledContacts: useProperty<string[]>([]),
  pdCutoffContacts: useProperty<string[]>([]),
    pdChoiceHistory: useProperty<Record<string, string[]>>({}),
    phoneRecordings: useProperty<Record<string, { speaker: string; lines: string[] }[]>>({}),
    phoneAgendaOpen: useProperty(false),
    activePhoneCall: useProperty<{
      contactId: string;
      nodeId: string;
      linesShown: number;
      visitedNodes: string[];
    } | null>(null),
    cassettePlayback: useProperty<{
      contactId: string;
      lines: { speaker: string; lines: string[] }[];
    } | null>(null),
    murphyCommentaryMap: useProperty<Record<string, string[]>>({}),
    gameCompleted: useProperty(false),
    readInterviewClues: useProperty<string[]>([]),
    cassetteMenuOpen: useProperty(false),
    mobileInventoryOpen: useProperty(false),
    mobileTerminalOpen: useProperty(false),
    deductionAttempts: useProperty(0),
    deductionGrid: useProperty(emptyDeductionGrid()),
    panX: useProperty(0),
  };

  return <GameContext.Provider value={state}>{children}</GameContext.Provider>;
}
