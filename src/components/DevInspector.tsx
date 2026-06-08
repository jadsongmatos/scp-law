import React, { useState, useCallback, useRef, useEffect, useLayoutEffect, lazy, Suspense } from 'react';
import { Interactable, Room, ITEM_NAMES } from '@/data';
import { FolderTree, FileJson2, Plus, Trash2, ChevronRight, ChevronDown, Download } from 'lucide-react';
import { adjustMenuPosition } from '@/lib/useMenuPosition';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

interface DevInspectorProps {
  rooms: Record<string, Room>;
  currentRoomId: string;
  selectedObjId: string | null;
  onSelectObj: (id: string | null) => void;
  onUpdateObj: (roomId: string, objId: string, updated: Interactable) => void;
  onAddObj: (roomId: string, obj: Interactable) => void;
  onRemoveObj: (roomId: string, objId: string) => void;
  onDownloadJSON: () => void;
}

type TreeNode =
  | { kind: 'room'; roomId: string; name: string }
  | { kind: 'item'; roomId: string; obj: Interactable };

export function DevInspector({
  rooms,
  currentRoomId,
  selectedObjId,
  onSelectObj,
  onUpdateObj,
  onAddObj,
  onRemoveObj,
  onDownloadJSON,
}: DevInspectorProps) {
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set([currentRoomId]));
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: TreeNode | null } | null>(null);
  const [editingObj, setEditingObj] = useState<Interactable | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (contextMenu && contextMenuRef.current) adjustMenuPosition(contextMenuRef.current, contextMenu.x, contextMenu.y);
  }, [contextMenu]);

  useEffect(() => {
    if (!expandedRooms.has(currentRoomId)) {
      setExpandedRooms(prev => new Set([...prev, currentRoomId]));
    }
  }, [currentRoomId, expandedRooms]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (selectedObjId) {
      for (const [roomId, room] of Object.entries(rooms)) {
        const found = room.interactables.find(i => i.id === selectedObjId);
        if (found) {
          setExpandedRooms(prev => new Set([...prev, roomId]));
          setEditingObj(found);
          setEditorKey(k => k + 1);
          break;
        }
      }
    }
  }, [selectedObjId, rooms]);

  const toggleRoom = useCallback((roomId: string) => {
    setExpandedRooms(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, target: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, target });
  }, []);

  const handleCreateItem = useCallback((roomId: string) => {
    const room = rooms[roomId];
    if (!room) return;
    const n = room.interactables.length + 1;
    const newObj: Interactable = {
      id: `new_item_${Date.now()}`,
      icon: 'Search',
      x: 50,
      y: 50,
      type: 'inspect',
      label: `Novo Item ${n}`,
      description: 'Descrição do novo item.',
    };
    onAddObj(roomId, newObj);
    setContextMenu(null);
    onSelectObj(newObj.id);
    setEditingObj(newObj);
    setEditorKey(k => k + 1);
  }, [rooms, onAddObj, onSelectObj]);

  const handleDeleteItem = useCallback((roomId: string, objId: string) => {
    onRemoveObj(roomId, objId);
    if (selectedObjId === objId) {
      onSelectObj(null);
      setEditingObj(null);
    }
    setContextMenu(null);
  }, [onRemoveObj, selectedObjId, onSelectObj]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!value || !editingObj) return;
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && parsed.id) {
        setEditingObj(parsed as Interactable);
      }
    } catch {}
  }, [editingObj]);

  const applyEditorChanges = useCallback(() => {
    if (!editingObj) return;
    for (const [roomId, room] of Object.entries(rooms)) {
      const idx = room.interactables.findIndex(i => i.id === editingObj.id);
      if (idx !== -1) {
        onUpdateObj(roomId, editingObj.id, editingObj);
        break;
      }
    }
  }, [editingObj, rooms, onUpdateObj]);

  const editorJson = editingObj ? JSON.stringify(editingObj, null, 2) : '';

  const sortedRoomIds = Object.keys(rooms).sort((a, b) => {
    if (a === currentRoomId) return -1;
    if (b === currentRoomId) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="flex flex-col h-full bg-zinc-950/95 text-zinc-300 text-xs font-mono select-none">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60 shrink-0">
        <span className="flex items-center gap-2 text-noir-amber tracking-widest text-[10px]">
          <FolderTree size={12} /> EXPLORER
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleCreateItem(currentRoomId)}
            className="p-1 text-zinc-500 hover:text-noir-amber transition-colors"
            title="Novo item"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={onDownloadJSON}
            className="p-1 text-zinc-500 hover:text-noir-amber transition-colors"
            title="Baixar JSON"
          >
            <Download size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {sortedRoomIds.map(roomId => {
          const room = rooms[roomId];
          const isExpanded = expandedRooms.has(roomId);
          const isCurrent = roomId === currentRoomId;
          const itemCount = room.interactables.length;

          return (
            <div key={roomId}>
              <div
                className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-zinc-800/60 ${isCurrent ? 'text-noir-amber' : 'text-zinc-400'}`}
                onClick={() => toggleRoom(roomId)}
                onContextMenu={(e) => handleContextMenu(e, { kind: 'room', roomId, name: room.name })}
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <FolderTree size={11} className="shrink-0" />
                <span className="truncate flex-1">{room.name}</span>
                <span className="text-zinc-600 text-[9px]">{itemCount}</span>
              </div>

              {isExpanded && (
                <div className="ml-3 border-l border-zinc-800/40">
                  {room.interactables.map(obj => {
                    const isSelected = selectedObjId === obj.id;
                    const itemLabel = ITEM_NAMES[obj.pickupItem || ''] || obj.label;
                    return (
                      <div
                        key={obj.id}
                        className={`flex items-center gap-1.5 px-2 py-0.5 cursor-pointer hover:bg-zinc-800/40 ${isSelected ? 'bg-noir-amber/10 text-noir-amber' : 'text-zinc-400'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectObj(obj.id);
                          setEditingObj(obj);
                          setEditorKey(k => k + 1);
                        }}
                        onContextMenu={(e) => handleContextMenu(e, { kind: 'item', roomId, obj })}
                      >
                        <FileJson2 size={10} className="shrink-0" />
                        <span className="truncate">{obj.id}</span>
                        <span className="text-zinc-600 text-[9px] ml-auto">{obj.type}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingObj && (
        <div className="border-t border-zinc-800/60 flex flex-col" style={{ height: '45%' }}>
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 shrink-0">
            <span className="text-noir-amber tracking-widest text-[10px] flex items-center gap-1.5">
              <FileJson2 size={10} /> {editingObj.id}
            </span>
            <button
              onClick={applyEditorChanges}
              className="px-2 py-0.5 text-[9px] text-zinc-400 hover:text-noir-amber border border-zinc-700/50 hover:border-noir-amber/50 rounded transition-colors tracking-wider"
            >
              APLICAR
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <Suspense fallback={<div className="h-full flex items-center justify-center text-zinc-600 text-[10px]">Carregando editor...</div>}>
              <MonacoEditor
                key={editorKey}
                height="100%"
                language="json"
                theme="vs-dark"
                value={editorJson}
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 11,
                  lineNumbers: 'off',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  folding: true,
                  renderLineHighlight: 'none',
                  overviewRulerBorder: false,
                  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                  padding: { top: 4 },
                  tabSize: 2,
                  automaticLayout: true,
                }}
              />
            </Suspense>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[9999] bg-zinc-900 border border-zinc-700/60 rounded shadow-xl py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.target?.kind === 'room' && (
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-noir-amber transition-colors"
              onClick={() => handleCreateItem((contextMenu.target as { roomId: string }).roomId)}
            >
              <Plus size={11} /> Novo Item
            </button>
          )}
          {contextMenu.target?.kind === 'item' && (
            <>
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-noir-amber transition-colors"
                onClick={() => {
                  const t = contextMenu.target as { kind: 'item'; roomId: string; obj: Interactable };
                  onSelectObj(t.obj.id);
                  setEditingObj(t.obj);
                  setEditorKey(k => k + 1);
                  setContextMenu(null);
                }}
              >
                <FileJson2 size={11} /> Inspecionar
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-red-950/40 transition-colors"
                onClick={() => {
                  const t = contextMenu.target as { kind: 'item'; roomId: string; obj: Interactable };
                  handleDeleteItem(t.roomId, t.obj.id);
                }}
              >
                <Trash2 size={11} /> Remover
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
