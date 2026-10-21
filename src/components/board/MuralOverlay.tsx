// MURAL DE PISTAS — overlay de jogo que une o quadro portado do protótipo
// Nexo (Board/Inspector) à máquina de estados. O mural vive em context.mural
// (evento UPDATE_MURAL); enquanto aberto, o overlay mantém o dado de trabalho
// local (com desfazer/refazer próprio) e commita cada alteração de volta para
// a máquina, que persiste no save.
// Os cartões nascem das pistas descobertas no jogo (sync no App): aqui não há
// criação, edição nem exclusão — o jogador organiza (arrasta, liga com fios) e
// só pode denunciar depois de decidir quais pistas conectar: a denúncia exige
// o grafo conexo (canAccuse), não fica disponível o tempo todo.
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Siren, X } from 'lucide-react';
import Board from './Board';
import { BONUS_CONNECTED, canAccuse, scoreMural, type MuralScore } from '@/lib/muralScore';
import { Inspector } from './Inspector';
import { addConnection, type Connection, type MuralData, type ToolMode } from './data';

export function MuralOverlay({ mural, onChange, onClose, onAccuse }: { mural: MuralData; onChange: (data: MuralData) => void; onClose: () => void; onAccuse: (score: MuralScore) => void }) {
  const [data, setData] = useState<MuralData>(mural);
  const [mode, setMode] = useState<ToolMode>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const historyRef = useRef<{ past: MuralData[]; future: MuralData[] }>({ past: [], future: [] });
  const [, setHistoryVersion] = useState(0);
  const selectedClue = data.clues.find(c => c.id === selectedId) || null;
  const score = scoreMural(data);

  const commit = useCallback((recipe: (d: MuralData) => MuralData) => {
    const h = historyRef.current;
    h.past.push(data);
    if (h.past.length > 40) h.past.shift();
    h.future = [];
    const next = recipe(data);
    setData(next);
    onChange(next);
    setHistoryVersion(v => v + 1);
  }, [data, onChange]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (!h.past.length) return;
    const previous = h.past.pop()!;
    h.future.push(data);
    setData(previous);
    onChange(previous);
    setHistoryVersion(v => v + 1);
    toast('Última alteração desfeita.');
  }, [data, onChange]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (!h.future.length) return;
    const next = h.future.pop()!;
    h.past.push(data);
    setData(next);
    onChange(next);
    setHistoryVersion(v => v + 1);
    toast('Alteração refeita.');
  }, [data, onChange]);

  const moveClue = (id: string, x: number, y: number) => {
    commit(d => ({ ...d, clues: d.clues.map(c => (c.id === id ? { ...c, x, y } : c)) }));
  };
  const connect = (from: string, to: string, color?: string): Connection | null => {
    const result = addConnection(data, from, to, color);
    if (!result) return null;
    if (result.existed) { toast('O fio já existe. Você pode anotar a relação.'); return result.connection; }
    commit(d => ({ ...d, connections: [...d.connections, result.connection] }));
    toast('Fio preso! Anote a relação no próprio quadro.');
    return result.connection;
  };
  const updateConnection = (connection: Connection) => {
    commit(d => ({ ...d, connections: d.connections.map(c => (c.id === connection.id ? connection : c)) }));
    toast('Relação anotada.');
  };
  const deleteConnection = (id: string) => {
    commit(d => ({ ...d, connections: d.connections.filter(c => c.id !== id) }));
    toast('Fio cortado.');
  };
  const check = (clueId: string, itemId: string) => {
    commit(d => ({ ...d, clues: d.clues.map(c => (c.id === clueId ? { ...c, items: c.items?.map(i => (i.id === itemId ? { ...i, done: !i.done } : i)) } : c)) }));
  };

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      const isInput = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]');
      if (isInput) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (e.key === 'Escape') {
        if (selectedId) setSelectedId(null);
        else if (detailsOpen) setDetailsOpen(false);
        else onClose();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() === 'v') setMode('select');
      if (e.key.toLowerCase() === 'h') setMode('hand');
      if (e.key.toLowerCase() === 'c') { setMode('connect'); setSelectedId(null); setDetailsOpen(false); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  const graphStatus = score.clues === 0
    ? 'SEM PISTAS'
    : score.singleComponent
      ? `GRAFO CONEXO ✓ (+${BONUS_CONNECTED})`
      : score.clues === 1
        ? '1 PISTA'
        : `${score.components} GRUPOS SOLTOS`;

  return (
    <div className="mural-overlay" role="dialog" aria-modal="true" aria-label="Mural de investigação">
      <Board
        data={data}
        mode={mode}
        setMode={setMode}
        selectedId={selectedId}
        onSelect={id => { setSelectedId(id); setDetailsOpen(false); }}
        onDetails={clue => { setSelectedId(clue.id); setDetailsOpen(true); }}
        onMove={moveClue}
        onConnect={connect}
        onUpdateConnection={updateConnection}
        onDeleteConnection={deleteConnection}
        onCheck={check}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyRef.current.past.length > 0}
        canRedo={historyRef.current.future.length > 0}
        filter="all"
        optionsExtra={<button onClick={onClose} title="Voltar ao jogo (Esc)" aria-label="Fechar o mural"><X size={14} /><span>Fechar</span></button>}
        actionsExtra={<>
          <span className={`tray-score ${score.singleComponent ? 'connected' : ''}`} role="status">{graphStatus}</span>
          <button className="primary-button accuse-button" onClick={() => onAccuse(score)} disabled={!canAccuse(score)} title={canAccuse(score) ? 'Encerrar o caso com esta configuração do mural' : 'Conecte todas as pistas no quadro (grafo conexo) antes de fazer a denúncia'} aria-label="Fazer a denúncia e encerrar o caso">
            <Siren size={14} /><span>FAZER A DENÚNCIA</span>
          </button>
        </>}
      />
      {selectedClue && detailsOpen && (
        <Inspector
          key={selectedClue.id}
          clue={selectedClue}
          data={data}
          onClose={() => setDetailsOpen(false)}
          onSelect={setSelectedId}
        />
      )}
    </div>
  );
}
