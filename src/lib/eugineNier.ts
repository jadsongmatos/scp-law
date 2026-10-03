// EugineNier — reimplementation of axelrod.strategies.titfortat.EugineNier.
// PD actions are represented as strings: "C" (cooperate) / "D" (defect).
// Behavior (matches the Axelrod library source, NOT the docstring):
//   1. First move: Cooperate.
//   2. Tit-for-Tat: copy opponent's last move.
//   3. If the opponent has defected >= 5 times, permanently switch to Defect.

export type Action = "C" | "D";

export function createEugineNier() {
  let history: Action[] = [];
  let isDefector = false;

  return function strategy(opponentHistory: Action[]): Action {
    let move: Action;
    if (history.length === 0) {
      move = "C";
    } else if (isDefector) {
      move = "D";
    } else if (opponentHistory.filter((m) => m === "D").length >= 5) {
      isDefector = true;
      move = "D";
    } else {
      move = opponentHistory[opponentHistory.length - 1];
    }
    history.push(move);
    return move;
  };
}
