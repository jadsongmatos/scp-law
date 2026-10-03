export const C = 'C' as const;
export const D = 'D' as const;
export type Move = typeof C | typeof D;

import { rng42 } from './rng';

// Faithful port of Axelrod's SneakyTitForTat
// (axelrod/strategies/titfortat.py): cooperates first, sneaks a defection
// against a never-defecting opponent, repents if punished, else plays TFT.
export class SneakyTitForTat {
  history: Move[] = [];
  opponentHistory: Move[] = [];

  strategy(): Move {
    const me = this.history;
    const opp = this.opponentHistory;

    if (me.length < 2) return C;
    if (!opp.includes(D)) return D;
    if (opp[opp.length - 1] === D && me[me.length - 2] === D) return C;
    return opp[opp.length - 1];
  }

  play(opponentMove: Move): Move {
    const move = this.strategy();
    this.history.push(move);
    this.opponentHistory.push(opponentMove);
    return move;
  }
}

// Faithful port of Axelrod's Grudger (axelrod/strategies/grudger.py):
// cooperates until the opponent defects once, then defects forever.
export class Grudger {
  history: Move[] = [];
  opponentHistory: Move[] = [];
  private triggered = false;

  strategy(): Move {
    if (this.opponentHistory.includes(D)) this.triggered = true;
    return this.triggered ? D : C;
  }

  play(opponentMove: Move): Move {
    const move = this.strategy();
    this.history.push(move);
    this.opponentHistory.push(opponentMove);
    return move;
  }
}

// Faithful port of Axelrod's Prober4 (axelrod/strategies/prober.py): runs a
// 20-round probe sequence counting retaliatory (justDs) vs provocative
// (unjustDs) defections. If |justDs - unjustDs| <= 2 → D forever.
// Otherwise → 5 rounds of C, then TFT.
export class Prober4 {
  history: Move[] = [];
  opponentHistory: Move[] = [];

  private static readonly INIT_SEQUENCE: Move[] = [
    C, C, D, C, D, D, D, C, C, D,
    C, D, C, C, D, C, D, D, C, D,
  ];

  private justDs = 0;
  private unjustDs = 0;
  private turnedDefector = false;
  private decisionMade = false;

  strategy(): Move {
    const turn = this.history.length;

    if (turn < Prober4.INIT_SEQUENCE.length) {
      if (turn > 0 && this.opponentHistory[turn - 1] === D) {
        if (this.history[turn - 1] === D) this.justDs++;
        if (this.history[turn - 1] === C) this.unjustDs++;
      }
      return Prober4.INIT_SEQUENCE[turn];
    }

    if (turn === Prober4.INIT_SEQUENCE.length && !this.decisionMade) {
      this.turnedDefector = Math.abs(this.justDs - this.unjustDs) <= 2;
      this.decisionMade = true;
    }

    if (this.turnedDefector) return D;
    if (turn < Prober4.INIT_SEQUENCE.length + 5) return C;
    return this.opponentHistory[this.opponentHistory.length - 1];
  }

  play(opponentMove: Move): Move {
    const move = this.strategy();
    this.history.push(move);
    this.opponentHistory.push(opponentMove);
    return move;
  }
}

// Faithful port of Axelrod's Detective (axelrod/strategies/prober.py): plays
// a fixed initial sequence (default: C, D, C, C). If opponent defected at
// least once during it → TFT forever. Otherwise → D forever.
export class Detective {
  history: Move[] = [];
  opponentHistory: Move[] = [];

  private initialActions: Move[];

  constructor(initialActions: Move[] = [C, D, C, C]) {
    this.initialActions = initialActions;
  }

  strategy(): Move {
    const turn = this.history.length;
    if (turn < this.initialActions.length) {
      return this.initialActions[turn];
    }
    if (!this.opponentHistory.slice(0, this.initialActions.length).includes(D)) {
      return D;
    }
    return this.opponentHistory[this.opponentHistory.length - 1];
  }

  play(opponentMove: Move): Move {
    const move = this.strategy();
    this.history.push(move);
    this.opponentHistory.push(opponentMove);
    return move;
  }
}

// Faithful port of Axelrod's Random (axelrod/strategies/rand.py): cooperates
// with probability p, defects with probability 1-p. Memory-less (ignores
// history). p=0 → always D, p=1 → always C.
export class RandomStrategy {
  history: Move[] = [];
  opponentHistory: Move[] = [];

  private p: number;
  private rng: () => number;

  constructor(p = 0.5, rng: () => number = rng42) {
    this.p = p;
    this.rng = rng;
  }

  strategy(): Move {
    return randomChoice(this.p, this.rng);
  }

  play(opponentMove: Move): Move {
    const move = this.strategy();
    this.history.push(move);
    this.opponentHistory.push(opponentMove);
    return move;
  }
}

// Helper opponent: classic Tit For Tat (for match simulation).
export function titForTat(opponentHistory: Move[]): Move {
  return opponentHistory.length === 0 ? C : opponentHistory[opponentHistory.length - 1];
}

// ---------------------------------------------------------------------------
// Zero-Determinant / Linear Relation players (axelrod/strategies/zero_determinant.py)
// ---------------------------------------------------------------------------

export type Game = { R: number; P: number; S: number; T: number };

// Matriz padrão do Dilema do Prisioneiro (axl.Game().RPST() => R,P,S,T)
export const DEFAULT_GAME: Game = { R: 3, P: 1, S: 0, T: 5 };

// Retorna C com probabilidade p (determinístico se rng for injetado).
export function randomChoice(p: number, rng: () => number = rng42): Move {
  return rng() < p ? C : D;
}

// Base Linear Relation: o four-vector é calculado a partir de (phi, s, l).
// Ordem do four-vector: CC, CD, DC, DD (move do player vem primeiro).
export class LRPlayer {
  phi: number;
  s: number;
  l: number | null;
  history: Move[] = [];
  opponentHistory: Move[] = [];
  fourVector: Record<string, number> | null = null;
  firstRoundPlay: Move = C;
  private rng: () => number;

  constructor(
    phi: number,
    s: number,
    l: number | null,
    rng: () => number = rng42,
  ) {
    this.phi = phi;
    this.s = s;
    this.l = l;
    this.rng = rng;
  }

  private static fvKey(me: Move, opp: Move): string {
    return `${me}${opp}`;
  }

  receiveMatchAttributes(game: Game = DEFAULT_GAME): void {
    const { R, P, S, T } = game;
    const l = this.l as number;
    const { phi, s } = this;

    // Limites enforceable (Equation 14, Hilbe2013).
    const sMin = -Math.min((T - l) / (l - S), (l - S) / (T - l));
    if (l < P || l > R || s > 1 || s < sMin) {
      throw new Error('Parâmetros (l,s) não enforceable para este jogo.');
    }

    const p1 = 1 - phi * (1 - s) * (R - l);
    const p2 = 1 - phi * (s * (l - S) + (T - l));
    const p3 = phi * ((l - S) + s * (T - l));
    const p4 = phi * (1 - s) * (l - P);

    this.fourVector = {
      [LRPlayer.fvKey(C, C)]: p1,
      [LRPlayer.fvKey(C, D)]: p2,
      [LRPlayer.fvKey(D, C)]: p3,
      [LRPlayer.fvKey(D, D)]: p4,
    };
  }

  play(opponentMove: Move, game: Game = DEFAULT_GAME): Move {
    if (this.history.length === 0) {
      const move = this.firstRoundPlay;
      this.history.push(move);
      this.opponentHistory.push(opponentMove);
      return move;
    }
    if (this.fourVector === null) {
      const move = this.opponentHistory[this.opponentHistory.length - 1];
      this.history.push(move);
      this.opponentHistory.push(opponentMove);
      return move;
    }
    const key = LRPlayer.fvKey(
      this.history[this.history.length - 1],
      opponentMove,
    );
    const p = this.fourVector[key];
    const move = randomChoice(p, this.rng);
    this.history.push(move);
    this.opponentHistory.push(opponentMove);
    return move;
  }
}

// ZD-GTFT-2: Generous Zero Determinant com l = R.
export class ZDGTFT2 extends LRPlayer {
  constructor(phi = 0.25, s = 0.5, rng: () => number = rng42) {
    super(phi, s, null, rng);
  }

  receiveMatchAttributes(game: Game = DEFAULT_GAME): void {
    this.l = game.R; // ZDGTFT-2 fixa l = R
    super.receiveMatchAttributes(game);
  }
}

// Oponentes auxiliares para simulação de partidas.
export function alwaysCooperate(): Move {
  return C;
}
export function alwaysDefect(): Move {
  return D;
}
