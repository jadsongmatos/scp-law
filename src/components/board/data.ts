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

/** Entrada do catálogo de pistas dedutivas do jogo (game_data.json). */
export interface HintSource {
  id: string;
  label: string;
  /** Nome da sala, usado como subtítulo do cartão. */
  roomName: string;
  /** Linhas do documento exibido no terminal (documentData.content). */
  lines: string[];
  /** Posição estável no catálogo (índice); define o lugar do cartão no quadro. */
  index: number;
}

/**
 * Converte um depoimento descoberto (interview_clue_*) em cartão do mural.
 * O id do cartão É o id da pista: sincronizar depoimentos ↔ mural é
 * idempotente (seguro sob StrictMode / re-render).
 * Posição determinística via mulberry32(index+1) — nunca Math.random.
 */
export function clueFromHint(hint: HintSource): Clue {
  const [width, height] = CLUE_SIZES.note;
  const rng = mulberry32(hint.index + 1);
  const x = 30 + rng() * (BOARD_WIDTH - width - 60);
  const y = 30 + rng() * (BOARD_HEIGHT - height - 60);
  // Cabeçalhos decorativos do terminal (═══, linhas vazias, marcações '>' e '[...]')
  // não dizem nada ao jogador no mural; fica só o texto do fragmento.
  const content = hint.lines
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('═') && !line.startsWith('>') && !line.startsWith('['))
    .join('\n');
  const createdAt = new Date(2026, 9, 20, 12, 0, hint.index).toISOString();
  return {
    id: hint.id,
    type: 'note',
    title: hint.label,
    subtitle: hint.roomName.split('—')[0].trim(),
    content,
    x: Math.round(x),
    y: Math.round(y),
    width,
    height,
    rotation: rng() * 6 - 3,
    color: 'yellow',
    tags: [],
    createdAt,
  };
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

export const EMPTY_MURAL: MuralData = { clues: [], connections: [] };

