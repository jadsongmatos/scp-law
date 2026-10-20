import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import { gameMachine, initialContext } from './gameMachine';
import { EMPTY_MURAL, type Clue, type MuralData } from '../components/board/data';

const pistaSalva: Clue = { id: 'x', type: 'note', title: 'T', subtitle: '', content: '', x: 1, y: 2, width: 10, height: 10, rotation: 0, color: 'yellow', tags: [], createdAt: new Date().toISOString() };

describe('gameMachine — RESTORE_STATE', () => {
  it('aplica o mural presente no save', () => {
    const actor = createActor(gameMachine);
    actor.start();
    const mural: MuralData = { clues: [pistaSalva], connections: [] };
    actor.send({ type: 'RESTORE_STATE', state: { ...initialContext, mural } });
    expect(actor.getSnapshot().context.mural.clues).toHaveLength(1);
    expect(actor.getSnapshot().context.mural.clues[0].id).toBe('x');
  });

  it('mantém EMPTY_MURAL quando o save antigo não tem mural', () => {
    const actor = createActor(gameMachine);
    actor.start();
    const { mural, ...saveAntigo } = initialContext;
    expect(mural).toBe(EMPTY_MURAL);
    actor.send({ type: 'RESTORE_STATE', state: { ...saveAntigo } });
    expect(actor.getSnapshot().context.mural).toBe(EMPTY_MURAL);
  });

  it('UPDATE_MURAL substitui o mural do contexto', () => {
    const actor = createActor(gameMachine);
    actor.start();
    const mural: MuralData = { clues: [pistaSalva], connections: [] };
    actor.send({ type: 'UPDATE_MURAL', mural });
    expect(actor.getSnapshot().context.mural).toBe(mural);
  });
});
