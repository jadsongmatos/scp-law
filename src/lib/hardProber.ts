export const C = 'C' as const;
export const D = 'D' as const;
export type Action = typeof C | typeof D;

export class HardProber {
  history: Action[] = [];
  opponentHistory: Action[] = [];

  strategy(turn: number): Action {
    if (turn === 0) return D;
    if (turn === 1) return D;
    if (turn === 2) return C;
    if (turn === 3) return C;

    if (this.opponentHistory[1] === C && this.opponentHistory[2] === C) {
      return D;
    }
    return this.opponentHistory[this.opponentHistory.length - 1] === D ? D : C;
  }

  play(opponentMove: Action): Action {
    const turn = this.history.length;
    const move = this.strategy(turn);
    this.history.push(move);
    this.opponentHistory.push(opponentMove);
    return move;
  }
}
