import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, Check, ChevronDown, ChevronUp, CircleHelp, Clock3, CloudCheck, Fingerprint, FolderCheck, FolderOpen, LayoutDashboard, Link2, Maximize2, Minimize2, MoreHorizontal, Network, Pencil, Plus, RotateCcw, Search, Share2, ShieldCheck, SlidersHorizontal, Trash2, Upload, X } from 'lucide-react';
import { type Clue, type ClueType, type Connection, type Investigation, type Page, type TimelineEvent, type ToolMode, createClue, initialCases, newId, typeLabels } from './data';
import Board, { SpoolIcon } from './components/Board';
import { Files, Inspector, Overview, SearchResults, Timeline, clueIcons } from './components/Views';
import Modal from './components/Modal';
import { CaseEditor, ClueEditor, EventEditor, HelpPanel, SharePanel } from './components/Dialogs';

const STORAGE_KEY = 'nexo-workspace-v1';
type ModalState =
  | { kind: 'clue'; clue: Clue; isNew: boolean }
  | { kind: 'case'; editing: boolean }
  | { kind: 'event'; event?: TimelineEvent }
  | { kind: 'share' }
  | { kind: 'help' }
  | { kind: 'search' }
  | { kind: 'confirm'; title: string; description: string; confirmLabel: string; action: () => void };
type Workspace = { cases: Investigation[]; activeId: string };
type History = { past: Investigation[]; future: Investigation[] };

function parseCase(value: unknown): Investigation | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<Investigation>;
  if (typeof raw.name !== 'string' || !raw.name.trim() || !Array.isArray(raw.clues) || !Array.isArray(raw.connections)) return null;
  const clues = raw.clues.slice(0, 300).filter(n => n && typeof n.title === 'string' && Object.keys(typeLabels).includes(n.type)).map(n => ({
    ...createClue(n.type), ...n,
    id: typeof n.id === 'string' ? n.id : newId(),
    title: n.title.slice(0, 100), subtitle: typeof n.subtitle === 'string' ? n.subtitle : '', content: typeof n.content === 'string' ? n.content : '',
    x: Number.isFinite(n.x) ? n.x : 450, y: Number.isFinite(n.y) ? n.y : 250,
    width: Number.isFinite(n.width) ? Math.max(120, Math.min(550, n.width)) : 237,
    height: Number.isFinite(n.height) ? Math.max(120, Math.min(700, n.height)) : 246,
    rotation: Number.isFinite(n.rotation) ? n.rotation : 0,
    image: typeof n.image === 'string' ? n.image : undefined,
    imagePosition: typeof n.imagePosition === 'string' ? n.imagePosition : undefined,
    fileData: typeof n.fileData === 'string' ? n.fileData : undefined,
    fileName: typeof n.fileName === 'string' ? n.fileName : undefined,
    badge: typeof n.badge === 'string' ? n.badge.slice(0, 45) : undefined,
    color: typeof n.color === 'string' && ['yellow', 'pink', 'blue', 'cream'].includes(n.color) ? n.color : 'yellow',
    tags: Array.isArray(n.tags) ? n.tags.filter(t => typeof t === 'string').slice(0, 10) : [],
    items: Array.isArray(n.items) ? n.items.filter(i => i && typeof i.text === 'string').map(i => ({ id: typeof i.id === 'string' ? i.id : newId(), text: i.text, done: Boolean(i.done) })) : undefined,
    createdAt: n.createdAt && !isNaN(new Date(n.createdAt).getTime()) ? n.createdAt : new Date().toISOString(),
  }));
  const ids = new Set(clues.map(n => n.id));
  return {
    id: typeof raw.id === 'string' ? raw.id : newId(), name: raw.name.slice(0, 70), number: typeof raw.number === 'string' ? raw.number : '0001',
    description: typeof raw.description === 'string' ? raw.description : '', status: raw.status === 'closed' ? 'closed' : 'active',
    createdAt: raw.createdAt && !isNaN(new Date(raw.createdAt).getTime()) ? raw.createdAt : new Date().toISOString(),
    updatedAt: raw.updatedAt && !isNaN(new Date(raw.updatedAt).getTime()) ? raw.updatedAt : new Date().toISOString(),
    clues,
    connections: raw.connections.filter(c => c && ids.has(c.from) && ids.has(c.to)).map(c => ({ id: typeof c.id === 'string' ? c.id : newId(), from: c.from, to: c.to, label: typeof c.label === 'string' ? c.label.slice(0, 80) : 'Relacionado a', color: typeof c.color === 'string' && /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#a13d35' })),
    events: Array.isArray(raw.events) ? raw.events.filter(e => e && typeof e.title === 'string' && !isNaN(new Date(e.date).getTime())).map(e => ({ id: typeof e.id === 'string' ? e.id : newId(), title: e.title.slice(0, 120), date: new Date(e.date).toISOString(), description: typeof e.description === 'string' ? e.description : '', clueId: typeof e.clueId === 'string' && ids.has(e.clueId) ? e.clueId : undefined })) : [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks.filter(t => t && typeof t.text === 'string').map(t => ({ id: typeof t.id === 'string' ? t.id : newId(), text: t.text, done: Boolean(t.done) })) : [],
  };
}
function loadWorkspace(): Workspace {
  let result: Workspace = { cases: structuredClone(initialCases), activeId: 'aurora' };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const cases = Array.isArray(parsed.cases) ? parsed.cases.map(parseCase).filter((c: Investigation | null): c is Investigation => Boolean(c)) : [];
      if (cases.length) result = { cases, activeId: cases.some((c: Investigation) => c.id === parsed.activeId) ? parsed.activeId : cases[0].id };
    }
  } catch { /* A fresh workspace is available if local data cannot be read. */ }
  try {
    const shared = new URLSearchParams(window.location.hash.slice(1)).get('caso');
    if (shared) {
      const incoming = parseCase(JSON.parse(shared));
      if (incoming) {
        incoming.id = `shared-${newId()}`;
        result = { cases: [...result.cases, incoming], activeId: incoming.id };
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
    }
  } catch { /* Invalid sharing links do not replace local cases. */ }
  return result;
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\\/:*?"<>|]/g, '_');
  a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function BrandMark() {
  return <svg className="brand-mark" width={34} height={34} viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M7 8L29 10 12 29 7 8ZM29 10L28 28 7 8" stroke="currentColor" strokeWidth="1.4" /><circle cx="7" cy="8" r="3.1" fill="currentColor" /><circle cx="29" cy="10" r="3.1" fill="currentColor" /><circle cx="12" cy="29" r="3.1" fill="currentColor" /><circle cx="28" cy="28" r="2.5" fill="currentColor" /></svg>;
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(loadWorkspace);
  const { cases, activeId } = workspace;
  const activeCase = cases.find(c => c.id === activeId) || cases[0];
  const [page, setPage] = useState<Page>('board');
  const [mode, setMode] = useState<ToolMode>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [boardFocus, setBoardFocus] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [dropdown, setDropdown] = useState<'add' | 'filter' | 'case' | 'profile' | null>(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [toast, setToast] = useState<{ text: string; undo?: boolean } | null>(null);
  const history = useRef<Record<string, History>>({});
  const [, setHistoryVersion] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const closeModal = useCallback(() => setModal(null), []);
  const selectedClue = activeCase.clues.find(c => c.id === selectedId);
  const fileCount = activeCase.clues.filter(c => c.image || c.fileData || c.type === 'document').length;
  const currentHistory = history.current[activeCase.id];

  const showToast = useCallback((text: string, undo = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, undo });
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    setSaveState('saving');
    const persist = () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)); setSaveState('saved'); }
      catch { setSaveState('error'); }
    };
    const timer = setTimeout(persist, 400);
    const flush = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)); } catch { /* The workspace can still be exported. */ } };
    window.addEventListener('pagehide', flush); window.addEventListener('beforeunload', flush);
    return () => { clearTimeout(timer); window.removeEventListener('pagehide', flush); window.removeEventListener('beforeunload', flush); };
  }, [workspace]);
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.dropdown-anchor')) setDropdown(null); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);

  const updateCase = (recipe: (c: Investigation) => Investigation) => {
    const h = history.current[activeCase.id] || { past: [], future: [] };
    h.past.push(structuredClone(activeCase)); if (h.past.length > 40) h.past.shift(); h.future = [];
    history.current[activeCase.id] = h;
    const next = recipe(structuredClone(activeCase)); next.updatedAt = new Date().toISOString();
    setWorkspace(prev => ({ ...prev, cases: prev.cases.map(c => c.id === activeCase.id ? next : c) }));
    setHistoryVersion(v => v + 1);
  };
  const undo = () => {
    const h = history.current[activeCase.id]; if (!h?.past.length) return;
    const previous = h.past.pop()!; h.future.push(structuredClone(activeCase));
    setWorkspace(prev => ({ ...prev, cases: prev.cases.map(c => c.id === activeCase.id ? previous : c) }));
    setHistoryVersion(v => v + 1); showToast('Última alteração desfeita.');
  };
  const redo = () => {
    const h = history.current[activeCase.id]; if (!h?.future.length) return;
    const next = h.future.pop()!; h.past.push(structuredClone(activeCase));
    setWorkspace(prev => ({ ...prev, cases: prev.cases.map(c => c.id === activeCase.id ? next : c) }));
    setHistoryVersion(v => v + 1); showToast('Alteração refeita.');
  };
  const navigate = (next: Page) => { setPage(next); setSelectedId(null); setDetailsOpen(false); setDropdown(null); setMobileSidebar(false); setMode('select'); };
  const selectCase = (id: string) => {
    setWorkspace(prev => ({ ...prev, activeId: id })); setPage('board'); setSelectedId(null); setDetailsOpen(false); setFilter('all'); setMode('select'); setDropdown(null); setMobileSidebar(false);
  };
  const selectOnBoard = (id: string | null) => { setSelectedId(id); setDetailsOpen(false); };
  const focusClue = (id: string) => { setPage('board'); setSelectedId(id); setDetailsOpen(false); setMode('select'); setFilter('all'); closeModal(); };
  const openAdd = (type: ClueType, point?: { x: number; y: number }) => {
    const clue = createClue(type);
    if (point) { clue.x = Math.max(25, Math.min(1255 - clue.width, point.x - clue.width / 2)); clue.y = Math.max(30, Math.min(765 - clue.height, point.y - clue.height / 2)); }
    setDropdown(null); setModal({ kind: 'clue', clue, isNew: true });
  };
  const openSearch = () => { setSearchQuery(''); setDropdown(null); setModal({ kind: 'search' }); };
  const exportCase = () => {
    downloadBlob(new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), cases: [activeCase] }, null, 2)], { type: 'application/json' }), `nexo-${activeCase.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`);
    setDropdown(null); showToast('Investigação exportada. Guarde sua cópia.');
  };
  const downloadClue = async (clue: Clue) => {
    try {
      if (clue.fileData || clue.image) {
        const response = await fetch(clue.fileData || clue.image!); if (!response.ok) throw new Error('file');
        downloadBlob(await response.blob(), clue.fileName || `${clue.title.toLowerCase().replace(/\s+/g, '_')}.jpg`);
      } else {
        const content = `${activeCase.name}\nCASO Nº ${activeCase.number}\n\n${clue.title.toUpperCase()}\n${clue.subtitle}\n\n${clue.content}\n\nTranscrição exportada pelo Nexo · ${new Date().toLocaleString('pt-BR')}`;
        downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), `${clue.title.toLowerCase().replace(/\s+/g, '_')}.txt`);
      }
      showToast('Arquivo pronto. Confira seus downloads.');
    } catch { showToast('Não foi possível baixar este arquivo. Tente novamente.'); }
  };
  const copyText = async (text: string) => {
    if (text.length > 200000) { showToast('Este caso tem anexos grandes. Exporte o arquivo .json para compartilhar.'); return false; }
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const textarea = document.createElement('textarea'); textarea.value = text; textarea.style.position = 'fixed'; textarea.style.opacity = '0'; document.body.appendChild(textarea); textarea.select();
      const copied = document.execCommand('copy'); textarea.remove(); if (!copied) showToast('Selecione o link e copie com Ctrl+C.'); return copied;
    }
  };
  const deleteClue = (clue: Clue) => setModal({
    kind: 'confirm', title: 'Retirar esta pista?', description: `“${clue.title}” e seus fios serão removidos do mural. Os eventos da linha do tempo serão mantidos. Você pode desfazer esta ação.`, confirmLabel: 'Excluir pista',
    action: () => {
      updateCase(c => ({ ...c, clues: c.clues.filter(n => n.id !== clue.id), connections: c.connections.filter(n => n.from !== clue.id && n.to !== clue.id), events: c.events.map(e => e.clueId === clue.id ? { ...e, clueId: undefined } : e) }));
      setSelectedId(null); setDetailsOpen(false); closeModal(); showToast('Pista retirada do mural.', true);
    },
  });
  const importFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { showToast('Escolha um arquivo de investigação com até 15 MB.'); return; }
    try {
      const parsed = JSON.parse(await file.text());
      const rawCases = Array.isArray(parsed.cases) ? parsed.cases : [parsed];
      const imported = rawCases.map(parseCase).filter((c: Investigation | null): c is Investigation => Boolean(c)).map((c: Investigation) => ({ ...c, id: newId() }));
      if (!imported.length) throw new Error('invalid');
      setWorkspace(prev => ({ cases: [...prev.cases, ...imported], activeId: imported[0].id }));
      setPage('board'); setSelectedId(null); setDetailsOpen(false); setFilter('all'); setDropdown(null); showToast(`${imported.length === 1 ? 'Investigação importada' : `${imported.length} investigações importadas`} com sucesso.`);
    } catch { showToast('Arquivo inválido. Importe uma investigação .json exportada pelo Nexo.'); }
    if (importRef.current) importRef.current.value = '';
  };
  const newCase = (name: string, description: string, status: 'active' | 'closed') => {
    if (modal?.kind === 'case' && modal.editing) updateCase(c => ({ ...c, name, description, status }));
    else {
      const id = newId(), now = new Date().toISOString();
      const number = String(Math.max(...cases.map(c => Number(c.number) || 0), 0) + 1).padStart(4, '0');
      const investigation: Investigation = { id, name, number, description, status, createdAt: now, updatedAt: now, clues: [], connections: [], events: [], tasks: [] };
      setWorkspace(prev => ({ cases: [...prev.cases, investigation], activeId: id })); setPage('board'); setSelectedId(null); setDetailsOpen(false); setFilter('all');
    }
    closeModal(); showToast(modal?.kind === 'case' && modal.editing ? 'Dossiê atualizado.' : 'Uma nova investigação começa agora.');
  };
  const saveClue = (clue: Clue) => {
    const isNew = modal?.kind === 'clue' && modal.isNew;
    updateCase(c => ({ ...c, clues: isNew ? [...c.clues, clue] : c.clues.map(n => n.id === clue.id ? clue : n) }));
    closeModal(); setPage('board'); setMode('select'); setSelectedId(clue.id); setDetailsOpen(false); setFilter('all'); showToast(isNew ? 'Nova pista presa ao mural.' : 'Pista atualizada.');
  };
  const addConnection = (from: string, to: string, color = '#a13d35'): Connection | null => {
    if (from === to || !activeCase.clues.some(c => c.id === from) || !activeCase.clues.some(c => c.id === to)) return null;
    const existing = activeCase.connections.find(c => (c.from === from && c.to === to) || (c.from === to && c.to === from));
    if (existing) { showToast('O fio já existe. Você pode anotar a relação.'); return existing; }
    const connection: Connection = { id: newId(), from, to, label: 'Relacionado a', color };
    updateCase(c => ({ ...c, connections: [...c.connections, connection] }));
    showToast('Fio preso! Anote a relação no próprio quadro.'); return connection;
  };
  const saveEvent = (event: TimelineEvent) => {
    updateCase(c => ({ ...c, events: c.events.some(e => e.id === event.id) ? c.events.map(e => e.id === event.id ? event : e) : [...c.events, event] }));
    closeModal(); showToast('Linha do tempo atualizada.');
  };
  const deleteInvestigation = () => {
    setDropdown(null);
    setModal({ kind: 'confirm', title: 'Excluir esta investigação?', description: `Todas as pistas, fios e eventos de “${activeCase.name}” serão excluídos deste dispositivo. Exporte uma cópia antes de continuar.`, confirmLabel: 'Excluir investigação', action: () => {
      const remaining = cases.filter(c => c.id !== activeCase.id);
      if (!remaining.length) { const id = newId(), now = new Date().toISOString(); remaining.push({ id, name: 'Minha investigação', number: '0001', description: '', status: 'active', clues: [], connections: [], events: [], tasks: [], createdAt: now, updatedAt: now }); }
      setWorkspace({ cases: remaining, activeId: remaining[0].id }); setSelectedId(null); setDetailsOpen(false); setPage('board'); setFilter('all'); closeModal(); showToast('Investigação excluída.');
    } });
  };

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (modal) return;
      const isInput = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); return; }
      if (isInput) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (e.key === 'Escape') { setSelectedId(null); setDetailsOpen(false); setDropdown(null); setMode('select'); setMobileSidebar(false); }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key.toLowerCase() === 'n') { e.preventDefault(); openAdd('note'); }
        if (page === 'board') {
          if (e.key.toLowerCase() === 'v') setMode('select');
          if (e.key.toLowerCase() === 'h') setMode('hand');
          if (e.key.toLowerCase() === 'c') { setMode('connect'); setSelectedId(null); setDetailsOpen(false); }
          if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClue) { e.preventDefault(); deleteClue(selectedClue); }
        }
      }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  });

  const navItems = [
    { page: 'board' as Page, icon: Network, label: 'Quadro de pistas', count: activeCase.clues.length },
    { page: 'overview' as Page, icon: LayoutDashboard, label: 'Visão geral' },
    { page: 'timeline' as Page, icon: Clock3, label: 'Linha do tempo' },
    { page: 'files' as Page, icon: FolderOpen, label: 'Arquivos do caso', count: fileCount },
  ];
  const shareLink = `${window.location.origin}${window.location.pathname}#caso=${encodeURIComponent(JSON.stringify(activeCase))}`;

  return <div className={`app-shell board-focused ${boardFocus && page === 'board' ? 'focus-mode' : ''}`}>
    {mobileSidebar && <button className="sidebar-backdrop" onClick={() => setMobileSidebar(false)} aria-label="Fechar menu lateral" />}
    <aside className={`sidebar ${mobileSidebar ? 'mobile-open' : ''}`} aria-label="Armário de investigações" inert={!mobileSidebar}>
      <button className="brand" onClick={() => navigate('board')} aria-label="Nexo — voltar ao mural"><BrandMark /><span>nexo<span className="brand-period">.</span></span></button>
      <span className="brand-tagline">UM FIO, UMA DESCOBERTA.</span>
      <button className="sidebar-search" onClick={() => { openSearch(); setMobileSidebar(false); }}><Search size={16} /><span>Buscar no caso...</span><kbd>⌘ K</kbd></button>
      <div className="sidebar-section-label">O DOSSIÊ DA INVESTIGAÇÃO</div>
      <nav className="main-nav" aria-label="Navegação principal">{navItems.map(item => <button key={item.page} className={page === item.page ? 'active' : ''} onClick={() => navigate(item.page)}><item.icon size={18} strokeWidth={1.6} /><span>{item.label}</span>{item.count !== undefined && <span className="nav-count">{item.count.toString().padStart(2, '0')}</span>}</button>)}</nav>
      <div className="cases-section">
        <div className="sidebar-section-label"><span>SUAS INVESTIGAÇÕES</span><span className="sidebar-case-count">{cases.length}</span></div>
        <div className="case-list">{cases.map(c => <button key={c.id} onClick={() => selectCase(c.id)} className={`case-item ${activeCase.id === c.id ? 'active' : ''}`}><span className={`case-item-icon ${c.status === 'closed' ? 'case-closed' : ''}`}>{c.status === 'closed' ? <FolderCheck size={18} strokeWidth={1.5} /> : <FolderOpen size={18} strokeWidth={1.5} />}</span><span><b>{c.name}</b><small>CASO Nº {c.number}</small></span>{activeCase.id === c.id && <span className="case-active-dot" />}</button>)}</div>
        <button className="new-case-button" onClick={() => { setModal({ kind: 'case', editing: false }); setMobileSidebar(false); }}><Plus size={16} />Nova investigação</button>
      </div>
      <div className="sidebar-spacer" />
      <div className="sidebar-quote"><svg viewBox="0 0 140 31"><path d="M2 24C26 26 15 0 39 10S74 30 100 13S132 5 136 12" /><circle cx="2" cy="24" r="2.5" /><circle cx="136" cy="12" r="2.5" /></svg><p>Toda pista leva<br />a algum lugar.</p><span>CONFIE NO SEU INSTINTO.</span></div>
      <button className="sidebar-help" onClick={() => { setModal({ kind: 'help' }); setDropdown(null); setMobileSidebar(false); }}><CircleHelp size={16} /><span>Um fio de ajuda</span><ArrowUpRight size={13} /></button>
      <div className="profile-area dropdown-anchor">
        <button className="profile-button" onClick={() => setDropdown(dropdown === 'profile' ? null : 'profile')}><span className="avatar profile-avatar">LC<span /></span><span className="profile-info"><b>Luiza Costa</b><small>Espaço pessoal</small></span>{dropdown === 'profile' ? <ChevronDown size={15} /> : <ChevronUp size={15} />}</button>
        {dropdown === 'profile' && <div className="dropdown profile-dropdown"><div className="dropdown-caption"><ShieldCheck size={13} />Dados neste dispositivo</div><button onClick={() => { setModal({ kind: 'help' }); setDropdown(null); }}><CircleHelp size={15} />Ajuda e atalhos</button><button onClick={exportCase}><ArrowDownToLine size={15} />Exportar este caso</button><button onClick={() => { importRef.current?.click(); setDropdown(null); }}><Upload size={15} />Importar investigação</button><div className="dropdown-divider" /><button onClick={() => {
          setDropdown(null); setModal({ kind: 'confirm', title: 'Recomeçar os casos de exemplo?', description: 'Suas investigações atuais serão substituídas pelos dois casos de exemplo. Exporte seus casos antes de continuar. Esta ação não pode ser desfeita.', confirmLabel: 'Restaurar exemplos', action: () => { history.current = {}; setWorkspace({ cases: structuredClone(initialCases), activeId: 'aurora' }); setSelectedId(null); setDetailsOpen(false); setMobileSidebar(false); setPage('board'); setFilter('all'); closeModal(); showToast('Casos de exemplo restaurados.'); } });
        }}><RotateCcw size={15} />Restaurar exemplos</button></div>}
      </div>
    </aside>
    <main className="workspace">
      <header className="workspace-header">
        <div className="desk-brand"><button className="brand" onClick={() => navigate('board')} aria-label="Nexo — mural principal"><BrandMark /><span>nexo<span className="brand-period">.</span></span></button><button className="cabinet-button" onClick={() => setMobileSidebar(true)} aria-label="Abrir menu" title="Abrir armário de investigações"><FolderOpen size={15} /><span>Investigações</span><ChevronDown size={11} /></button></div>
        <div className="case-title-area"><div>
          <div className="breadcrumb"><span>ARQUIVO DE INVESTIGAÇÃO</span><ChevronDown size={10} className="breadcrumb-chevron" /><span>CASO Nº {activeCase.number}</span></div>
          <div className="case-title-line"><h1>{activeCase.name}</h1><span className={`status-pill ${activeCase.status === 'closed' ? 'closed' : ''}`}><i />{activeCase.status === 'active' ? 'Em andamento' : 'Encerrado'}</span>
            <div className="dropdown-anchor case-actions"><button className="icon-button" onClick={() => setDropdown(dropdown === 'case' ? null : 'case')} aria-label="Ações da investigação" title="Ações da investigação"><MoreHorizontal size={19} /></button>
              {dropdown === 'case' && <div className="dropdown case-dropdown"><button onClick={() => { setDropdown(null); setModal({ kind: 'case', editing: true }); }}><Pencil size={15} />Editar investigação</button><button onClick={exportCase}><ArrowDownToLine size={15} />Exportar caso</button><button onClick={() => { updateCase(c => ({ ...c, status: c.status === 'active' ? 'closed' : 'active' })); setDropdown(null); showToast(activeCase.status === 'active' ? 'Caso marcado como encerrado.' : 'Investigação reaberta.'); }}><FolderCheck size={15} />{activeCase.status === 'active' ? 'Encerrar investigação' : 'Reabrir investigação'}</button><div className="dropdown-divider" /><button className="danger-text" onClick={deleteInvestigation}><Trash2 size={15} />Excluir investigação</button></div>}
            </div>
          </div>
        </div></div>
        <div className="header-actions"><div className="header-save"><CloudCheck size={15} /><span>{saveState === 'saving' ? 'Salvando...' : saveState === 'error' ? 'Salvo na sessão' : 'Tudo salvo'}</span></div><button className="primary-button share-button" onClick={() => setModal({ kind: 'share' })}><Share2 size={15} /><span>Compartilhar</span></button></div>
      </header>
      <div className="workspace-tabs">
        <nav className="view-tabs" aria-label="Visualizações da investigação"><button className={page === 'board' ? 'active' : ''} onClick={() => navigate('board')}><Network size={16} /><span>Quadro de pistas</span></button><button className={page === 'timeline' ? 'active' : ''} onClick={() => navigate('timeline')}><Clock3 size={16} /><span>Linha do tempo</span></button><button className={page === 'files' ? 'active' : ''} onClick={() => navigate('files')}><FolderOpen size={16} /><span>Arquivos</span><span className="tab-count">{fileCount}</span></button></nav>
        {page === 'board' && <span className="board-connection-instruction"><Link2 size={13} />Puxe um alfinete até outra pista para conectar.</span>}
        <div className="view-actions">
          <button className="icon-button tab-search-button" onClick={openSearch} title="Buscar pistas (Ctrl+K)" aria-label="Buscar pistas"><Search size={17} /></button>
          {page === 'board' && <>
            <button className={`board-connect-button ${mode === 'connect' ? 'active' : ''}`} onClick={() => { setMode(mode === 'connect' ? 'select' : 'connect'); setSelectedId(null); setDetailsOpen(false); }} aria-label="Ligar pistas" aria-pressed={mode === 'connect'} title="Ligar pistas (C): clique em duas pistas ou arraste um alfinete"><SpoolIcon /><span>Ligar pistas</span></button>
            <div className="dropdown-anchor filter-anchor"><button className={`filter-button ${filter !== 'all' ? 'has-filter' : ''}`} onClick={() => setDropdown(dropdown === 'filter' ? null : 'filter')} aria-label="Filtrar"><SlidersHorizontal size={15} /><span>Filtrar</span>{filter !== 'all' && <i />}</button>
              {dropdown === 'filter' && <div className="dropdown filter-dropdown"><div className="dropdown-label">MOSTRAR NO MURAL</div>{[{ value: 'all', label: 'Todas as pistas', icon: Fingerprint }, ...Object.entries(typeLabels).map(([value, label]) => ({ value, label, icon: clueIcons[value as ClueType] }))].map(option => <button key={option.value} className={filter === option.value ? 'is-selected' : ''} onClick={() => { setFilter(option.value); setDropdown(null); }}><option.icon size={15} />{option.label}<span className="dropdown-option-count">{option.value === 'all' ? activeCase.clues.length : activeCase.clues.filter(c => c.type === option.value).length}</span>{filter === option.value && <Check size={13} />}</button>)}<div className="dropdown-caption">As outras pistas ficam esmaecidas.</div></div>}
            </div>
            <span className="actions-separator" />
            <div className="dropdown-anchor add-anchor"><button className="primary-button add-clue-button" onClick={() => setDropdown(dropdown === 'add' ? null : 'add')} aria-label="Adicionar pista"><Plus size={16} /><span>Adicionar pista</span><ChevronDown size={12} /></button>
              {dropdown === 'add' && <div className="dropdown add-dropdown"><div className="dropdown-label">PRENDA MAIS UMA PISTA</div>{(Object.keys(typeLabels) as ClueType[]).map(type => { const Icon = clueIcons[type]; return <button key={type} onClick={() => openAdd(type)}><Icon size={16} /><span>{typeLabels[type]}</span><Plus size={12} /></button>; })}</div>}
            </div>
            <button className="focus-board-button" onClick={() => setBoardFocus(v => !v)} aria-label={boardFocus ? 'Sair do modo foco' : 'Modo foco'} title={boardFocus ? 'Voltar à mesa de investigação' : 'Dar mais espaço ao mural'}>{boardFocus ? <Minimize2 size={15} /> : <Maximize2 size={15} />}<span>{boardFocus ? 'Voltar' : 'Foco'}</span></button>
          </>}
        </div>
      </div>
      <div className="workspace-body">
        {page === 'board' && <Board key={activeCase.id} investigation={activeCase} mode={mode} setMode={setMode} selectedId={selectedId} onSelect={selectOnBoard}
          onEdit={clue => setModal({ kind: 'clue', clue, isNew: false })} onDetails={clue => { setSelectedId(clue.id); setDetailsOpen(true); }}
          onMove={(id, x, y) => updateCase(c => ({ ...c, clues: c.clues.map(n => n.id === id ? { ...n, x, y } : n) }))}
          onConnect={addConnection}
          onUpdateConnection={connection => { updateCase(c => ({ ...c, connections: c.connections.map(n => n.id === connection.id ? connection : n) })); showToast('Relação anotada.'); }}
          onDeleteConnection={id => { updateCase(c => ({ ...c, connections: c.connections.filter(n => n.id !== id) })); showToast('Fio cortado.', true); }}
          onCheck={(clueId, itemId) => updateCase(c => ({ ...c, clues: c.clues.map(n => n.id === clueId ? { ...n, items: n.items?.map(i => i.id === itemId ? { ...i, done: !i.done } : i) } : n) }))}
          onAdd={openAdd} onUndo={undo} onRedo={redo} canUndo={Boolean(currentHistory?.past.length)} canRedo={Boolean(currentHistory?.future.length)} filter={filter} />}
        {page === 'overview' && <Overview investigation={activeCase} onPage={navigate} onSelect={setSelectedId} onEditCase={() => setModal({ kind: 'case', editing: true })} onToggleTask={id => updateCase(c => ({ ...c, tasks: c.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t), clues: c.clues.map(n => n.items ? { ...n, items: n.items.map(i => i.id === id ? { ...i, done: !i.done } : i) } : n) }))} />}
        {page === 'timeline' && <Timeline key={activeCase.id} investigation={activeCase} onAdd={() => setModal({ kind: 'event' })} onEdit={event => setModal({ kind: 'event', event })} onSelect={focusClue} />}
        {page === 'files' && <Files key={activeCase.id} investigation={activeCase} onAdd={() => openAdd('document')} onSelect={id => { setSelectedId(id); setDetailsOpen(true); }} onDownload={downloadClue} />}
        {selectedClue && detailsOpen && <Inspector key={selectedClue.id} clue={selectedClue} investigation={activeCase} onClose={() => setDetailsOpen(false)} onEdit={() => setModal({ kind: 'clue', clue: selectedClue, isNew: false })} onDelete={() => deleteClue(selectedClue)} onSelect={setSelectedId} onDownload={() => downloadClue(selectedClue)} />}
      </div>
      <footer className="workspace-footer"><div><span className={`save-indicator ${saveState === 'error' ? 'error' : ''}`} />{saveState === 'saved' ? 'Todas as alterações salvas' : saveState === 'saving' ? 'Salvando alterações...' : 'Armazenamento cheio · exporte seu caso'}<span className="footer-divider" /><span>{activeCase.clues.length} pistas</span><span className="footer-middle-dot">·</span><span>{activeCase.connections.length} fios</span></div><div><span className="footer-instructions">{page === 'board' ? 'Puxe um alfinete para ligar · Arraste cartões para organizar' : 'Toda pista leva a algum lugar.'}</span><button onClick={() => setModal({ kind: 'help' })} aria-label="Abrir ajuda e atalhos" title="Ajuda e atalhos"><CircleHelp size={14} /></button></div></footer>
    </main>
    <input className="visually-hidden" type="file" accept="application/json,.json" ref={importRef} onChange={e => importFile(e.target.files?.[0])} />
    {toast && <div className="toast" role="status"><span className="toast-check"><Check size={13} /></span><span>{toast.text}</span>{toast.undo && <button onClick={undo} aria-label="Desfazer última ação">Desfazer</button>}<button className="toast-close" onClick={() => setToast(null)} aria-label="Fechar notificação"><X size={13} /></button></div>}
    {modal?.kind === 'clue' && <Modal title={modal.isNew ? 'Mais uma peça do mistério.' : 'O detalhe faz a diferença.'} eyebrow={modal.isNew ? 'PRENDER UMA NOVA PISTA' : `EDITAR ${typeLabels[modal.clue.type].toUpperCase()}`} onClose={closeModal} wide><ClueEditor key={modal.clue.id} clue={modal.clue} isNew={modal.isNew} onSave={saveClue} onCancel={closeModal} /></Modal>}
    {modal?.kind === 'case' && <Modal title={modal.editing ? 'O dossiê da investigação.' : 'Um novo mistério.'} eyebrow={modal.editing ? `CASO Nº ${activeCase.number}` : 'ABRIR INVESTIGAÇÃO'} onClose={closeModal}><CaseEditor investigation={modal.editing ? activeCase : undefined} onSave={newCase} onCancel={closeModal} /></Modal>}
    {modal?.kind === 'event' && <Modal title={modal.event ? 'Um fato, em detalhes.' : 'Um novo acontecimento.'} eyebrow="LINHA DO TEMPO" onClose={closeModal}><EventEditor event={modal.event} clues={activeCase.clues} onSave={saveEvent} onCancel={closeModal} onDelete={modal.event ? () => { const event = modal.event!; setModal({ kind: 'confirm', title: 'Excluir este acontecimento?', description: `“${event.title}” será removido da linha do tempo. A pista relacionada será mantida.`, confirmLabel: 'Excluir evento', action: () => { updateCase(c => ({ ...c, events: c.events.filter(e => e.id !== event.id) })); closeModal(); showToast('Evento excluído.', true); } }); } : undefined} /></Modal>}
    {modal?.kind === 'share' && <Modal title="Investigue em boa companhia." eyebrow="COMPARTILHAR CASO" onClose={closeModal}><SharePanel investigation={activeCase} link={shareLink} onCopy={copyText} onExport={exportCase} /></Modal>}
    {modal?.kind === 'help' && <Modal title="É só puxar o fio." eyebrow="SEU MURAL DE INVESTIGAÇÃO" onClose={closeModal} wide><HelpPanel /></Modal>}
    {modal?.kind === 'search' && <Modal title="Encontre o próximo detalhe." eyebrow={`BUSCAR NO CASO Nº ${activeCase.number}`} onClose={closeModal} className="search-modal"><div className="global-search-input"><Search size={20} /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Um nome, um lugar, uma suspeita..." aria-label="Buscar pistas no caso" />{searchQuery && <button className="icon-button" onClick={() => setSearchQuery('')} aria-label="Limpar busca"><X size={16} /></button>}</div><SearchResults query={searchQuery} investigation={activeCase} onSelect={focusClue} /></Modal>}
    {modal?.kind === 'confirm' && <Modal title={modal.title} eyebrow="ANTES DE CONTINUAR" onClose={closeModal}><div className="modal-body confirm-body"><span className="confirm-icon"><Trash2 size={24} strokeWidth={1.5} /></span><p>{modal.description}</p></div><div className="modal-footer"><button className="secondary-button" onClick={closeModal}>Manter como está</button><button className="danger-button" onClick={modal.action}><Trash2 size={14} />{modal.confirmLabel}</button></div></Modal>}
  </div>;
}
