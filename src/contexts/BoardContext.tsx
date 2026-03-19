import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeType = 'image' | 'text' | 'color-swatch' | 'sticky';

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
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
}

interface BoardContextType {
  nodes: BoardNode[];
  connections: Connection[];
  addNode: (type: NodeType, content?: string) => void;
  updateNode: (id: string, updates: Partial<BoardNode>) => void;
  removeNode: (id: string) => void;
  bringToFront: (id: string) => void;
  clearBoard: () => void;
  presentationMode: boolean;
  togglePresentationMode: () => void;
  connectorMode: boolean;
  toggleConnectorMode: () => void;
  pendingConnector: string | null;
  handleConnectorClick: (id: string) => void;
  removeConnection: (id: string) => void;
  canvasCursor: 'default' | 'crosshair' | 'cell';
}

// ─── Context ──────────────────────────────────────────────────────────────────

const BoardContext = createContext<BoardContextType | null>(null);

export const useBoardContext = (): BoardContextType => {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoardContext must be used within a BoardProvider');
  return ctx;
};

// ─── Static data ──────────────────────────────────────────────────────────────

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&h=200&fit=crop',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop',
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=300&h=200&fit=crop',
];
const DEFAULT_COLORS  = ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#6366f1'];
const STICKY_COLORS   = ['50 100% 80%', '160 60% 80%', '270 60% 85%'];
const NODE_Z_MAX      = 9999;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const BoardProvider = ({ children }: { children: ReactNode }) => {
  const [nodes,            setNodes]            = useState<BoardNode[]>([]);
  const [connections,      setConnections]      = useState<Connection[]>([]);
  const [maxZIndex,        setMaxZIndex]        = useState(0);
  const [presentationMode, setPresentationMode] = useState(false);
  const [connectorMode,    setConnectorMode]    = useState(false);
  const [pendingConnector, setPendingConnector] = useState<string | null>(null);

  // ── Node operations ──────────────────────────────────────────────────────────

  const addNode = useCallback((type: NodeType, content?: string) => {
    setMaxZIndex((prev) => {
      const zIndex = Math.min(prev + 1, NODE_Z_MAX);
      const x = 80 + Math.random() * 320;
      const y = 80 + Math.random() * 220;

      let nodeContent = content ?? '';
      let stickyColor: string | undefined;
      let rotation: number | undefined;

      switch (type) {
        case 'image':        if (!content) nodeContent = pick(PLACEHOLDER_IMAGES); break;
        case 'color-swatch': if (!content) nodeContent = pick(DEFAULT_COLORS);     break;
        case 'text':         if (!content) nodeContent = 'Double-click to edit…';  break;
        case 'sticky':
          nodeContent = content || 'Double-click to edit…';
          stickyColor = pick(STICKY_COLORS);
          rotation    = (Math.random() - 0.5) * 6;
          break;
      }

      const newNode: BoardNode = {
        id: crypto.randomUUID(),
        type, x, y,
        content: nodeContent,
        zIndex,
        width:  type === 'image' ? 280 : type === 'color-swatch' ? 100 : type === 'sticky' ? 180 : 200,
        height: type === 'image' ? 200 : type === 'color-swatch' ? 100 : type === 'sticky' ? 180 : undefined,
        stickyColor,
        rotation,
      };

      setNodes((prev) => [...prev, newNode]);
      return zIndex;
    });
  }, []);

  const updateNode = useCallback((id: string, updates: Partial<BoardNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
  }, []);

  const removeNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setConnections((prev) => prev.filter((c) => c.fromId !== id && c.toId !== id));
  }, []);

  const bringToFront = useCallback((id: string) => {
    setMaxZIndex((prev) => {
      const zIndex = Math.min(prev + 1, NODE_Z_MAX);
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, zIndex } : n)));
      return zIndex;
    });
  }, []);

  const clearBoard = useCallback(() => {
    setNodes([]);
    setConnections([]);
    setMaxZIndex(0);
  }, []);

  // ── Modes ────────────────────────────────────────────────────────────────────

  const togglePresentationMode = useCallback(() => setPresentationMode((p) => !p), []);

  const toggleConnectorMode = useCallback(() => {
    setConnectorMode((p) => !p);
    setPendingConnector(null);
  }, []);

  // ── Connector flow ───────────────────────────────────────────────────────────

  const handleConnectorClick = useCallback((id: string) => {
    if (!connectorMode) return;
    if (!pendingConnector) { setPendingConnector(id); return; }
    if (pendingConnector !== id) {
      setConnections((prev) => {
        const exists = prev.some(
          (c) => (c.fromId === pendingConnector && c.toId === id) ||
                 (c.fromId === id && c.toId === pendingConnector),
        );
        return exists
          ? prev
          : [...prev, { id: crypto.randomUUID(), fromId: pendingConnector, toId: id }];
      });
    }
    setPendingConnector(null);
  }, [connectorMode, pendingConnector]);

  const removeConnection = useCallback((id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ── Derived values ───────────────────────────────────────────────────────────

  const canvasCursor: BoardContextType['canvasCursor'] =
    pendingConnector ? 'cell' : connectorMode ? 'crosshair' : 'default';

  const value = useMemo<BoardContextType>(
    () => ({
      nodes, connections,
      addNode, updateNode, removeNode, bringToFront, clearBoard,
      presentationMode, togglePresentationMode,
      connectorMode, toggleConnectorMode,
      pendingConnector, handleConnectorClick,
      removeConnection,
      canvasCursor,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      nodes, connections,
      addNode, updateNode, removeNode, bringToFront, clearBoard,
      presentationMode, togglePresentationMode,
      connectorMode, toggleConnectorMode,
      pendingConnector, handleConnectorClick,
      removeConnection,
      canvasCursor,
    ],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
};
