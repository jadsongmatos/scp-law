import React, { useMemo } from 'react';
import { CheckCircle, X as XIcon, Pin, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const DEDUCTION_LOCATIONS = ['Escritório Murphy', 'Rua Sieben', 'Gasthof Vila Nova', 'Volksschule', 'Volkspolizeistation 8º'] as const;

const DEDUCTION_CATEGORIES = {
  suspeito: ['Kommissar Mendes', 'Diretora Elvira', 'Seu Jonas', 'Zeca do Gasthof', 'Dra. Cunha'],
  local_crime: ['Lagerhaus 7', 'Beco da Rua Sieben', 'Volksschule Vila Nova', 'Volkspolizeistation 8º', 'Gasthof Vila Nova'],
  arma: ['Revólver .38', 'Faca de Cozinha', 'Arame de Piano', 'Chave Inglesa', 'Veneno Injetável'],
  motivo: ['Dívida de Jogo', 'Vingança Pessoal', 'Tráfico de Crianças', 'Extorsão', 'Cobertura de Crime'],
  horario: ['22:00', '23:30', '01:00', '02:30', '04:00'],
} as const;

type DeductionCategory = keyof typeof DEDUCTION_CATEGORIES;

const CAT_LABELS: Record<DeductionCategory, string> = {
  suspeito: 'SUSPEITO',
  local_crime: 'LOCAL DO CRIME',
  arma: 'ARMA',
  motivo: 'MOTIVO',
  horario: 'HORÁRIO',
};

const CAT_COLORS: Record<DeductionCategory, string> = {
  suspeito: '#d4a847',
  local_crime: '#8b5cf6',
  arma: '#ef4444',
  motivo: '#3b82f6',
  horario: '#10b981',
};

const HINT_VALUES: Record<string, string[]> = {
  puzzle_hint_1: ['Dra. Cunha', 'Revólver .38', 'Tráfico de Crianças'],
  puzzle_hint_2: ['Seu Jonas', '04:00'],
  puzzle_hint_3: ['Beco da Rua Sieben', '22:00'],
  puzzle_hint_4: ['Gasthof Vila Nova', 'Veneno Injetável', 'Vingança Pessoal'],
  puzzle_hint_5: ['Diretora Elvira', 'Arame de Piano', 'Vingança Pessoal'],
  puzzle_hint_6: ['Vingança Pessoal', '22:00'],
  puzzle_hint_7: ['Faca de Cozinha', '02:30'],
  puzzle_hint_8: ['Kommissar Mendes', 'Lagerhaus 7'],
  puzzle_hint_9: ['Kommissar Mendes', 'Dra. Cunha', 'Arame de Piano'],
  puzzle_hint_10: ['Veneno Injetável', '22:00'],
  puzzle_hint_11: ['Dívida de Jogo'],
  puzzle_hint_12: ['Volkspolizeistation 8º', 'Extorsão'],
  puzzle_hint_13: ['Kommissar Mendes', 'Dívida de Jogo'],
  puzzle_hint_14: ['Volksschule Vila Nova', 'Faca de Cozinha'],
  puzzle_hint_15: ['Diretora Elvira', '23:30'],
  puzzle_hint_16: ['Seu Jonas', 'Volksschule Vila Nova'],
  puzzle_hint_17: ['Kommissar Mendes', 'Beco da Rua Sieben'],
  puzzle_hint_18: ['Kommissar Mendes', 'Volksschule Vila Nova'],
};

const ALL_VALUES = Object.values(DEDUCTION_CATEGORIES).flat();

interface DetectiveBoardProps {
  grid: Record<string, Record<DeductionCategory, string>>;
  onGridChange: (grid: Record<string, Record<DeductionCategory, string>>) => void;
  readHints: string[];
  result: 'correct' | 'wrong' | null;
  onSubmit: () => void;
  onClose: () => void;
  playHover: () => void;
  playTypewriter: () => void;
}

export default function DetectiveBoard({
  grid,
  onGridChange,
  readHints,
  result,
  onSubmit,
  onClose,
  playHover,
  playTypewriter,
}: DetectiveBoardProps) {
  const discoveredValues = useMemo(() => {
    const discovered = new Set<string>();
    readHints.forEach(hintId => {
      (HINT_VALUES[hintId] || []).forEach(v => discovered.add(v));
    });
    if (readHints.length >= 18) {
      ALL_VALUES.forEach(v => discovered.add(v));
    } else {
      (Object.keys(DEDUCTION_CATEGORIES) as DeductionCategory[]).forEach(cat => {
        const vals = DEDUCTION_CATEGORIES[cat];
        const discoveredInCat = vals.filter(v => discovered.has(v));
        if (discoveredInCat.length === vals.length - 1) {
          const missing = vals.find(v => !discovered.has(v));
          if (missing) discovered.add(missing);
        }
      });
    }
    return discovered;
  }, [readHints]);

  const columnsComplete = useMemo(() => {
    return DEDUCTION_LOCATIONS.filter(loc => {
      const row = grid[loc];
      return (Object.keys(DEDUCTION_CATEGORIES) as DeductionCategory[]).every(cat => !!row[cat]);
    });
  }, [grid]);

  const setValue = (loc: string, cat: DeductionCategory, val: string) => {
    playTypewriter();
    onGridChange({
      ...grid,
      [loc]: { ...grid[loc], [cat]: val },
    });
  };

  const getUsedInRow = (cat: DeductionCategory): string[] => {
    const used: string[] = [];
    DEDUCTION_LOCATIONS.forEach(loc => {
      if (grid[loc][cat]) used.push(grid[loc][cat]);
    });
    return used;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="crt-overlay" />

      <div
        className="flex-1 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 49px, rgba(139,90,43,0.08) 49px, rgba(139,90,43,0.08) 50px),
            repeating-linear-gradient(90deg, transparent, transparent 49px, rgba(139,90,43,0.08) 49px, rgba(139,90,43,0.08) 50px),
            radial-gradient(ellipse at 30% 40%, #3d2b1f 0%, #1a1410 60%, #0d0a07 100%)
          `,
        }}
      >
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)', pointerEvents: 'none', zIndex: 1 }} />

        <div className="relative z-10 h-full flex flex-col p-3 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Pin size={18} className="text-noir-amber" />
              <h2 className="text-noir-amber text-sm md:text-base tracking-[0.25em] font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
                DETECTIVE BOARD — FALL HELENA KRAFT
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <Badge classification="euclid" size="sm">PISTAS: {readHints.length}/18</Badge>
              <Badge classification="safe" size="sm">DESCOBERTAS: {discoveredValues.size}/25</Badge>
              <button onClick={onClose} className="text-zinc-500 hover:text-noir-amber transition-colors p-1">
                <XIcon size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <div className="min-w-[700px] md:min-w-0 flex gap-3 md:gap-5 h-full">
              {DEDUCTION_LOCATIONS.map((loc, colIdx) => {
                const isComplete = columnsComplete.includes(loc);
                return (
                  <div key={loc} className="flex-1 flex flex-col items-center gap-2 md:gap-3">
                    <div
                      className={`relative px-3 py-2 border-2 text-center text-[10px] md:text-xs tracking-[0.2em] font-bold w-full ${
                        isComplete
                          ? 'border-noir-amber bg-noir-amber/10 text-noir-amber shadow-[0_0_20px_rgba(212,168,71,0.2)]'
                          : 'border-zinc-600 bg-zinc-900/80 text-zinc-400'
                      }`}
                      style={{
                        clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
                      }}
                    >
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-2 bg-noir-amber rounded-full shadow-[0_0_6px_rgba(212,168,71,0.6)]" />
                      {loc}
                      {isComplete && (
                        <svg className="absolute -bottom-1 left-0 w-full h-3 overflow-visible" style={{ zIndex: 5 }}>
                          <line x1="50%" y1="0" x2="50%" y2="8" stroke="#d4a847" strokeWidth="1.5" strokeDasharray="3,2" />
                        </svg>
                      )}
                    </div>

                    {(Object.keys(DEDUCTION_CATEGORIES) as DeductionCategory[]).map((cat, rowIdx) => {
                      const current = grid[loc][cat];
                      const usedInRow = getUsedInRow(cat);
                      const options = [...DEDUCTION_CATEGORIES[cat]].filter(o => !usedInRow.includes(o) || o === current);
                      const isDuplicate = current && usedInRow.filter(v => v === current).length > 1;
                      const allDiscovered = DEDUCTION_CATEGORIES[cat].every(v => discoveredValues.has(v));
                      const catColor = CAT_COLORS[cat];

                      return (
                        <div
                          key={cat}
                          className={`relative w-full border transition-all duration-300 ${
                            isDuplicate
                              ? 'border-red-800 bg-red-950/40'
                              : current
                              ? 'border-noir-amber/60 bg-noir-amber/5'
                              : 'border-zinc-700/50 bg-zinc-900/60'
                          }`}
                          style={{
                            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                          }}
                        >
                          <div className="absolute -top-1 left-2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catColor, boxShadow: `0 0 4px ${catColor}60` }} />

                          <div className="px-2 py-1.5">
                            <div className="text-[8px] md:text-[9px] tracking-[0.15em] mb-0.5" style={{ color: catColor }}>
                              {CAT_LABELS[cat]}
                            </div>

                            {current ? (
                              <button
                                className="w-full text-left text-[10px] md:text-xs font-bold tracking-wide text-noir-amber hover:text-white transition-colors cursor-pointer"
                                onClick={() => setValue(loc, cat, '')}
                                title="Clique para limpar"
                              >
                                {current}
                              </button>
                            ) : (
                              <select
                                value=""
                                onChange={(e) => setValue(loc, cat, e.target.value)}
                                onMouseEnter={playHover}
                                className="w-full bg-transparent text-[10px] md:text-xs text-zinc-500 cursor-pointer appearance-none border-none outline-none hover:text-noir-amber transition-colors"
                              >
                                <option value="">—</option>
                                {options.map(opt => {
                                  const isKnown = discoveredValues.has(opt);
                                  return (
                                    <option key={opt} value={opt} style={{ color: isKnown ? catColor : '#555' }}>
                                      {isKnown ? opt : '? ? ?'}
                                    </option>
                                  );
                                })}
                              </select>
                            )}
                          </div>

                          {isComplete && colIdx < DEDUCTION_LOCATIONS.length - 1 && rowIdx === 2 && (
                            <svg className="absolute -right-5 top-1/2 -translate-y-1/2 w-5 h-[2px] overflow-visible" style={{ zIndex: 5 }}>
                              <line x1="0" y1="0" x2="20" y2="0" stroke="#8b0000" strokeWidth="1.5" opacity="0.7" />
                              <line x1="0" y1="2" x2="20" y2="2" stroke="#8b0000" strokeWidth="0.5" opacity="0.3" />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {result === 'correct' && (
            <div className="mt-3 p-2 border border-green-800 bg-green-900/20 text-green-400 flex items-center gap-2 text-xs tracking-wider">
              <Badge classification="safe">DEDUÇÃO CORRETA — FALL HELENA KRAFT RESOLVIDO</Badge>
            </div>
          )}
          {result === 'wrong' && (
            <div className="mt-3 p-2 border border-noir-red bg-noir-red/10 text-noir-red flex items-center gap-2 text-xs tracking-wider">
              <Badge classification="keter">DEDUÇÃO INCORRETA — HÁ INCONSISTÊNCIAS</Badge>
            </div>
          )}

          <div className="mt-3 flex justify-between items-center">
            <div className="flex items-center gap-2 text-zinc-600 text-[10px] tracking-wider">
              <FileText size={12} />
              <span>CADA COLUNA = UM LOCAL. NENHUM VALOR SE REPETE NA LINHA.</span>
            </div>
            <Button
              variant="default"
              onClick={onSubmit}
              onMouseEnter={playHover}
              className="border-2 border-noir-amber text-noir-amber px-4 md:px-6 py-1.5 hover:bg-noir-amber hover:text-black font-bold tracking-[0.2em] transition-colors text-xs md:text-sm"
            >
              SUBMETER DEDUÇÃO
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
