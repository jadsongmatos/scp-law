import { describe, it, expect } from 'vitest';
import { HardProber, C, D } from './hardProber';

// Jogador TFT mínimo para simular oponentes.
class TFT {
  history: Action[] = [];
  play(opponentLast: Action | undefined): Action {
    if (opponentLast === undefined) return C;
    const move = opponentLast === D ? D : C;
    this.history.push(move);
    return move;
  }
}
type Action = typeof C | typeof D;

// Helper: alimenta o oponente turno a turno e devolve o histórico do HardProber.
function playControlled(opponentMoves: Action[]) {
  const me = new HardProber();
  const myHistory: Action[] = [];
  for (let t = 0; t < opponentMoves.length; t++) {
    myHistory.push(me.play(opponentMoves[t]));
  }
  return myHistory;
}

describe('HardProber', () => {
  describe('sequência inicial', () => {
    it('joga D, D, C, C nos 4 primeiros turnos', () => {
      const me = new HardProber();
      const seq: Action[] = [];
      for (let t = 0; t < 4; t++) {
        // oponente coopera sempre (não afeta os 4 primeiros turnos)
        seq.push(me.play(C));
      }
      expect(seq).toEqual([D, D, C, C]);
    });
  });

  describe('defecciona para sempre se oponente cooperou nos turns 2 e 3', () => {
    it('oponente C,C,C,... -> HardProber passa a defender (D) do turno 4 em diante', () => {
      const my = playControlled([C, C, C, C, C, C, C, C]);
      // turns 0,1,2,3 = D,D,C,C ; turn >=4 => D (porque opp[1]==C && opp[2]==C)
      expect(my).toEqual([D, D, C, C, D, D, D, D]);
    });
  });

  describe('caso contrário joga TFT a partir do turno 4', () => {
    it('oponente D no turn 2 (opp[1]==D) -> TFT', () => {
      // opp history: [C, D, C, D, ...]
      const my = playControlled([C, D, C, D, C, D, C]);
      // turn0 D, turn1 D, turn2 C, turn3 C
      // turn4: opp[1]==D => não entra no "cooperou"; TFT sobre opp[3]==D => D
      // turn5: TFT sobre opp[4]==C => C
      // turn6: TFT sobre opp[5]==D => D
      // turn7: TFT sobre opp[6]==C => C
      expect(my).toEqual([D, D, C, C, D, C, D]);
    });

    it('TFT real: espelha a última jogada do oponente após a sondagem', () => {
      const me = new HardProber();
      const opp = new TFT();
      const myHistory: Action[] = [];
      let oppLast: Action | undefined;
      for (let t = 0; t < 10; t++) {
        const myMove = me.play(oppLast ?? C);
        myHistory.push(myMove);
        oppLast = opp.play(myHistory[t]);
      }
      // turnos 0-3 fixos: D,D,C,C
      expect(myHistory.slice(0, 4)).toEqual([D, D, C, C]);
      // opp[1]==C mas opp[2]==D -> não entra no ramo "defecta p/ sempre"
      // TFT: myMove[t] = oppHistory[t-1]
      // opp coopera no turn0 (C), depois espelha meu turn anterior
      expect(myHistory[4]).toBe(C); // opp turn3 foi C
    });
  });

  describe('estado', () => {
    it('mantém os históricos de ambos os jogadores', () => {
      const me = new HardProber();
      me.play(C);
      me.play(C);
      expect(me.history).toEqual([D, D]);
      expect(me.opponentHistory).toEqual([C, C]);
    });
  });
});
