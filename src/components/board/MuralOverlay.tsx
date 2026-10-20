// MURAL DE PISTAS — overlay de jogo que une o quadro portado do protótipo
// Nexo (Board/Inspector/ClueEditor/Modal) à máquina de estados. O mural vive
// em context.mural (evento UPDATE_MURAL); enquanto aberto, o overlay mantém
// o dado de trabalho local (com desfazer/refazer próprio) e commita cada
// alteração de volta para a máquina, que persiste no save.
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Trash2, X } from 'lucide-react';
import Board from './Board';
import { ClueEditor } from './ClueEditor';
import { Inspector } from './Inspector';
import Modal from './Modal';
import { addConnection, attachmentSize, createClue, MAX_MURAL_BYTES, type Clue, type ClueType, type Connection, type MuralData, type ToolMode, typeLabels } from './data';

type ModalState =
  | { kind: 'clue'; clue: Clue; isNew: boolean }
  | { kind: 'confirm'; title: string; description: string; confirmLabel: string; action: () => void };

export function MuralOverlay({ mural, onChange, onClose }: { mural: MuralData; onChange: (data: MuralData) => void; onClose: () => void }) {
  const [data, setData] = useState<MuralData>(mural);
  const [mode, setMode] = useState<ToolMode>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const historyRef = useRef<{ past: MuralData[]; future: MuralData[] }>({ past: [], future: [] });
  const [, setHistoryVersion] = useState(0);
  const selectedClue = data.clues.find(c => c.id === selectedId) || null;
  const closeModal = useCallback(() => setModal(null), []);

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
  const openAdd = (type: ClueType, point?: { x: number; y: number }) => {
    setModal({ kind: 'clue', clue: createClue(type, point), isNew: true });
  };
  const saveClue = (clue: Clue) => {
    const isNew = modal?.kind === 'clue' && modal.isNew;
    const clues = isNew ? [...data.clues, clue] : data.clues.map(c => (c.id === clue.id ? clue : c));
    if (attachmentSize(clues) > MAX_MURAL_BYTES) {
      toast.error('O mural está cheio de anexos. Remova alguma imagem grande antes de continuar.');
      return;
    }
    commit(d => ({ ...d, clues }));
    closeModal();
    setMode('select');
    setSelectedId(clue.id);
    setDetailsOpen(false);
    toast(isNew ? 'Nova pista presa ao mural.' : 'Pista atualizada.');
  };
  const deleteClue = (clue: Clue) => setModal({
    kind: 'confirm',
    title: 'Retirar esta pista?',
    description: `“${clue.title}” e seus fios serão removidos do mural. Você pode desfazer esta ação.`,
    confirmLabel: 'Excluir pista',
    action: () => {
      commit(d => ({ ...d, clues: d.clues.filter(c => c.id !== clue.id), connections: d.connections.filter(c => c.from !== clue.id && c.to !== clue.id) }));
      setSelectedId(null);
      setDetailsOpen(false);
      closeModal();
      toast('Pista retirada do mural.');
    },
  });

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (modal) return;
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
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); openAdd('note'); }
      if (e.key.toLowerCase() === 'v') setMode('select');
      if (e.key.toLowerCase() === 'h') setMode('hand');
      if (e.key.toLowerCase() === 'c') { setMode('connect'); setSelectedId(null); setDetailsOpen(false); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClue) { e.preventDefault(); deleteClue(selectedClue); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  return (
    <div className="mural-overlay" role="dialog" aria-modal="true" aria-label="Mural de investigação">
      <Board
        data={data}
        mode={mode}
        setMode={setMode}
        selectedId={selectedId}
        onSelect={id => { setSelectedId(id); setDetailsOpen(false); }}
        onEdit={clue => setModal({ kind: 'clue', clue, isNew: false })}
        onDetails={clue => { setSelectedId(clue.id); setDetailsOpen(true); }}
        onMove={moveClue}
        onConnect={connect}
        onUpdateConnection={updateConnection}
        onDeleteConnection={deleteConnection}
        onCheck={check}
        onAdd={openAdd}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyRef.current.past.length > 0}
        canRedo={historyRef.current.future.length > 0}
        filter="all"
        optionsExtra={<button onClick={onClose} title="Voltar ao jogo (Esc)" aria-label="Fechar o mural"><X size={14} /><span>Fechar</span></button>}
      />
      {selectedClue && detailsOpen && (
        <Inspector
          key={selectedClue.id}
          clue={selectedClue}
          data={data}
          onClose={() => setDetailsOpen(false)}
          onEdit={() => setModal({ kind: 'clue', clue: selectedClue, isNew: false })}
          onDelete={() => deleteClue(selectedClue)}
          onSelect={setSelectedId}
        />
      )}
      {modal?.kind === 'clue' && (
        <Modal title={modal.isNew ? 'Mais uma peça do mistério.' : 'O detalhe faz a diferença.'} eyebrow={modal.isNew ? 'PRENDER UMA NOVA PISTA' : `EDITAR ${typeLabels[modal.clue.type].toUpperCase()}`} onClose={closeModal} wide>
          <ClueEditor key={modal.clue.id} clue={modal.clue} isNew={modal.isNew} onSave={saveClue} onCancel={closeModal} />
        </Modal>
      )}
      {modal?.kind === 'confirm' && (
        <Modal title={modal.title} eyebrow="ANTES DE CONTINUAR" onClose={closeModal}>
          <div className="modal-body confirm-body">
            <span className="confirm-icon"><Trash2 size={24} strokeWidth={1.5} /></span>
            <p>{modal.description}</p>
          </div>
          <div className="modal-footer">
            <button className="secondary-button" onClick={closeModal}>Manter como está</button>
            <button className="danger-button" onClick={modal.action}><Trash2 size={14} />{modal.confirmLabel}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
