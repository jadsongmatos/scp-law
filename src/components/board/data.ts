// MURAL DE PISTAS — tipos e operações puras.
// Portado do protótipo "Nexo" (interactive-detective-board-development/).
// Sem imports de React: este arquivo é coberto pelo vitest (node env) e
// compartilhado com a máquina de estados (gameMachine).
import { mulberry32 } from '@/lib/rng';

export type ClueType = 'person' | 'location' | 'note' | 'document' | 'recording' | 'checklist';
export type ToolMode = 'select' | 'hand' | 'connect';

export interface ChecklistItem { id: string; text: string; done: boolean }
export interface Clue {
  id: string;
  type: ClueType;
  title: string;
  subtitle: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  image?: string;
  imagePosition?: string;
  color?: string;
  badge?: string;
  fileName?: string;
  fileData?: string;
  tags: string[];
  items?: ChecklistItem[];
  createdAt: string;
}
export interface Connection { id: string; from: string; to: string; label: string; color: string }
export interface MuralData { clues: Clue[]; connections: Connection[] }

export const typeLabels: Record<ClueType, string> = {
  person: 'Pessoa', location: 'Local', note: 'Anotação', document: 'Documento', recording: 'Registro', checklist: 'Lista de tarefas',
};

export const BOARD_WIDTH = 1280;
export const BOARD_HEIGHT = 790;

// Fluxo dedicado (mesma semente da convenção do jogo), separado do rng42
// compartilhado com o áudio e as estratégias do dilema.
const rand = mulberry32(42);
let idCounter = 0;

// Date.now garante unicidade entre sessões (IDs não são decisão de jogo);
// o fluxo semeado substitui Math.random, conforme a convenção do repositório.
export function newId(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter.toString(36)}${rand().toString(36).slice(2, 6)}`;
}

const CLUE_SIZES: Record<ClueType, [number, number]> = {
  person: [224, 288], location: [282, 268], note: [237, 246], document: [276, 283], recording: [202, 145], checklist: [253, 277],
};


export function createClue(type: ClueType, point?: { x: number; y: number }): Clue {
  const [width, height] = CLUE_SIZES[type];
  const clue: Clue = {
    id: newId(),
    type,
    title: '',
    subtitle: '',
    content: '',
    x: 510 + rand() * 70,
    y: 230 + rand() * 70,
    width,
    height,
    rotation: rand() * 6 - 3,
    color: 'yellow',
    tags: [],
    createdAt: new Date().toISOString(),
    ...(type === 'checklist' ? { items: [] as ChecklistItem[] } : {}),
  };
  if (point) {
    clue.x = Math.min(Math.max(point.x - width / 2, 25), BOARD_WIDTH - width - 25);
    clue.y = Math.min(Math.max(point.y - height / 2, 30), BOARD_HEIGHT - height - 25);
  }
  return clue;
}

export interface AddConnectionResult {
  data: MuralData;
  connection: Connection;
  /** true quando o fio já existia (nas duas direções) e nada foi alterado. */
  existed: boolean;
}

/** Cria um fio entre duas pistas, deduplicando nas duas direções. Nunca muta `data`. */
export function addConnection(
  data: MuralData,
  from: string,
  to: string,
  color = '#a13d35',
): AddConnectionResult | null {
  if (from === to) return null;
  if (!data.clues.some(c => c.id === from) || !data.clues.some(c => c.id === to)) return null;
  const existing = data.connections.find(
    c => (c.from === from && c.to === to) || (c.from === to && c.to === from),
  );
  if (existing) return { data, connection: existing, existed: true };
  const connection: Connection = { id: newId(), from, to, label: 'Relacionado a', color };
  return { data: { ...data, connections: [...data.connections, connection] }, connection, existed: false };
}

// Anexos viram dataURL no save (localStorage ~5 MB, compartilhado com todo o
// progresso). LIMITes em caracteres de dataURL — ver data.test.ts.
export const MAX_FILE_BYTES = 1536 * 1024;
export const MAX_MURAL_BYTES = 2560 * 1024;

export function attachmentSize(clues: Clue[]): number {
  return clues.reduce((total, clue) => total + (clue.image?.length ?? 0) + (clue.fileData?.length ?? 0), 0);
}

export const EMPTY_MURAL: MuralData = { clues: [], connections: [] };
