import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBoardContext } from '@/contexts/BoardContext';
import BoardNode from './BoardNode';
import Connections from './Connections';
import MuseLogo from './MuseLogo';

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

type PointerOrigin = 'canvas' | 'ui';

const GHOST_CLICK_WINDOW = 650; // ms
const GHOST_CLICK_DISTANCE = 36; // px

const Canvas = ({ logoColorClass = 'text-neutral-800' }: { logoColorClass?: string }): JSX.Element => {
  const {
    nodes, presentationMode, canvasCursor,
    panOffset, setPanOffset,
    selectedIds, setSelectedIds,
    selectionRect, setSelectionRect,
    connectorMode,
  } = useBoardContext();

  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Pointer tracking
  const activePointers = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const pointerOrigin = useRef<Map<number, PointerOrigin>>(new Map());

  // Lasso / pan state
  const lassoStart = useRef<{ clientX: number; clientY: number } | null>(null);
  const isLassoing = useRef(false);
  const isPanning = useRef(false);
  const panStart = useRef<{ clientX: number; clientY: number; ox: number; oy: number } | null>(null);

  // Two-finger pan state
  const pinchStart = useRef<{ midX: number; midY: number; ox: number; oy: number } | null>(null);

  // Ghost-click protection
  const lastUiPointerAt = useRef<number>(0);
  const lastUiPointerCoord = useRef<{ x: number; y: number } | null>(null);

  // Space-key pan
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isPanActive, setIsPanActive] = useState(false);

  // Utility: check if target is explicitly UI
  const targetIsUi = (target: EventTarget | null) => {
    try {
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el.closest && el.closest('[data-muse-ui]')) return true;
      return false;
    } catch {
      return false;
    }
  };

  // Capture-phase global listeners to mark pointer origins early
  useEffect(() => {
    const onGlobalPointerDown = (ev: PointerEvent) => {
      const target = ev.target as HTMLElement | null;
      const inCanvas = !!(canvasRef.current && target && canvasRef.current.contains(target));
      const explicitUi = targetIsUi(target);
      const origin: PointerOrigin = explicitUi ? 'ui' : (inCanvas ? 'canvas' : 'ui');
      pointerOrigin.current.set(ev.pointerId ?? -1, origin);

      if (origin === 'ui') {
        lastUiPointerAt.current = Date.now();
        if ((ev as any).clientX != null && (ev as any).clientY != null) {
          lastUiPointerCoord.current = { x: (ev as any).clientX, y: (ev as any).clientY };
        } else {
          lastUiPointerCoord.current = null;
        }
      }
    };

    const onGlobalPointerUp = (ev: PointerEvent) => {
      pointerOrigin.current.delete(ev.pointerId ?? -1);
    };

    document.addEventListener('pointerdown', onGlobalPointerDown, true);
    document.addEventListener('pointerup', onGlobalPointerUp, true);
    document.addEventListener('pointercancel', onGlobalPointerUp, true);

    // touch fallback for some mobile weirdness
    const onTouchStart = (ev: TouchEvent) => {
      const t = ev.target as HTMLElement | null;
      const inCanvas = !!(canvasRef.current && t && canvasRef.current.contains(t));
      if (!inCanvas) {
        lastUiPointerAt.current = Date.now();
        const touch = ev.touches && ev.touches[0];
        if (touch) lastUiPointerCoord.current = { x: touch.clientX, y: touch.clientY };
      }
    };
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });

    return () => {
      document.removeEventListener('pointerdown', onGlobalPointerDown, true);
      document.removeEventListener('pointerup', onGlobalPointerUp, true);
      document.removeEventListener('pointercancel', onGlobalPointerUp, true);
      document.removeEventListener('touchstart', onTouchStart, true);
    };
  }, []);

  // Keyboard handlers for space pan
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
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
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Helper to determine if a pointer should be treated as UI-origin
  const pointerIsUi = (pointerId: number, eventTarget?: EventTarget | null) => {
    const origin = pointerOrigin.current.get(pointerId);
    if (origin === 'ui') return true;
    // runtime fallback: check target's closest UI marker
    if (eventTarget && targetIsUi(eventTarget)) return true;
    // small temporal guard: if a UI pointer happened very recently and the event target is outside canvas, treat as UI
    const now = Date.now();
    try {
      if (now - lastUiPointerAt.current < GHOST_CLICK_WINDOW) {
        const t = eventTarget as HTMLElement | null;
        if (t && canvasRef.current && !canvasRef.current.contains(t)) return true;
      }
    } catch {
      // ignore
    }
    return false;
  };

  // Pointer handlers
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Track pointer position
    activePointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    // If this pointer belongs to a UI element, ignore for canvas interactions
    if (pointerIsUi(e.pointerId, e.target)) return;

    // Two-finger start -> pinch/pan
    if (activePointers.current.size === 2) {
      // cancel lasso if any
      isLassoing.current = false;
      lassoStart.current = null;
      setSelectionRect(null);

      isPanning.current = false;
      panStart.current = null;

      const pts = Array.from(activePointers.current.values());
      const midX = (pts[0].clientX + pts[1].clientX) / 2;
      const midY = (pts[0].clientY + pts[1].clientY) / 2;
      pinchStart.current = { midX, midY, ox: panOffset.x, oy: panOffset.y };

      // Only capture pointer if it's a canvas-originating pointer
      if (pointerOrigin.current.get(e.pointerId) !== 'ui') {
        canvasRef.current?.setPointerCapture(e.pointerId);
      }
      setIsPanActive(true);
      return;
    }

    // If clicking on a board node, let node handler take over
    const el = e.target as HTMLElement;
    if (el && el.closest && el.closest('[id^="board-node-"]')) return;

    // Middle button or space -> pan
    if (e.button === 1 || (e.button === 0 && isSpaceDown)) {
      e.preventDefault();
      isPanning.current = true;
      panStart.current = { clientX: e.clientX, clientY: e.clientY, ox: panOffset.x, oy: panOffset.y };
      setIsPanActive(true);
      if (pointerOrigin.current.get(e.pointerId) !== 'ui') canvasRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    // Left click / single touch on empty space -> start lasso (unless connector mode)
    if (e.button === 0 && !connectorMode) {
      setSelectedIds(new Set());
      lassoStart.current = { clientX: e.clientX, clientY: e.clientY };
      isLassoing.current = true;
      setSelectionRect({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
      if (pointerOrigin.current.get(e.pointerId) !== 'ui') canvasRef.current?.setPointerCapture(e.pointerId);
    }
  }, [isSpaceDown, panOffset, connectorMode, setSelectedIds, setSelectionRect]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Update pointer position
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    } else {
      activePointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }

    // If this pointer started on UI, ignore interaction moves
    if (pointerIsUi(e.pointerId, e.target)) return;

    // Two-finger pan
    if (activePointers.current.size === 2 && pinchStart.current) {
      const pts = Array.from(activePointers.current.values());
      const midX = (pts[0].clientX + pts[1].clientX) / 2;
      const midY = (pts[0].clientY + pts[1].clientY) / 2;
      setPanOffset({ x: pinchStart.current.ox + (midX - pinchStart.current.midX), y: pinchStart.current.oy + (midY - pinchStart.current.midY) });
      return;
    }

    // Panning with space or middle mouse
    if (isPanning.current && panStart.current) {
      setPanOffset({ x: panStart.current.ox + (e.clientX - panStart.current.clientX), y: panStart.current.oy + (e.clientY - panStart.current.clientY) });
      return;
    }

    // Lasso update
    if (isLassoing.current && lassoStart.current) {
      const sx = lassoStart.current.clientX, sy = lassoStart.current.clientY;
      setSelectionRect({
        x: Math.min(sx, e.clientX),
        y: Math.min(sy, e.clientY),
        width: Math.abs(e.clientX - sx),
        height: Math.abs(e.clientY - sy),
      });
    }
  }, [setPanOffset, setSelectionRect]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Cleanup tracking
    activePointers.current.delete(e.pointerId);
    const origin = pointerOrigin.current.get(e.pointerId);
    pointerOrigin.current.delete(e.pointerId);

    // If this pointer was UI-origin, nothing else to do
    if (origin === 'ui') return;

    // If fewer than two pointers remain, cancel pinch state
    if (activePointers.current.size < 2) {
      pinchStart.current = null;
      if (activePointers.current.size === 0) setIsPanActive(false);
    }

    // End panning
    if (isPanning.current) {
      isPanning.current = false;
      panStart.current = null;
      setIsPanActive(false);
      return;
    }

    // Finish lasso selection
    if (isLassoing.current && selectionRect) {
      isLassoing.current = false;
      const hits = new Set<string>();
      for (const node of nodes) {
        const nx = node.x + panOffset.x;
        const ny = node.y + panOffset.y;
        const nw = node.width ?? 200;
        const nh = node.renderedHeight ?? node.height ?? 80;
        if (rectsOverlap(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height, nx, ny, nw, nh)) {
          hits.add(node.id);
        }
      }
      setSelectedIds(hits);
      setSelectionRect(null);
    }
  }, [selectionRect, nodes, panOffset, setSelectedIds, setSelectionRect]);

  // Click-capture to swallow ghost clicks shortly after UI activity
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    const now = Date.now();
    const dt = now - lastUiPointerAt.current;
    if (dt > 0 && dt < GHOST_CLICK_WINDOW) {
      const coord = lastUiPointerCoord.current;
      if (coord) {
        const dx = ((e as any).clientX ?? 0) - coord.x;
        const dy = ((e as any).clientY ?? 0) - coord.y;
        if (Math.hypot(dx, dy) < GHOST_CLICK_DISTANCE) {
          e.stopPropagation();
          e.preventDefault();
        }
      } else {
        // If we have no coord, still block if within time window
        e.stopPropagation();
        e.preventDefault();
      }
    }
  }, []);

  // Cursor style
  const cursor = isPanActive ? 'grabbing' : isSpaceDown ? 'grab' : canvasCursor;

  // Background grid
  const bgStyle: React.CSSProperties = presentationMode ? {} : {
    backgroundImage: `radial-gradient(circle, hsl(var(--canvas-dot)) 1px, transparent 1px)`,
    backgroundSize: '20px 20px',
    backgroundPosition: `${panOffset.x % 20}px ${panOffset.y % 20}px`,
  };

  return (
    <div
      ref={canvasRef}
      className={`fixed inset-0 overflow-hidden transition-colors duration-500 ${presentationMode ? 'bg-black' : 'bg-background'}`}
      style={{ cursor, ...bgStyle, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
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
            <MuseLogo className={`mx-auto mb-4 w-full h-28 lg:h-40 ${logoColorClass}`} />
            <p className="text-sm text-muted-foreground/30">Add images, text, colour swatches, or sticky notes to begin</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;