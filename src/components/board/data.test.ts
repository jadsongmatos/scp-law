import { describe, expect, it } from 'vitest';
import {
  BOARD_HEIGHT, BOARD_WIDTH, EMPTY_MURAL, MAX_MURAL_BYTES,
  addConnection, attachmentSize, createClue, newId, typeLabels,
  type Clue, type ClueType, type MuralData,
} from './data';

const clue = (id: string, overrides: Partial<Clue> = {}): Clue => ({
  id, type: 'note', title: id, subtitle: '', content: '', x: 100, y: 100,
  width: 237, height: 246, rotation: 0, tags: [], createdAt: '2026-10-18T12:00:00.000Z', ...overrides,
});

const mural = (clues: Clue[]): MuralData => ({ clues, connections: [] });

describe('createClue', () => {
  it('usa o tamanho fixo de cada tipo', () => {
    const types: ClueType[] = ['person', 'location', 'note', 'document', 'recording', 'checklist'];
    for (const type of types) {
      const c = createClue(type);
      expect(c.type).toBe(type);
      expect(c.width).toBeGreaterThan(0);
      expect(c.height).toBeGreaterThan(0);
    }
  });

  it('inicia com valores padrão coerentes', () => {
    const note = createClue('note');
    expect(note.title).toBe('');
    expect(note.color).toBe('yellow');
    expect(note.tags).toEqual([]);
    expect(note.items).toBeUndefined();
    expect(note.rotation).toBeGreaterThanOrEqual(-3);
    expect(note.rotation).toBeLessThanOrEqual(3);
    expect(new Date(note.createdAt).getTime()).not.toBeNaN();
    const list = createClue('checklist');
    expect(list.items).toEqual([]);
  });

  it('posiciona dentro do quadro quando recebe um ponto', () => {
    const c = createClue('person', { x: 0, y: 0 });
    expect(c.x).toBeGreaterThanOrEqual(25);
    expect(c.y).toBeGreaterThanOrEqual(30);
    expect(c.x + c.width).toBeLessThanOrEqual(BOARD_WIDTH - 25);
    expect(c.y + c.height).toBeLessThanOrEqual(BOARD_HEIGHT - 25);
  });

  it('centraliza a pista no ponto recebido', () => {
    const c = createClue('note', { x: 400, y: 300 });
    expect(c.x).toBe(400 - c.width / 2);
    expect(c.y).toBe(300 - c.height / 2);
  });
});

describe('newId', () => {
  it('gera ids únicos em rajada', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId()));
    expect(ids.size).toBe(200);
  });
});

describe('addConnection', () => {
  it('cria um fio com rótulo e cor padrão', () => {
    const data = mural([clue('a'), clue('b')]);
    const result = addConnection(data, 'a', 'b');
    expect(result).not.toBeNull();
    expect(result!.existed).toBe(false);
    expect(result!.connection.from).toBe('a');
    expect(result!.connection.to).toBe('b');
    expect(result!.connection.label).toBe('Relacionado a');
    expect(result!.connection.color).toBe('#a13d35');
    expect(result!.data.connections).toHaveLength(1);
    expect(data.connections).toHaveLength(0); // não muta o original
  });

  it('deduplica nas duas direções', () => {
    const data = mural([clue('a'), clue('b')]);
    const first = addConnection(data, 'a', 'b')!;
    const reverse = addConnection(first.data, 'b', 'a')!;
    expect(reverse.existed).toBe(true);
    expect(reverse.connection.id).toBe(first.connection.id);
    expect(reverse.data.connections).toHaveLength(1);
  });

  it('rejeita autoconexão e pistas inexistentes', () => {
    const data = mural([clue('a')]);
    expect(addConnection(data, 'a', 'a')).toBeNull();
    expect(addConnection(data, 'a', 'fantasma')).toBeNull();
    expect(addConnection(data, 'fantasma', 'a')).toBeNull();
  });
});

describe('attachmentSize', () => {
  it('soma image e fileData de todas as pistas', () => {
    const clues = [
      clue('a', { image: 'x'.repeat(100) }),
      clue('b', { fileData: 'y'.repeat(50) }),
      clue('c'),
    ];
    expect(attachmentSize(clues)).toBe(150);
    expect(attachmentSize(EMPTY_MURAL.clues)).toBe(0);
  });

  it('orçamento do mural cabe no save sem estourar a quota', () => {
    expect(MAX_MURAL_BYTES).toBeLessThan(4 * 1024 * 1024);
  });
});

describe('typeLabels', () => {
  it('cobre todos os tipos em PT-BR', () => {
    expect(Object.keys(typeLabels)).toEqual(['person', 'location', 'note', 'document', 'recording', 'checklist']);
    expect(typeLabels.note).toBe('Anotação');
  });
});
