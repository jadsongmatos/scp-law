// MURAL DE PISTAS — quadro de cortiça interativo (portado do protótipo Nexo).
// Diferenças em relação ao protótipo: os dados vêm de MuralData (não há
// conceito de "casos"); o jogo injeta o botão Fechar via optionsExtra; e os
// easter eggs do caso de demonstração (ids 'boletim', 'camera', 'elisa',
// 'marcos') foram removidos.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { ArrowUpRight, Check, Eye, EyeOff, FileText, Fingerprint, Hand, ImagePlus, Link2, MapPin, Maximize, Minus, MousePointer2, Pencil, Plus, Redo2, Scan, Scissors, StickyNote, Undo2, Video, X } from 'lucide-react';
import { BOARD_HEIGHT, BOARD_WIDTH, type Clue, type ClueType, type Connection, type MuralData, type ToolMode } from './data';

type Point = { x: number; y: number };
interface BoardProps {
  data: MuralData;
  mode: ToolMode;
  setMode: (mode: ToolMode) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (clue: Clue) => void;
  onDetails: (clue: Clue) => void;
  onMove: (id: string, x: number, y: number) => void;
  onConnect: (from: string, to: string, color?: string) => Connection | null;
  onUpdateConnection: (connection: Connection) => void;
  onDeleteConnection: (id: string) => void;
  onCheck: (clueId: string, itemId: string) => void;
  onAdd: (type: ClueType, point?: Point) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  filter: string;
  optionsExtra?: ReactNode;
}
const THREAD_COLORS = [
  { color: '#a13d35', label: 'Vermelho', meaning: 'Ligação' },
  { color: '#b79040', label: 'Mostarda', meaning: 'Hipótese' },
  { color: '#49685d', label: 'Verde', meaning: 'Confirmado' },
  { color: '#4c6679', label: 'Azul', meaning: 'Investigar' },
];

function SpoolIcon({ color = '#a13d35' }: { color?: string }) {
  return <span className="spool-icon" style={{ '--spool-color': color } as CSSProperties} aria-hidden="true"><i className="spool-core" /><i className="spool-top" /><i className="spool-bottom" /><i className="spool-loose-thread" /></span>;
}

function ClueContent({ clue, onCheck }: { clue: Clue; onCheck?: (id: string) => void }) {
  if (clue.type === 'note') return <div className="sticky-content">
    <div className="note-eyebrow">{clue.subtitle || 'LEMBRETE PARA MIM'}</div>
    <h3>{clue.title}</h3><p>{clue.content}</p>
    {clue.content.length < 65 && <span className="note-bottom">seguir o fio <ArrowUpRight size={24} strokeWidth={1.5} /></span>}
  </div>;
  if (clue.type === 'checklist') return <div className="checklist-content">
    <h3>{clue.title}</h3><span className="hand-line" />
    <div className="paper-checks">{clue.items?.map(item => <button key={item.id} className={`paper-check ${item.done ? 'done' : ''}`} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onCheck?.(item.id); }} aria-label={`${item.done ? 'Desmarcar' : 'Concluir'} ${item.text}`}>
      <span className="drawn-checkbox">{item.done && <Check size={15} strokeWidth={2.5} />}</span><span>{item.text}</span>
    </button>)}</div><p>{clue.content}</p>
    <span className="paper-scribble">investigar! <svg viewBox="0 0 54 18"><path d="M2 10Q20 3 47 10M40 3l8 7-10 5" /></svg></span>
  </div>;
  if (clue.type === 'document') return <div className="document-content">
    <div className="document-seal"><Fingerprint size={22} strokeWidth={1.2} /><span>ARQUIVO DE INVESTIGAÇÃO<br /><b>DEPARTAMENTO DE EVIDÊNCIAS</b></span></div>
    <div className="doc-rule" /><span className="document-number">{clue.subtitle || 'DOCUMENTO DO CASO'}</span>
    <h3>{clue.title}</h3><span className="document-date">{new Date(clue.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span>
    <p>{clue.content}</p>{clue.badge && <span className="confidential-stamp">{clue.badge}</span>}
    <div className="document-file"><FileText size={13} /><span>{clue.fileName || 'Documento de investigação'}</span><span>↗</span></div>
  </div>;
  if (clue.type === 'recording') return <div className="recording-content">
    <div className="camera-frame">{clue.image ? <img src={clue.image} alt={clue.title} draggable={false} /> : <Video size={38} />}
      <span className="camera-label"><i />REC</span><span className="camera-time">{clue.badge || 'REGISTRO'}</span><div className="camera-crosshair" />
    </div><h3>{clue.title}</h3><span className="photo-subtitle">{clue.subtitle}</span>
  </div>;
  return <div className={`photo-content ${clue.type === 'location' ? 'location-content' : ''}`}>
    <div className="photo-frame">{clue.image ? <img src={clue.image} alt={clue.title} style={{ objectPosition: clue.imagePosition }} draggable={false} /> : <div className="photo-placeholder">{clue.type === 'location' ? <MapPin size={45} strokeWidth={1} /> : <Fingerprint size={45} strokeWidth={1} />}</div>}
      {clue.badge && <span className={`photo-badge ${clue.type === 'location' ? 'location-badge' : ''}`}><i />{clue.badge}</span>}
    </div><h3>{clue.title}</h3><span className="photo-subtitle">{clue.subtitle || (clue.type === 'person' ? 'PESSOA DE INTERESSE' : 'LOCAL DA INVESTIGAÇÃO')}</span>
    <div className="photo-footer"><span>{clue.type === 'person' ? 'PESSOA' : 'LOCAL'}</span><span>{new Date(clue.createdAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span></div>
  </div>;
}

function pinPosition(clue: Clue): Point {
  const angle = clue.rotation * Math.PI / 180;
  const offset = 9 - clue.height / 2;
  return { x: clue.x + clue.width / 2 - offset * Math.sin(angle), y: clue.y + clue.height / 2 + offset * Math.cos(angle) };
}
function ropePath(a: Point, b: Point) {
  const sag = Math.min(32, Math.hypot(a.x - b.x, a.y - b.y) * 0.045);
  return { d: `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + sag} ${b.x} ${b.y}`, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sag / 2 };
}
function connectionPath(from: Clue, to: Clue) { return ropePath(pinPosition(from), pinPosition(to)); }

function ThreadEditor({ connection, data, onSave, onCut, onClose, position }: { connection: Connection; data: MuralData; onSave: (connection: Connection) => void; onCut: () => void; onClose: () => void; position: Point }) {
  const [label, setLabel] = useState(connection.label === 'Relacionado a' ? '' : connection.label);
  const [color, setColor] = useState(connection.color);
  const from = data.clues.find(c => c.id === connection.from), to = data.clues.find(c => c.id === connection.to);
  const submit = (e: FormEvent) => { e.preventDefault(); onSave({ ...connection, color, label: label.trim() || 'Relacionado a' }); };
  return <form className="thread-editor floating-ui" style={{ left: position.x, top: position.y }} onSubmit={submit} aria-label="Editar conexão no quadro">
    <span className="thread-editor-tape" />
    <div className="thread-editor-heading"><span><Link2 size={12} />O FIO QUE LIGA</span><button type="button" onClick={onClose} aria-label="Fechar edição do fio"><X size={15} /></button></div>
    <div className="thread-editor-names"><span>{from?.title}</span><span>↔</span><span>{to?.title}</span></div>
    <label><span>Qual é a relação?</span><input value={label} onChange={e => setLabel(e.target.value)} maxLength={80} placeholder="Ex.: estava no mesmo local" aria-label="Nome da relação" /></label>
    <div className="thread-editor-bottom"><div className="inline-thread-colors">{THREAD_COLORS.map(c => <button type="button" key={c.color} className={color === c.color ? 'active' : ''} onClick={() => setColor(c.color)} aria-label={`Fio ${c.label}`} title={`${c.label} · ${c.meaning}`}><SpoolIcon color={c.color} /></button>)}</div><button className="thread-save" type="submit"><Check size={13} />Anotar</button></div>
    <button className="cut-thread" type="button" onClick={onCut}><Scissors size={13} />Cortar este fio</button>
  </form>;
}

export default function Board(props: BoardProps) {
  const { data, mode, setMode, selectedId, onSelect, onEdit, onDetails, onMove, onConnect, onUpdateConnection, onDeleteConnection, onCheck, onAdd, onUndo, onRedo, canUndo, canRedo, filter, optionsExtra } = props;
  const viewport = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [preview, setPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const [firstConnection, setFirstConnection] = useState<string | null>(null);
  const [wire, setWire] = useState<{ from: string; point: Point; targetId: string | null } | null>(null);
  const [threadColor, setThreadColor] = useState(THREAD_COLORS[0].color);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [minimap, setMinimap] = useState(false);
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);
  const drag = useRef<{ id: string; startX: number; startY: number; x: number; y: number; lastX: number; lastY: number; moved: boolean } | null>(null);
  const wireDrag = useRef<{ from: string; startX: number; startY: number; moved: boolean } | null>(null);
  const pan = useRef<{ startX: number; startY: number; x: number; y: number; moved: boolean } | null>(null);
  const isPanning = mode === 'hand' || spaceDown;
  const isLinking = mode === 'connect' || Boolean(firstConnection || wire);
  const activeConnection = data.connections.find(c => c.id === activeConnectionId);
  const renderedClues = data.clues.map(clue => preview?.id === clue.id ? { ...clue, x: preview.x, y: preview.y } : clue);
  const matches = (clue: Clue) => filter === 'all' || clue.type === filter || (filter === 'photos' && ['person', 'location', 'recording'].includes(clue.type));
  const cancelWire = useCallback(() => { setFirstConnection(null); setWire(null); wireDrag.current = null; }, []);

  const fit = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const clues = data.clues;
    if (!clues.length) { setView({ x: (el.clientWidth - BOARD_WIDTH * 0.8) / 2, y: 0, scale: 0.8 }); return; }
    const minX = Math.min(...clues.map(c => c.x)) - 30;
    const minY = Math.min(...clues.map(c => c.y)) - 25;
    const maxX = Math.max(...clues.map(c => c.x + c.width)) + 30;
    const maxY = Math.max(...clues.map(c => c.y + c.height)) + 25;
    const scale = Math.min((el.clientWidth - 88) / (maxX - minX), (el.clientHeight - 110) / (maxY - minY), 1.18);
    setView({ scale: Math.max(0.2, scale), x: (el.clientWidth - (maxX - minX) * scale) / 2 - minX * scale, y: 40 + (el.clientHeight - 110 - (maxY - minY) * scale) / 2 - minY * scale });
  }, [data.clues]);
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const adaptFit = () => {
      if (el.clientWidth < 640 && data.clues.length) {
        const scale = Math.max(0.65, Math.min(0.85, el.clientWidth / 540));
        const first = data.clues[0];
        setView({ scale, x: 24 - first.x * scale, y: Math.max(60, (el.clientHeight - first.height * scale) / 3) - first.y * scale });
      } else fitRef.current();
    };
    const observer = new ResizeObserver(adaptFit); observer.observe(el); adaptFit();
    return () => observer.disconnect();
  }, []);
  useEffect(() => { cancelWire(); setActiveConnectionId(null); }, [cancelWire]);
  const previousMode = useRef(mode);
  useEffect(() => {
    if (mode === 'hand' || (previousMode.current === 'connect' && mode === 'select')) cancelWire();
    previousMode.current = mode;
  }, [mode, cancelWire]);
  useEffect(() => {
    if (!selectedId) return;
    const clue = data.clues.find(c => c.id === selectedId), el = viewport.current;
    if (!clue || !el) return;
    setView(v => {
      const x = clue.x * v.scale + v.x, y = clue.y * v.scale + v.y;
      if (x >= 10 && x + clue.width * v.scale <= el.clientWidth - 10 && y >= 40 && y + clue.height * v.scale <= el.clientHeight - 75) return v;
      return { ...v, x: el.clientWidth / 2 - (clue.x + clue.width / 2) * v.scale, y: (el.clientHeight - 65) / 2 - (clue.y + clue.height / 2) * v.scale };
    });
  }, [selectedId, data.clues]);

  const zoom = useCallback((factor: number, anchor?: Point) => {
    const el = viewport.current;
    if (!el) return;
    setView(v => {
      const scale = Math.min(2, Math.max(0.2, v.scale * factor));
      const cx = anchor?.x ?? el.clientWidth / 2, cy = anchor?.y ?? el.clientHeight / 2;
      return { scale, x: cx - (cx - v.x) * scale / v.scale, y: cy - (cy - v.y) * scale / v.scale };
    });
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('.modal-overlay')) return;
      if (e.code === 'Space') { e.preventDefault(); setSpaceDown(true); }
      if (e.key === '+' || e.key === '=') zoom(1.12);
      if (e.key === '-') zoom(1 / 1.12);
      if (e.key === '0') fitRef.current();
      if (e.key === 'Escape' || (!e.ctrlKey && !e.metaKey && !e.altKey && ['v', 'h'].includes(e.key.toLowerCase()))) { cancelWire(); setActiveConnectionId(null); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceDown(false); };
    const blur = () => { setSpaceDown(false); cancelWire(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [zoom, cancelWire]);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); const r = el.getBoundingClientRect(); zoom(e.deltaY > 0 ? 0.94 : 1.06, { x: e.clientX - r.left, y: e.clientY - r.top }); }
      else { e.preventDefault(); setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })); }
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [zoom]);

  const boardPoint = (clientX: number, clientY: number): Point => {
    const r = viewport.current!.getBoundingClientRect();
    return { x: (clientX - r.left - view.x) / view.scale, y: (clientY - r.top - view.y) / view.scale };
  };
  const targetAt = (clientX: number, clientY: number, source: string): string | null => {
    const element = document.elementFromPoint(clientX, clientY);
    if (element?.closest('.floating-ui')) return null;
    const id = element?.closest<HTMLElement>('.evidence-card')?.dataset.clueId;
    if (id && id !== source && data.clues.some(c => c.id === id && matches(c))) return id;
    const point = boardPoint(clientX, clientY);
    const nearest = data.clues.filter(c => c.id !== source && matches(c)).map(c => ({ id: c.id, distance: Math.hypot(pinPosition(c).x - point.x, pinPosition(c).y - point.y) * view.scale })).sort((a, b) => a.distance - b.distance)[0];
    return nearest?.distance < 28 ? nearest.id : null;
  };
  const updateWire = (clientX: number, clientY: number, from: string) => {
    const targetId = targetAt(clientX, clientY, from);
    const target = data.clues.find(c => c.id === targetId);
    setWire({ from, targetId, point: target ? pinPosition(target) : boardPoint(clientX, clientY) });
  };
  const finishConnection = (from: string, to: string) => {
    if (from === to) { cancelWire(); return; }
    const connection = onConnect(from, to, threadColor);
    cancelWire();
    if (connection) { setActiveConnectionId(connection.id); setShowHint(false); }
  };
  const startFrom = (clue: Clue) => {
    if (mode === 'hand') setMode('select');
    onSelect(null); setActiveConnectionId(null); setFirstConnection(clue.id);
    const pin = pinPosition(clue); setWire({ from: clue.id, targetId: null, point: { x: pin.x + 60, y: pin.y + 55 } });
  };
  const pinDown = (e: ReactPointerEvent<HTMLButtonElement>, clue: Clue) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    if (mode === 'hand') setMode('select');
    onSelect(null); setActiveConnectionId(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    wireDrag.current = { from: clue.id, startX: e.clientX, startY: e.clientY, moved: false };
    setWire({ from: clue.id, targetId: null, point: pinPosition(clue) });
  };
  const pinMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = wireDrag.current;
    if (!d) return;
    e.stopPropagation();
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4) d.moved = true;
    if (d.moved) updateWire(e.clientX, e.clientY, d.from);
  };
  const pinUp = (e: ReactPointerEvent<HTMLButtonElement>, clue: Clue) => {
    e.stopPropagation();
    const d = wireDrag.current;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    wireDrag.current = null;
    if (!d) return;
    if (d.moved) {
      const target = targetAt(e.clientX, e.clientY, d.from);
      if (target) finishConnection(d.from, target);
      else { setFirstConnection(d.from); updateWire(e.clientX, e.clientY, d.from); }
    } else if (firstConnection && firstConnection !== clue.id) finishConnection(firstConnection, clue.id);
    else if (firstConnection === clue.id) cancelWire();
    else startFrom(clue);
  };
  const clickClue = (clue: Clue) => {
    setActiveConnectionId(null);
    if (firstConnection) finishConnection(firstConnection, clue.id);
    else if (mode === 'connect') startFrom(clue);
    else onSelect(clue.id === selectedId ? null : clue.id);
  };
  const cardDown = (e: ReactPointerEvent<HTMLDivElement>, clue: Clue) => {
    if (e.button !== 0 || isPanning) return;
    e.stopPropagation();
    if (isLinking) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: clue.id, startX: e.clientX, startY: e.clientY, x: clue.x, y: clue.y, lastX: clue.x, lastY: clue.y, moved: false };
  };
  const cardMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (firstConnection) updateWire(e.clientX, e.clientY, firstConnection);
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / view.scale, dy = (e.clientY - d.startY) / view.scale;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved) {
      const clue = data.clues.find(c => c.id === d.id);
      d.lastX = Math.max(20, Math.min(BOARD_WIDTH - (clue?.width || 237) - 20, d.x + dx));
      d.lastY = Math.max(25, Math.min(BOARD_HEIGHT - (clue?.height || 246) - 25, d.y + dy));
      setPreview({ id: d.id, x: d.lastX, y: d.lastY });
    }
  };
  const cardUp = (e: ReactPointerEvent<HTMLDivElement>, clue: Clue) => {
    if (isPanning) return;
    e.stopPropagation();
    const d = drag.current;
    if (d?.moved) onMove(clue.id, d.lastX, d.lastY); else clickClue(clue);
    drag.current = null; setPreview(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const boardDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.floating-ui, .pin-handle')) return;
    if (!isPanning && (e.target as HTMLElement).closest('.evidence-card')) return;
    if (!firstConnection) { onSelect(null); setActiveConnectionId(null); }
    e.currentTarget.setPointerCapture(e.pointerId);
    pan.current = { startX: e.clientX, startY: e.clientY, x: view.x, y: view.y, moved: false };
  };
  const addAtCenter = (type: ClueType) => {
    const el = viewport.current!;
    onAdd(type, { x: (el.clientWidth / 2 - view.x) / view.scale, y: ((el.clientHeight - 65) / 2 - view.y) / view.scale });
  };
  const changeTool = (tool: ToolMode) => { cancelWire(); setActiveConnectionId(null); setMode(tool); if (tool === 'connect') onSelect(null); };
  const source = data.clues.find(c => c.id === (firstConnection || wire?.from));
  const target = data.clues.find(c => c.id === wire?.targetId);
  const livePath = source && wire ? ropePath(pinPosition(source), wire.point) : null;
  const activeFrom = renderedClues.find(c => c.id === activeConnection?.from), activeTo = renderedClues.find(c => c.id === activeConnection?.to);
  const activePath = activeFrom && activeTo ? connectionPath(activeFrom, activeTo) : null;
  const editorPosition = { x: Math.max(14, Math.min((viewport.current?.clientWidth || 800) - 284, (activePath?.x || 0) * view.scale + view.x + 16)), y: Math.max(48, Math.min((viewport.current?.clientHeight || 650) - 252, (activePath?.y || 0) * view.scale + view.y + 25)) };

  return <div className="board-stage"><div className="wooden-frame">
    {['tl', 'tr', 'bl', 'br'].map(corner => <span key={corner} className={`frame-screw screw-${corner}`} aria-hidden="true" />)}
    <div ref={viewport} className={`board-viewport ${isPanning ? 'hand-mode' : ''} ${isLinking ? 'connect-mode wiring' : ''}`} onPointerDown={boardDown}
      onPointerMove={e => {
        if (firstConnection && !wireDrag.current && !(e.target as HTMLElement).closest('.floating-ui')) updateWire(e.clientX, e.clientY, firstConnection);
        if (pan.current) { const p = pan.current; if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > 3) p.moved = true; setView(v => ({ ...v, x: p.x + e.clientX - p.startX, y: p.y + e.clientY - p.startY })); }
      }}
      onPointerUp={e => { if (pan.current && !pan.current.moved) { if (firstConnection) cancelWire(); else onSelect(null); } pan.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
      onPointerCancel={() => { pan.current = null; drag.current = null; setPreview(null); cancelWire(); }}>
      <div className="board-grain" /><div className="board-vignette" />
      <div className="board-plaque floating-ui"><span className="plaque-rivet" /><Fingerprint size={17} strokeWidth={1.4} /><span>MURAL PRINCIPAL<small>{data.clues.length} PISTAS · {data.connections.length} FIOS</small></span><span className="plaque-rivet" /></div>
      <div className="board-options floating-ui">{optionsExtra}<button className={showLabels ? 'pressed' : ''} onClick={() => setShowLabels(v => !v)} title="Mostrar ou ocultar nomes das relações" aria-label="Mostrar nomes das relações" aria-pressed={showLabels}>{showLabels ? <Eye size={14} /> : <EyeOff size={14} />}<span>Relações</span></button><button className={minimap ? 'pressed' : ''} onClick={() => setMinimap(v => !v)} title="Mostrar minimapa" aria-label="Mostrar minimapa" aria-pressed={minimap}><Scan size={14} /></button></div>
      <div className="board-canvas" style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        <svg className="thread-layer" width={BOARD_WIDTH} height={BOARD_HEIGHT} overflow="visible" aria-label="Conexões entre as pistas">
          <defs><filter id="thread-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="3" stdDeviation="1.2" floodColor="#42281a" floodOpacity="0.42" /></filter></defs>
          {data.connections.map(connection => {
            const from = renderedClues.find(c => c.id === connection.from), to = renderedClues.find(c => c.id === connection.to);
            if (!from || !to) return null;
            const path = connectionPath(from, to), faded = !matches(from) || !matches(to), active = activeConnectionId === connection.id || hoveredConnection === connection.id;
            const labelWidth = Math.min(208, Math.max(85, connection.label.length * 5.7 + 23));
            const openConnection = () => { cancelWire(); onSelect(null); setActiveConnectionId(connection.id); };
            return <g key={connection.id} className={`thread-group ${active ? 'thread-hover' : ''}`} opacity={faded ? 0.14 : 1}>
              <path d={path.d} fill="none" stroke={connection.color} strokeWidth="3.8" filter="url(#thread-shadow)" className="thread-visible" />
              <path d={path.d} fill="none" stroke="#411d16" strokeWidth="2.5" strokeDasharray="1.2 4" opacity=".2" pointerEvents="none" />
              <path d={path.d} fill="none" stroke="#f0c6a4" strokeWidth=".8" strokeDasharray="6 3" opacity=".55" transform="translate(0,-.8)" pointerEvents="none" />
              <path d={path.d} fill="none" stroke="transparent" strokeWidth="20" className="thread-hit" onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); openConnection(); }} onMouseEnter={() => setHoveredConnection(connection.id)} onMouseLeave={() => setHoveredConnection(null)}><title>{connection.label} — clique para anotar ou cortar</title></path>
              {(showLabels || active) && <g className="rope-label" transform={`translate(${path.x},${path.y}) rotate(-3)`} role="button" tabIndex={0} aria-label={`Editar ligação: ${connection.label}`} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); openConnection(); }} onKeyDown={e => { if (e.key === 'Enter') openConnection(); }}><rect x={-labelWidth / 2} y={-12} width={labelWidth} height={24} rx={1} /><circle cx={-labelWidth / 2 + 7} cy={0} r="2" /><text textAnchor="middle" x={4} y={4}>{connection.label.length > 33 ? `${connection.label.slice(0, 31)}…` : connection.label}</text></g>}
            </g>;
          })}
        </svg>
        {renderedClues.map((clue, index) => <div key={clue.id} role="button" tabIndex={matches(clue) ? 0 : -1} data-clue-id={clue.id} aria-label={`Pista: ${clue.title}. Arraste o cartão para mover. Puxe o alfinete para conectar.`}
          className={`evidence-card evidence-${clue.type} color-${clue.color || 'yellow'} ${selectedId === clue.id ? 'selected' : ''} ${source?.id === clue.id ? 'connection-source' : ''} ${wire?.targetId === clue.id ? 'wire-target' : ''} ${preview?.id === clue.id ? 'dragging' : ''} ${!matches(clue) ? 'filtered-out' : ''}`}
          style={{ left: clue.x, top: clue.y, width: clue.width, height: clue.height, '--rotation': `${clue.rotation}deg` } as CSSProperties}
          onPointerDown={e => cardDown(e, clue)} onPointerMove={cardMove} onPointerUp={e => cardUp(e, clue)} onPointerCancel={() => { drag.current = null; setPreview(null); }}
          onDoubleClick={e => { e.stopPropagation(); if (!isLinking) onEdit(clue); }}
          onKeyDown={e => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter') clickClue(clue); if (e.key === 'F2') onEdit(clue); }}>
          {['person', 'location', 'recording'].includes(clue.type) && <span className="card-tape" />}
          {clue.type === 'checklist' && <span className="paper-clip" aria-hidden="true" />}
          {['note', 'document', 'checklist'].includes(clue.type) && <span className="paper-fold" aria-hidden="true" />}
          <button className="pin-handle" tabIndex={matches(clue) ? 0 : -1} aria-label={`Puxar fio de ${clue.title}`} title="Arraste este alfinete até outra pista. Ou clique e escolha a outra pista." onPointerDown={e => pinDown(e, clue)} onPointerMove={pinMove} onPointerUp={e => pinUp(e, clue)} onPointerCancel={cancelWire} onDoubleClick={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); if (e.detail === 0) { if (firstConnection && firstConnection !== clue.id) finishConnection(firstConnection, clue.id); else if (firstConnection === clue.id) cancelWire(); else startFrom(clue); } }}>
            <span className="pin-halo" /><span className="push-pin"><i />{data.connections.some(c => c.from === clue.id || c.to === clue.id) && <span className="pin-knot" />}</span><span className="pin-tooltip">puxe um fio <Link2 size={12} /></span>
          </button>
          <ClueContent clue={clue} onCheck={itemId => onCheck(clue.id, itemId)} />
          <span className="evidence-index">{String(index + 1).padStart(2, '0')}</span>
          {selectedId === clue.id && !isLinking && <div className="card-quick-actions floating-ui" onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
            <button onClick={e => { e.stopPropagation(); onEdit(clue); }} aria-label={`Editar ${clue.title}`}><Pencil size={13} /><span>Editar</span></button>
            <button className="quick-link" onClick={e => { e.stopPropagation(); startFrom(clue); }} aria-label={`Ligar ${clue.title} a outra pista`}><Link2 size={14} /><span>Ligar</span></button>
            <button onClick={e => { e.stopPropagation(); onDetails(clue); }} aria-label={`Detalhes de ${clue.title}`}><ArrowUpRight size={14} /><span>Detalhes</span></button>
          </div>}
        </div>)}
        {livePath && wire && <svg className="live-thread-layer" width={BOARD_WIDTH} height={BOARD_HEIGHT} overflow="visible" aria-hidden="true"><path d={livePath.d} fill="none" stroke="#3d271b66" strokeWidth="5" transform="translate(1,3)" /><path d={livePath.d} fill="none" stroke={threadColor} strokeWidth="3.8" /><path d={livePath.d} fill="none" stroke="#f5c4a5" strokeWidth=".9" strokeDasharray="5 3" transform="translate(0,-.7)" opacity=".7" /><circle cx={wire.point.x} cy={wire.point.y} r={target ? 13 : 7} fill={target ? '#f9edc7a6' : '#f7e6cc'} stroke={threadColor} strokeWidth="2" /><circle cx={wire.point.x} cy={wire.point.y} r="2.5" fill={threadColor} /></svg>}
      </div>
      {activeConnection && <ThreadEditor key={activeConnection.id} connection={activeConnection} data={data} position={editorPosition} onSave={connection => { onUpdateConnection(connection); setActiveConnectionId(null); }} onCut={() => { onDeleteConnection(activeConnection.id); setActiveConnectionId(null); }} onClose={() => setActiveConnectionId(null)} />}
      {data.clues.length === 0 && <div className="empty-board floating-ui"><div className="empty-board-mark"><Fingerprint size={52} strokeWidth={1} /></div><h2>Todo mistério começa com uma pista.</h2><p>Prenda uma fotografia, um documento ou uma ideia.<br />Depois, puxe um fio para conectar os pontos.</p><button className="primary-button" onClick={() => addAtCenter('note')}><Plus size={17} />Adicionar a primeira pista</button></div>}
      <div className="board-toolbox floating-ui" aria-label="Ferramentas do quadro">
        <span className="tray-screw" />
        <button className={`tray-tool ${mode === 'select' && !spaceDown ? 'active' : ''}`} onClick={() => changeTool('select')} title="Selecionar e mover (V)" aria-label="Selecionar e mover"><MousePointer2 size={20} /><span>Mover</span></button>
        <button className={`tray-tool hand-tool ${isPanning ? 'active' : ''}`} onClick={() => changeTool('hand')} title="Navegar pelo quadro (H ou Espaço)" aria-label="Navegar pelo quadro"><Hand size={21} /><span>Navegar</span></button>
        <span className="tool-divider" />
        <button className={`tray-tool spool-tool ${isLinking ? 'active connect-active' : ''}`} onClick={() => changeTool(mode === 'connect' ? 'select' : 'connect')} title="Clique em duas pistas ou arraste um alfinete (C)" aria-label="Conectar pistas"><SpoolIcon color={threadColor} /><span>Puxar fio</span></button>
        <div className="thread-palette"><span>COR DO FIO</span><div>{THREAD_COLORS.map(color => <button key={color.color} className={threadColor === color.color ? 'chosen' : ''} style={{ '--thread-color': color.color } as CSSProperties} onClick={() => setThreadColor(color.color)} title={`${color.label} · ${color.meaning}`} aria-label={`Usar fio ${color.label}`} aria-pressed={threadColor === color.color}><i />{threadColor === color.color && <Check size={9} />}</button>)}</div></div>
        <span className="tool-divider" />
        <button className="tray-tool" onClick={() => addAtCenter('note')} title="Nova anotação (N)" aria-label="Nova anotação"><span className="tool-paper tool-sticky"><StickyNote size={18} /></span><span>Nota</span></button>
        <button className="tray-tool" onClick={() => addAtCenter('person')} title="Adicionar fotografia" aria-label="Adicionar fotografia"><span className="tool-paper tool-polaroid"><ImagePlus size={18} /></span><span>Foto</span></button>
        <button className="tray-tool" onClick={() => addAtCenter('document')} title="Adicionar documento" aria-label="Adicionar documento"><span className="tool-paper tool-document"><FileText size={18} /></span><span>Documento</span></button>
        <span className="tool-divider" />
        <div className="tray-history"><button onClick={onUndo} disabled={!canUndo} title="Desfazer (Ctrl+Z)" aria-label="Desfazer"><Undo2 size={17} /></button><button onClick={onRedo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer"><Redo2 size={17} /></button></div>
        <span className="tray-screw" />
      </div>
      {showHint && !isLinking && <div className="connection-guide floating-ui"><span className="guide-pin" /><button onClick={() => setShowHint(false)} title="Guardar lembrete" aria-label="Guardar lembrete"><X size={11} /></button><span className="guide-kicker">UM FIO, UMA DESCOBERTA</span><strong>É só puxar o alfinete.</strong><p>Arraste até outra pista para ligar.</p><span className="guide-arrow"><svg viewBox="0 0 80 24"><path d="M3 20Q45 30 67 4m-10 2 11-3-2 11" /></svg></span></div>}
      {isLinking && <div className="connection-hint floating-ui" role="status"><SpoolIcon color={threadColor} /><span>{source ? <><b>{source.title}</b><small>{target ? `Solte para ligar a ${target.title}` : wireDrag.current?.moved ? 'Leve o fio até outra pista e solte' : 'Clique em outra pista para prender o fio'}</small></> : <><b>Conecte duas pistas</b><small>Clique em duas pistas ou puxe um alfinete.</small></>}</span><button onClick={() => { cancelWire(); setMode('select'); }} aria-label="Cancelar conexão"><X size={15} /></button></div>}
      {minimap && <button className="minimap floating-ui" onClick={fit} title="Centralizar o quadro" aria-label="Centralizar o quadro pelo minimapa"><svg viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}>{data.connections.map(c => { const a = data.clues.find(n => n.id === c.from), b = data.clues.find(n => n.id === c.to); return a && b ? <path key={c.id} d={connectionPath(a, b).d} stroke={c.color} strokeWidth={9} fill="none" /> : null; })}{data.clues.map(c => <rect key={c.id} x={c.x} y={c.y} width={c.width} height={c.height} fill={c.type === 'note' ? '#e4ca80' : '#f4f1e5'} stroke="#9c907a" strokeWidth="4" />)}</svg><span>O QUADRO INTEIRO <Scan size={10} /></span></button>}
      <div className="zoom-controls floating-ui"><button onClick={() => zoom(1 / 1.15)} title="Diminuir zoom (-)" aria-label="Diminuir zoom"><Minus size={16} /></button><button className="zoom-value" onClick={fit} title="Ajustar à tela (0)">{Math.round(view.scale * 100)}<span>%</span></button><button onClick={() => zoom(1.15)} title="Aumentar zoom (+)" aria-label="Aumentar zoom"><Plus size={16} /></button><span /><button onClick={fit} title="Ajustar quadro à tela (0)" aria-label="Ajustar quadro à tela"><Scan size={17} /></button><button onClick={() => { if (!document.fullscreenElement) viewport.current?.parentElement?.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.(); }} title="Tela cheia" aria-label="Tela cheia"><Maximize size={16} /></button></div>
    </div>
  </div></div>;
}
