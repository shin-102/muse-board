import { BoardData } from '@/lib/board-io';
import React, {
  createContext, useContext, useState, useCallback, useMemo, type ReactNode,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeType = 'image' | 'text' | 'color-swatch' | 'sticky';
export type ConnectionType = 'default' | 'dashed' | 'solid';

export interface BoardNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  content: string;
  zIndex: number;
  width?: number;
  height?: number;
  stickyColor?: string;
  rotation?: number;
  fontSize?: number;
  /** Actual rendered height kept in sync by ResizeObserver in BoardNode. */
  renderedHeight?: number;
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
  type?: ConnectionType;
}

export interface Group {
  id: string;
  nodeIds: string[];
}

export interface Point { x: number; y: number; }

export interface SelectionRect { x: number; y: number; width: number; height: number; }

// ─── Context shape ────────────────────────────────────────────────────────────

interface BoardContextType {
  nodes: BoardNode[];
  connections: Connection[];
  groups: Group[];
  panOffset: Point;
  setPanOffset: React.Dispatch<React.SetStateAction<Point>>;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectionRect: SelectionRect | null;
  setSelectionRect: React.Dispatch<React.SetStateAction<SelectionRect | null>>;
  addNode: (type: NodeType, content?: string) => void;
  updateNode: (id: string, updates: Partial<BoardNode>) => void;
  updateNodes: (updates: Array<{ id: string; x: number; y: number }>) => void;
  removeNode: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  clearBoard: () => void;
  groupSelected: () => void;
  ungroupNodes: (groupId: string) => void;
  getGroupForNode: (nodeId: string) => Group | undefined;
  presentationMode: boolean;
  togglePresentationMode: () => void;
  connectorMode: boolean;
  toggleConnectorMode: () => void;
  pendingConnector: string | null;
  handleConnectorClick: (id: string) => void;
  removeConnection: (id: string) => void;
  /** 'default' | 'crosshair' | 'cell' — used by Canvas for the background cursor */
  canvasCursor: 'default' | 'crosshair' | 'cell';
  loadBoard: (data: { nodes: BoardNode[], connections: Connection[], groups: Group[], panOffset: Point }) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const BoardContext = createContext<BoardContextType | null>(null);

export const useBoardContext = (): BoardContextType => {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoardContext must be used within BoardProvider');
  return ctx;
};

// ─── Static data ──────────────────────────────────────────────────────────────

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&h=200&fit=crop',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop',
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=300&h=200&fit=crop',
];
const DEFAULT_COLORS = ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#6366f1'];
const STICKY_COLORS  = ['50 100% 80%', '160 60% 80%', '270 60% 85%'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── Z-index helpers ──────────────────────────────────────────────────────────

function reindexToFront(nodes: BoardNode[], id: string): BoardNode[] {
  const sorted  = [...nodes].sort((a, b) => a.zIndex - b.zIndex);
  const without = sorted.filter((n) => n.id !== id);
  const target  = sorted.find((n) => n.id === id);
  if (!target) return nodes;
  return [...without, target].map((n, i) => ({ ...n, zIndex: i + 1 }));
}

function reindexToBack(nodes: BoardNode[], id: string): BoardNode[] {
  const sorted  = [...nodes].sort((a, b) => a.zIndex - b.zIndex);
  const without = sorted.filter((n) => n.id !== id);
  const target  = sorted.find((n) => n.id === id);
  if (!target) return nodes;
  return [target, ...without].map((n, i) => ({ ...n, zIndex: i + 1 }));
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const BoardProvider = ({ children }: { children: ReactNode }) => {
  const [nodes,            setNodes]            = useState<BoardNode[]>([]);
  const [connections,      setConnections]      = useState<Connection[]>([]);
  const [groups,           setGroups]           = useState<Group[]>([]);
  const [presentationMode, setPresentationMode] = useState(false);
  const [connectorMode,    setConnectorMode]    = useState(false);
  const [pendingConnector, setPendingConnector] = useState<string | null>(null);
  const [panOffset,        setPanOffset]        = useState<Point>({ x: 0, y: 0 });
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set());
  const [selectionRect,    setSelectionRect]    = useState<SelectionRect | null>(null);

  // ── Node CRUD ──────────────────────────────────────────────────────────────

  const addNode = useCallback((type: NodeType, content?: string) => {
    setNodes((prev) => {
      const maxZ = prev.reduce((m, n) => Math.max(m, n.zIndex), 0);
      let nodeContent = content ?? '';
      let stickyColor: string | undefined;
      let rotation: number | undefined;

      switch (type) {
        case 'image': if (!content) nodeContent = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300'; break;
        case 'color-swatch': if (!content) nodeContent = '#f43f5e'; break;
        case 'sticky':
          stickyColor = '50 100% 80%';
          rotation = (Math.random() - 0.5) * 6;
          break;
      }

      const newNode: BoardNode = {
        id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36), // ? originally `crypto.randomUUID()`
        type,
        x: 100 + (Math.random() * 50), // Standardized coordinates
        y: 100 + (Math.random() * 50),
        content: nodeContent,
        zIndex: maxZ + 1,
        width: type === 'image' ? 280 : type === 'color-swatch' ? 100 : type === 'sticky' ? 180 : 200,
        height: type === 'image' ? 200 : type === 'color-swatch' ? 100 : type === 'sticky' ? 180 : undefined,
        stickyColor,
        rotation,
      };

      return [...prev, newNode];
    });
  }, []);

  const updateNode = useCallback((id: string, updates: Partial<BoardNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
  }, []);

  const updateNodes = useCallback((updates: Array<{ id: string; x: number; y: number }>) => {
    const map = new Map(updates.map((u) => [u.id, u]));
    setNodes((prev) => prev.map((n) => {
      const u = map.get(n.id);
      return u ? { ...n, x: u.x, y: u.y } : n;
    }));
  }, []);

  const removeNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setConnections((prev) => prev.filter((c) => c.fromId !== id && c.toId !== id));
    setGroups((prev) =>
      prev.map((g) => ({ ...g, nodeIds: g.nodeIds.filter((nid) => nid !== id) }))
          .filter((g) => g.nodeIds.length > 1),
    );
    setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
  }, []);

  const bringToFront = useCallback((id: string) => setNodes((p) => reindexToFront(p, id)), []);
  const sendToBack   = useCallback((id: string) => setNodes((p) => reindexToBack(p, id)),  []);

  const clearBoard = useCallback(() => {
    setNodes([]); setConnections([]); setGroups([]); setSelectedIds(new Set());
  }, []);

  // ── Grouping ──────────────────────────────────────────────────────────────

  const groupSelected = useCallback(() => {
    setSelectedIds((sel) => {
      if (sel.size < 2) return sel;
      setGroups((prev) => [...prev, { id: crypto.randomUUID(), nodeIds: [...sel] }]);
      return sel;
    });
  }, []);

  const ungroupNodes = useCallback(
    (groupId: string) => setGroups((prev) => prev.filter((g) => g.id !== groupId)),
    [],
  );

  const getGroupForNode = useCallback(
    (nodeId: string) => groups.find((g) => g.nodeIds.includes(nodeId)),
    [groups],
  );

  // ── Presentation ──────────────────────────────────────────────────────────

  const togglePresentationMode = useCallback(() => setPresentationMode((p) => !p), []);

  // ── Connector mode ────────────────────────────────────────────────────────

  const toggleConnectorMode = useCallback(() => {
    setConnectorMode((p) => !p);
    setPendingConnector(null);
  }, []);

  const handleConnectorClick = useCallback((id: string) => {
    if (!connectorMode) return;

    if (!pendingConnector) {
      setPendingConnector(id);
      return;
    }

    if (pendingConnector !== id) {
      setConnections((prev) => {
        const exists = prev.some(
          (c) => (c.fromId === pendingConnector && c.toId === id)
              || (c.fromId === id && c.toId === pendingConnector),
        );
        // Use a compatible ID generator instead of crypto.randomUUID()
        const connectionId = `conn-${Math.random().toString(36).substr(2, 9)}`;
        return exists ? prev : [...prev, { id: connectionId, fromId: pendingConnector, toId: id }];
      });
    }

    // Always exit connector mode after the second click
    setPendingConnector(null);
    setConnectorMode(false);
  }, [connectorMode, pendingConnector]);

  const removeConnection = useCallback(
    (id: string) => setConnections((prev) => prev.filter((c) => c.id !== id)),
    [],
  );

  // ── Derived cursor for Canvas background ──────────────────────────────────

  const canvasCursor: BoardContextType['canvasCursor'] =
    pendingConnector ? 'cell' : connectorMode ? 'crosshair' : 'default';

  // ── Board Loading ─────────────────────────────────────────────────────────────────

  const loadBoard = useCallback((data: BoardData) => {
    // We reset selection and modes for safety during import
    setNodes(data.nodes || []);
    setConnections(data.connections || []);
    setGroups(data.groups || []);
    setPanOffset(data.panOffset || { x: 0, y: 0 });
    setSelectedIds(new Set());
    setConnectorMode(false);
    setPendingConnector(null);
  }, []);

  // ── Value ─────────────────────────────────────────────────────────────────

  const value = useMemo<BoardContextType>(() => ({
    nodes, connections, groups,
    panOffset, setPanOffset,
    selectedIds, setSelectedIds,
    selectionRect, setSelectionRect,
    addNode, updateNode, updateNodes, removeNode,
    bringToFront, sendToBack, clearBoard,
    groupSelected, ungroupNodes, getGroupForNode,
    presentationMode, togglePresentationMode,
    connectorMode, toggleConnectorMode,
    pendingConnector, handleConnectorClick,
    removeConnection,
    canvasCursor, loadBoard
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    nodes, connections, groups,
    panOffset, selectedIds, selectionRect,
    addNode, updateNode, updateNodes, removeNode,
    bringToFront, sendToBack, clearBoard,
    groupSelected, ungroupNodes, getGroupForNode,
    presentationMode, togglePresentationMode,
    connectorMode, toggleConnectorMode,
    pendingConnector, handleConnectorClick,
    removeConnection, canvasCursor,
  ]);

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
};
