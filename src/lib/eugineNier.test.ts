import { describe, it, expect } from "vitest";
import { createEugineNier, type Action } from "./eugineNier";

// Helper: feed a full opponent sequence and collect every move.
// The player's move on round i+1 sees only the opponent's moves so far
// (opponentHistory.slice(0, i)) — simulating simultaneous play, matching how
// Axelrod calls strategy(opponent) where opponent.history excludes the
// current round.
function play(opponentHistory: Action[]) {
  const player = createEugineNier();
  return opponentHistory.map((_, i) => player(opponentHistory.slice(0, i)));
}

describe("createEugineNier", () => {
  it("cooperates on the first move", () => {
    const player = createEugineNier();
    expect(player([])).toBe("C");
  });

  it("plays Tit-for-Tat before the opponent reaches 5 defections", () => {
    // Opponent defects only 4 times, then cooperates.
    const moves = play(["D", "C", "D", "C", "D", "D", "C", "C"]);
    expect(moves).toEqual(["C", "D", "C", "D", "C", "D", "D", "C"]);
  });

  it("mirrors a fully cooperating opponent", () => {
    const moves = play(["C", "C", "C", "C", "C", "C", "C"]);
    expect(moves).toEqual(["C", "C", "C", "C", "C", "C", "C"]);
  });

  it("switches to permanent Defect once opponent has defected 5 times", () => {
    // 5th defection happens on opponent index 4; from move 5 onward always D.
    const moves = play(["D", "D", "D", "D", "D", "C", "C", "C"]);
    expect(moves).toEqual(["C", "D", "D", "D", "D", "D", "D", "D"]);
  });

  it("stays a defector forever even if the opponent later cooperates", () => {
    const moves = play(["C", "C", "D", "D", "D", "D", "D", "C", "C", "C"]);
    expect(moves).toEqual(["C", "C", "C", "D", "D", "D", "D", "D", "D", "D"]);
  });

  it("keeps independent state per instance", () => {
    const a = createEugineNier();
    const b = createEugineNier();
    expect(play(["D", "D", "D", "D", "D"])).toEqual(["C", "D", "D", "D", "D"]);
    expect(play(["C", "C"])).toEqual(["C", "C"]);
  });
});
