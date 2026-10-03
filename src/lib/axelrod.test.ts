import { describe, it, expect } from 'vitest';
import { SneakyTitForTat, Grudger, Prober4, Detective, RandomStrategy, titForTat, alwaysCooperate, alwaysDefect, C, D, type Move } from './axelrod';

describe('SneakyTitForTat', () => {
  describe('opening', () => {
    it('cooperates on the first two rounds', () => {
      const s = new SneakyTitForTat();
      expect(s.play(C)).toBe(C);
      expect(s.play(C)).toBe(C);
    });
  });

  describe('sneaky exploitation', () => {
    it('defects once the opponent has never defected', () => {
      const s = new SneakyTitForTat();
      // two opening cooperations, then opponent keeps cooperating
      s.play(C);
      s.play(C);
      expect(s.play(C)).toBe(D);
    });

    it('keeps defecting while the opponent never retaliates', () => {
      const s = new SneakyTitForTat();
      s.play(C);
      s.play(C);
      expect(s.play(C)).toBe(D);
      expect(s.play(C)).toBe(D);
    });
  });

  describe('repentance', () => {
    it('cooperates after being caught defecting and punished', () => {
      const s = new SneakyTitForTat();
      s.play(C); // r1: C (opponent TFT -> C)
      s.play(C); // r2: C (opponent TFT -> C)
      s.play(C); // r3: D (sneaky)  -> opponent TFT still mirrors r2 = C
      s.play(titForTat(s.history)); // r4: D (still sneaky) -> opponent retaliates with D
      // r5: opponent's last move D, my move two rounds back (r3) was D -> repent
      expect(s.play(titForTat(s.history))).toBe(C);
    });
  });

  describe('otherwise Tit-For-Tat', () => {
    it('mimics the opponent last move when not sneaking/punishing', () => {
      const s = new SneakyTitForTat();
      s.history = [C, C, D]; // past the opening, opponent has defected before
      s.opponentHistory = [C, C, D];
      // opponent last = D, my two-back = C -> not the repent case -> mirror D
      expect(s.strategy()).toBe(D);
    });
  });

  describe('full match vs Tit For Tat', () => {
    it('produces C C D D C C ...', () => {
      const s = new SneakyTitForTat();
      const seq: Move[] = [];
      for (let i = 0; i < 6; i++) {
        seq.push(s.play(titForTat(s.history)));
      }
      expect(seq).toEqual([C, C, D, D, C, C]);
    });
  });
});

describe('Grudger', () => {
  describe('opening', () => {
    it('cooperates on the first move', () => {
      const g = new Grudger();
      expect(g.play(C)).toBe(C);
    });

    it('keeps cooperating while opponent never defects', () => {
      const g = new Grudger();
      g.play(C);
      g.play(C);
      g.play(C);
      expect(g.play(C)).toBe(C);
    });
  });

  describe('triggered', () => {
    it('defects forever after opponent defects once', () => {
      const g = new Grudger();
      g.play(C); // r1: C
      g.play(D); // r2: C (opponent defected, but check happens after play)
      expect(g.play(C)).toBe(D); // r3: triggered, defects
      expect(g.play(C)).toBe(D); // r4: forever D
      expect(g.play(C)).toBe(D); // r5: forever D
    });

    it('stays triggered even if opponent cooperates again', () => {
      const g = new Grudger();
      g.play(C);
      g.play(D); // opponent defects -> triggers
      g.play(C); // opponent returns to C
      expect(g.play(C)).toBe(D); // still D
    });
  });

  describe('matches', () => {
    it('all C vs Always Cooperate', () => {
      const g = new Grudger();
      const seq: Move[] = [];
      for (let i = 0; i < 5; i++) {
        seq.push(g.play(alwaysCooperate()));
      }
      expect(seq).toEqual([C, C, C, C, C]);
    });

    it('C then all D vs Always Defect', () => {
      const g = new Grudger();
      const seq: Move[] = [];
      for (let i = 0; i < 5; i++) {
        seq.push(g.play(alwaysDefect()));
      }
      expect(seq).toEqual([C, D, D, D, D]);
    });

    it('all C vs Tit For Tat (mutual cooperation)', () => {
      const g = new Grudger();
      const seq: Move[] = [];
      for (let i = 0; i < 5; i++) {
        seq.push(g.play(titForTat(g.history)));
      }
      expect(seq).toEqual([C, C, C, C, C]);
    });
  });
});

describe('Prober4', () => {
  const INIT_SEQ: Move[] = [
    C, C, D, C, D, D, D, C, C, D,
    C, D, C, C, D, C, D, D, C, D,
  ];

  describe('probe sequence', () => {
    it('returns the exact 20-move init sequence regardless of opponent', () => {
      const p = new Prober4();
      for (let i = 0; i < 20; i++) {
        expect(p.play(C)).toBe(INIT_SEQ[i]);
      }
    });

    it('counts justDs when opponent defects while I defected', () => {
      const p = new Prober4();
      // Force history so that on round 1 (turn=1) we see: I defected, opp defected
      p.history = [D];
      p.opponentHistory = [D];
      const move = p.strategy(); // turn=1, opp[-1]=D, my[-1]=D → justDs++
      expect(move).toBe(INIT_SEQ[1]); // still follows sequence
    });

    it('counts unjustDs when opponent defects while I cooperated', () => {
      const p = new Prober4();
      p.history = [C];
      p.opponentHistory = [D];
      const move = p.strategy(); // turn=1, opp[-1]=D, my[-1]=C → unjustDs++
      expect(move).toBe(INIT_SEQ[1]);
    });
  });

  describe('decision: Always Cooperate opponent', () => {
    it('turns defector after probe (diff=0 ≤ 2)', () => {
      const p = new Prober4();
      // Opponent never defects → justDs=0, unjustDs=0 → diff=0
      for (let i = 0; i < 20; i++) p.play(C);
      expect(p.play(C)).toBe(D); // turn 20: forever D
      expect(p.play(C)).toBe(D);
      expect(p.play(C)).toBe(D);
    });
  });

  describe('decision: Always Defect opponent', () => {
    it('turns defector after probe (diff=0 ≤ 2)', () => {
      const p = new Prober4();
      // Opponent always defects → justDs=10, unjustDs=10 → diff=0
      for (let i = 0; i < 20; i++) p.play(D);
      expect(p.play(D)).toBe(D);
      expect(p.play(D)).toBe(D);
    });
  });

  describe('decision: Tit For Tat opponent', () => {
    it('does NOT turn defector (diff=9 > 2), plays 5 C then TFT', () => {
      const p = new Prober4();
      for (let i = 0; i < 20; i++) p.play(titForTat(p.history));

      // 5 rounds of C
      expect(p.play(titForTat(p.history))).toBe(C); // turn 20
      expect(p.play(titForTat(p.history))).toBe(C); // turn 21
      expect(p.play(titForTat(p.history))).toBe(C); // turn 22
      expect(p.play(titForTat(p.history))).toBe(C); // turn 23
      expect(p.play(titForTat(p.history))).toBe(C); // turn 24

      // turn 25+: TFT — mirrors opponent
      expect(p.play(titForTat(p.history))).toBe(
        p.opponentHistory[p.opponentHistory.length - 1],
      );
    });
  });
});

describe('Detective', () => {
  describe('initial sequence', () => {
    it('plays C, D, C, C as default sequence', () => {
      const d = new Detective();
      expect(d.play(C)).toBe(C);
      expect(d.play(C)).toBe(D);
      expect(d.play(C)).toBe(C);
      expect(d.play(C)).toBe(C);
    });
  });

  describe('custom initial sequence', () => {
    it('accepts custom actions', () => {
      const d = new Detective([D, D, C]);
      expect(d.play(C)).toBe(D);
      expect(d.play(C)).toBe(D);
      expect(d.play(C)).toBe(C);
    });
  });

  describe('after probe', () => {
    it('defects forever if opponent never defected during probe', () => {
      const d = new Detective();
      d.play(C); d.play(C); d.play(C); d.play(C); // probe: all C from opp
      expect(d.play(C)).toBe(D); // no D in opp's first 4 → D forever
      expect(d.play(C)).toBe(D);
    });

    it('plays TFT if opponent defected during probe', () => {
      const d = new Detective();
      d.play(C); d.play(C); d.play(C);
      d.play(D); // opp defect in probe (round 4)
      // after probe: TFT mirrors opp's last move
      expect(d.play(C)).toBe(D); // opp's last was D (round 4)
    });
  });

  describe('matches', () => {
    it('C D C C then all D vs Always Cooperate', () => {
      const d = new Detective();
      const seq: Move[] = [];
      for (let i = 0; i < 8; i++) {
        seq.push(d.play(alwaysCooperate()));
      }
      expect(seq).toEqual([C, D, C, C, D, D, D, D]);
      // After probe: opp never defected → D forever
    });

    it('C D C C then TFT vs Always Defect', () => {
      const d = new Detective();
      const seq: Move[] = [];
      for (let i = 0; i < 10; i++) {
        seq.push(d.play(alwaysDefect()));
      }
      // probe: C, D, C, C (opp always D → triggered)
      // then TFT: mirrors last opp = D
      expect(seq.slice(0, 4)).toEqual([C, D, C, C]);
      expect(seq.slice(4)).toEqual([D, D, D, D, D, D]);
    });

    it('C D C C then TFT mutual C vs Tit For Tat', () => {
      const d = new Detective();
      const seq: Move[] = [];
      for (let i = 0; i < 10; i++) {
        seq.push(d.play(titForTat(d.history)));
      }
      // probe: C, D, C, C
      // TFT opp mirrored: C, C, D, C → D detected in probe
      // then TFT -> mutual cooperation (both mirror each other = C,C,C,...)
      expect(seq).toEqual([C, D, C, C, C, C, C, C, C, C]);
    });
  });
});

describe('RandomStrategy', () => {
  describe('deterministic extremes', () => {
    it('p=0 always defects', () => {
      const r = new RandomStrategy(0);
      expect(r.play(C)).toBe(D);
      expect(r.play(C)).toBe(D);
      expect(r.play(C)).toBe(D);
    });

    it('p=1 always cooperates', () => {
      const r = new RandomStrategy(1);
      expect(r.play(D)).toBe(C);
      expect(r.play(D)).toBe(C);
    });
  });

  describe('seeded RNG', () => {
    it('uses injected rng to decide moves', () => {
      // Alternates: 0.2 (<0.5 → C), 0.7 (≥0.5 → D), 0.4 (<0.5 → C)
      const values = [0.2, 0.7, 0.4];
      let i = 0;
      const r = new RandomStrategy(0.5, () => values[i++]);
      expect(r.play(C)).toBe(C);
      expect(r.play(C)).toBe(D);
      expect(r.play(C)).toBe(C);
    });
  });

  describe('memory depth 0', () => {
    it('ignores opponent history', () => {
      const values = [0.1, 0.9, 0.1]; // C, D, C
      let i = 0;
      const r = new RandomStrategy(0.5, () => values[i++]);
      // Even though opponent always defects, RandomStrategy doesn't care
      expect(r.play(D)).toBe(C);
      expect(r.play(D)).toBe(D);
      expect(r.play(D)).toBe(C);
    });
  });
});
