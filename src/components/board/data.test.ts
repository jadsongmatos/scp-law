import { describe, expect, it } from 'vitest';
import {
  BOARD_HEIGHT, BOARD_WIDTH,
  addConnection, clueFromHint, newId, typeLabels,
  type Clue, type HintSource, type MuralData,
} from './data';

const clue = (id: string, overrides: Partial<Clue> = {}): Clue => ({
  id, type: 'note', title: id, subtitle: '', content: '', x: 100, y: 100,
  width: 237, height: 246, rotation: 0, tags: [], createdAt: '2026-10-18T12:00:00.000Z', ...overrides,
});

const mural = (clues: Clue[]): MuralData => ({ clues, connections: [] });

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


describe('typeLabels', () => {
  it('cobre todos os tipos em PT-BR', () => {
    expect(Object.keys(typeLabels)).toEqual(['person', 'location', 'note', 'document', 'recording', 'checklist']);
    expect(typeLabels.note).toBe('Anotação');
  });
});

describe('clueFromHint', () => {
  it('usa o id da pista como id do cartão (sincronização idempotente)', () => {
    const clue = clueFromHint({ id: 'interview_clue_santos', label: 'Pista de Santos — Entrevista', roomName: 'Volkspolizeistation 8º — A Estação que Não Vê', lines: [], index: 0 });
    expect(clue.id).toBe('interview_clue_santos');
  });

  it('filtra linhas decorativas do documento, mantendo o texto do depoimento', () => {
    const clue = clueFromHint({
      id: 'interview_clue_santos', label: 'Pista de Santos — Entrevista', roomName: 'Volkspolizeistation 8º — A Estação que Não Vê', index: 0,
      lines: ['═══', ' INFORMAÇÃO CONFIDENCIAL — POLIZIST SANTOS', '', 'REGISTO DA ENTREVISTA:', 'Relatório interno — conexão com o crime', '', '[Restrição: interview_gate=santos]', '[Tipo de restrição: exact]'],
    });
    expect(clue.content).toContain('Relatório interno — conexão com o crime');
    expect(clue.content).not.toContain('═');
    expect(clue.content).not.toContain('[');
  });

  it('subtítulo é a sala sem o complemento pós travessão', () => {
    const clue = clueFromHint({ id: 'interview_clue_zeca', label: 'Pista de Gasthof — Entrevista', roomName: 'Gasthof Vila Nova — Cerveja e Segredos', lines: [], index: 2 });
    expect(clue.subtitle).toBe('Gasthof Vila Nova');
  });

  it('posição é determinística: mesmo índice, mesmo lugar no quadro', () => {
    const source: HintSource = { id: 'interview_clue_dra_cunha', label: 'Pista de Cunha — Entrevista', roomName: 'Diretoria — Cartões e Borrões', lines: [], index: 1 };
    expect(clueFromHint(source)).toEqual(clueFromHint(source));
  });

  it('posição e rotação ficam dentro do quadro', () => {
    for (let index = 0; index < 5; index++) {
      const clue = clueFromHint({ id: `interview_clue_${index}`, label: `Depoimento ${index + 1}`, roomName: 'X', lines: [], index });
      expect(clue.x).toBeGreaterThanOrEqual(30);
      expect(clue.x).toBeLessThanOrEqual(BOARD_WIDTH - clue.width - 30);
      expect(clue.y).toBeGreaterThanOrEqual(30);
      expect(clue.y).toBeLessThanOrEqual(BOARD_HEIGHT - clue.height - 30);
      expect(Math.abs(clue.rotation)).toBeLessThanOrEqual(3);
    }
  });
});
