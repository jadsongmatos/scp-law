import { describe, it, expect } from 'vitest';
import {
  ZDGTFT2,
  LRPlayer,
  DEFAULT_GAME,
  C,
  D,
  type Move,
} from './axelrod';

// PRNG seedável (mulberry32) para testes estocásticos determinísticos.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simula uma partida entre uma estratégia ZD e um oponente fixo.
function playMatch(
  player: ZDGTFT2,
  opponent: () => Move,
  rounds: number,
): Move[] {
  const seq: Move[] = [];
  for (let i = 0; i < rounds; i++) {
    const oppMove = opponent();
    seq.push(player.play(oppMove));
  }
  return seq;
}

describe('ZDGTFT2', () => {
  describe('four-vector (matemática determinística)', () => {
    it('calcula o four-vector padrão [1, 0.125, 1, 0.25] para o jogo padrão', () => {
      const p = new ZDGTFT2();
      p.receiveMatchAttributes(DEFAULT_GAME);

      const fv = p.fourVector!;
      expect(fv['CC']).toBeCloseTo(1, 10);
      expect(fv['CD']).toBeCloseTo(0.125, 10);
      expect(fv['DC']).toBeCloseTo(1, 10);
      expect(fv['DD']).toBeCloseTo(0.25, 10);
    });

    it('fixa l = R ao receber atributos da partida', () => {
      const p = new ZDGTFT2();
      expect(p.l).toBeNull();
      p.receiveMatchAttributes(DEFAULT_GAME);
      expect(p.l).toBe(DEFAULT_GAME.R);
    });

    it('recalcula corretamente para um jogo customizado (R=4, P=1, S=0, T=6)', () => {
      const game = { R: 4, P: 1, S: 0, T: 6 };
      const p = new ZDGTFT2(undefined, undefined, mulberry32(1));
      // phi=0.25, s=0.5, l=R=4
      const expected = {
        CC: 1 - 0.25 * 0.5 * (4 - 4), // = 1
        CD: 1 - 0.25 * (0.5 * (4 - 0) + (6 - 4)), // 1 - 0.25*4 = 0
        DC: 0.25 * ((4 - 0) + 0.5 * (6 - 4)), // 0.25*5 = 1.25 -> clamped? no, valid
        DD: 0.25 * 0.5 * (4 - 1), // 0.375
      };
      p.receiveMatchAttributes(game);
      const fv = p.fourVector!;
      expect(fv['CC']).toBeCloseTo(expected.CC, 10);
      expect(fv['CD']).toBeCloseTo(expected.CD, 10);
      expect(fv['DC']).toBeCloseTo(expected.DC, 10);
      expect(fv['DD']).toBeCloseTo(expected.DD, 10);
    });
  });

  describe('abertura', () => {
    it('coopera na primeira rodada', () => {
      const p = new ZDGTFT2();
      p.receiveMatchAttributes();
      expect(p.play(C)).toBe(C);
    });
  });

  describe('generosidade contra oponente cooperativo', () => {
    it('sempre coopera contra AllC (estado permanece CC, p=1)', () => {
      const p = new ZDGTFT2();
      p.receiveMatchAttributes();
      const seq = playMatch(p, () => C, 50);
      expect(seq).toEqual(new Array(50).fill(C));
    });
  });

  describe('comportamento dirigido pelo four-vector (rng injetado)', () => {
    it('rng=()=>0 força cooperação mesmo em CD e DD', () => {
      const p = new ZDGTFT2(undefined, undefined, () => 0);
      p.receiveMatchAttributes();
      // CD: p2=0.125 -> 0<0.125 => C
      expect(p.play(D)).toBe(C);
    });

    it('rng alto força traição em CD/DC/DD mas mantém C em CC', () => {
      const p = new ZDGTFT2(undefined, undefined, () => 0.9999);
      p.receiveMatchAttributes();
      // Estado CC (após abertura C): p1=1 => 0.9999<1 => C
      expect(p.play(C)).toBe(C);
      // Agora estado CD (meu último=C, oponente=D): p2=0.125 => 0.9999<0.125 false => D
      expect(p.play(D)).toBe(D);
    });

    it('aplica p4=0.25 quando o estado é DD', () => {
      const p = new ZDGTFT2(undefined, undefined, () => 0.9999);
      p.receiveMatchAttributes();
      p.history = [D, D];
      p.opponentHistory = [D, D];
      // estado DD: p4=0.25 => 0.9999<0.25 false => D
      expect(p.play(D)).toBe(D);
    });
  });

  describe('estocástica (taxa empírica com seed fixa)', () => {
    it('contra AllD a taxa de cooperação fica próxima do esperado (~0.2-0.35)', () => {
      const p = new ZDGTFT2(undefined, undefined, mulberry32(42));
      p.receiveMatchAttributes();
      const seq = playMatch(p, () => D, 20000);
      const coopRate = seq.filter((m) => m === C).length / seq.length;
      // p2=0.125 e p4=0.25 dominam; cadeia de Markov converge perto de ~0.28
      expect(coopRate).toBeGreaterThan(0.2);
      expect(coopRate).toBeLessThan(0.4);
    });
  });

  describe('validação de parâmetros', () => {
    it('LRPlayer levanta erro para (l,s) não enforceable', () => {
      const p = new LRPlayer(0.5, 2, 2); // s=2 > 1
      expect(() => p.receiveMatchAttributes(DEFAULT_GAME)).toThrow();
    });
  });
});
