import { useCallback, useEffect, useRef, useState } from 'react';
import { useBoardContext } from '@/contexts/BoardContext';
import BoardNode from './BoardNode';
import Connections from './Connections';

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

const Canvas = () => {
  const {
    nodes, presentationMode, canvasCursor,
    panOffset, setPanOffset,
    selectedIds, setSelectedIds,
    selectionRect, setSelectionRect,
    connectorMode,
  } = useBoardContext();

  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Space-key pan ─────────────────────────────────────────────────────────
  // useState (not useRef) so the cursor expression re-renders reactively.

  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isPanActive, setIsPanActive] = useState(false);
  const isPanning = useRef(false);
  const panStart  = useRef<{ clientX: number; clientY: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      e.preventDefault();
      setIsSpaceDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      setIsSpaceDown(false);
      isPanning.current = false;
      setIsPanActive(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // ── Lasso ─────────────────────────────────────────────────────────────────

  const lassoStart = useRef<{ clientX: number; clientY: number } | null>(null);
  const isLassoing = useRef(false);

  // ── Pointer handlers ──────────────────────────────────────────────────────
  //
  // KEY FIX: the old guard `e.target === canvasRef.current` always failed
  // because empty-space clicks land on the content-layer div child, not on
  // canvasRef itself. New guard: skip only if the click hit a board node.

  const onBoardNode = (e: React.PointerEvent) =>
    !!(e.target as HTMLElement).closest('[id^="board-node-"]');

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (onBoardNode(e)) return;

    // Middle-mouse or Space+left → pan
    if (e.button === 1 || (e.button === 0 && isSpaceDown)) {
      e.preventDefault();
      isPanning.current = true;
      panStart.current  = { clientX: e.clientX, clientY: e.clientY, ox: panOffset.x, oy: panOffset.y };
      setIsPanActive(true);
      canvasRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    // Left click on empty space → clear selection + maybe lasso
    if (e.button === 0 && !connectorMode) {
      setSelectedIds(new Set());
      lassoStart.current = { clientX: e.clientX, clientY: e.clientY };
      isLassoing.current = true;
      setSelectionRect({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
      canvasRef.current?.setPointerCapture(e.pointerId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpaceDown, panOffset, connectorMode, setSelectedIds, setSelectionRect]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning.current && panStart.current) {
      setPanOffset({
        x: panStart.current.ox + (e.clientX - panStart.current.clientX),
        y: panStart.current.oy + (e.clientY - panStart.current.clientY),
      });
      return;
    }
    if (isLassoing.current && lassoStart.current) {
      const sx = lassoStart.current.clientX, sy = lassoStart.current.clientY;
      setSelectionRect({
        x: Math.min(sx, e.clientX), y: Math.min(sy, e.clientY),
        width: Math.abs(e.clientX - sx), height: Math.abs(e.clientY - sy),
      });
    }
  }, [setPanOffset, setSelectionRect]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning.current) {
      isPanning.current = false; panStart.current = null; setIsPanActive(false); return;
    }
    if (isLassoing.current && selectionRect) {
      isLassoing.current = false;
      const hits = new Set<string>();
      for (const node of nodes) {
        const nx = node.x + panOffset.x;
        const ny = node.y + panOffset.y;
        const nw = node.width ?? 200;
        const nh = node.renderedHeight ?? node.height ?? 80;
        if (rectsOverlap(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height, nx, ny, nw, nh))
          hits.add(node.id);
      }
      setSelectedIds(hits);
      setSelectionRect(null);
    }
  }, [selectionRect, nodes, panOffset, setSelectedIds, setSelectionRect]);

  // ── Cursor ────────────────────────────────────────────────────────────────

  const cursor = isPanActive ? 'grabbing' : isSpaceDown ? 'grab' : canvasCursor;

  // ── Background grid tracks pan ────────────────────────────────────────────

  const bgStyle = presentationMode ? {} : {
    backgroundImage:    `radial-gradient(circle, hsl(var(--canvas-dot)) 1px, transparent 1px)`,
    backgroundSize:     '20px 20px',
    backgroundPosition: `${panOffset.x % 20}px ${panOffset.y % 20}px`,
  };

  return (
    <div
      ref={canvasRef}
      className={`fixed inset-0 overflow-hidden transition-colors duration-500 ${presentationMode ? 'bg-black' : 'bg-background'}`}
      style={{ cursor, ...bgStyle }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Panned content layer */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'visible',
        transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0)`,
      }}>
        <Connections />
        {nodes.map((node) => <BoardNode key={node.id} node={node} />)}
      </div>

      {/* Lasso rect — screen-space */}
      {selectionRect && selectionRect.width > 4 && selectionRect.height > 4 && (
        <div style={{
          position: 'fixed',
          left: selectionRect.x, top: selectionRect.y,
          width: selectionRect.width, height: selectionRect.height,
          border: '1.5px dashed hsl(var(--primary))',
          background: 'hsl(var(--primary) / 0.08)',
          borderRadius: 4, pointerEvents: 'none', zIndex: 99999,
        }} />
      )}

      {nodes.length === 0 && !presentationMode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <h2 className="text-2xl font-light text-muted-foreground/50 tracking-wide mb-2">Muse-Board</h2>
            <p className="text-sm text-muted-foreground/30">Add images, text, colour swatches, or sticky notes to begin</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;
