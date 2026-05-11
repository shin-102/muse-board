import {
  useState, useRef, useEffect, useCallback,
  type KeyboardEvent, type PointerEvent as RPE, type MouseEvent as RME,
} from 'react';
import { X } from 'lucide-react';
import { BoardNode as BN, useBoardContext } from '@/contexts/BoardContext';

// ─── Active edit ref ──────────────────────────────────────────────────────────

export const activeEditRef: { current: HTMLDivElement | null } = { current: null };

// ─── Double-tap detection threshold (ms) ─────────────────────────────────────

const DOUBLE_TAP_MS = 300;

// ─── BoardNode ────────────────────────────────────────────────────────────────

const BoardNode = ({ node }: { node: BN }) => {
  const {
    updateNode, updateNodes, removeNode,
    presentationMode, connectorMode, handleConnectorClick, pendingConnector,
    selectedIds, setSelectedIds,
    getGroupForNode, nodes,
  } = useBoardContext();

  const [isHovered,  setIsHovered]  = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing,  setIsEditing]  = useState(false);
  const [editHtml,   setEditHtml]   = useState(node.content);

  const outerRef = useRef<HTMLDivElement>(null);
  const cardRef  = useRef<HTMLDivElement>(null);
  const editRef  = useRef<HTMLDivElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  // ── Double-tap tracking ───────────────────────────────────────────────────
  const lastTapTime  = useRef<number>(0);
  const lastTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fontSize   = node.fontSize ?? 14;
  const isSelected = selectedIds.has(node.id);
  const isPending  = pendingConnector === node.id;
  const isSticky   = node.type === 'sticky';
  const isText     = node.type === 'text';
  const isFlexH    = isText || isSticky;

  const drag = useRef<{
    startX: number; startY: number;
    movers: Array<{ id: string; el: HTMLDivElement | null; ox: number; oy: number }>;
  } | null>(null);

  // ── ResizeObserver ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!cardRef.current || !isFlexH) return;
    const ro = new ResizeObserver(([e]) => {
      const h = e.contentRect.height;
      if (h > 0 && h !== node.renderedHeight) updateNode(node.id, { renderedHeight: h });
    });
    ro.observe(cardRef.current);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, isFlexH]);

  // ── Sync edit mirror ──────────────────────────────────────────────────────

  useEffect(() => { if (!isEditing) setEditHtml(node.content); }, [node.content, isEditing]);

  // ── Focus + expose activeEditRef on edit entry ────────────────────────────

  useEffect(() => {
    if (!isEditing || !editRef.current) return;
    activeEditRef.current = editRef.current;
    if (document.activeElement !== editRef.current) {
      editRef.current.focus();
      const r = document.createRange();
      const s = window.getSelection();
      r.selectNodeContents(editRef.current);
      r.collapse(false);
      s?.removeAllRanges();
      s?.addRange(r);
    }
    return () => {
      if (activeEditRef.current === editRef.current) activeEditRef.current = null;
    };
  }, [isEditing]);

  // ── Commit / discard ──────────────────────────────────────────────────────

  const commit = useCallback(() => {
    if (!editRef.current) return;
    const html = editRef.current.innerHTML;
    updateNode(node.id, { content: html });
    setEditHtml(html);
    setIsEditing(false);
    activeEditRef.current = null;
  }, [node.id, updateNode]);

  const onEditKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      if (editRef.current) editRef.current.innerHTML = node.content;
      setIsEditing(false);
      activeEditRef.current = null;
    }
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); commit(); }
  };

  // ── Image upload ──────────────────────────────────────────────────────────

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => { const u = ev.target?.result as string; if (u) updateNode(node.id, { content: u }); };
    reader.readAsDataURL(f); e.target.value = '';
  };

  // ── Enter editing mode ────────────────────────────────────────────────────

  const enterEditMode = useCallback(() => {
    if (presentationMode || connectorMode) return;
    switch (node.type) {
      case 'text':
      case 'sticky':
        setIsEditing(true);
        setEditHtml(node.content);
        break;
      case 'image':
        fileRef.current?.click();
        break;
    }
  }, [presentationMode, connectorMode, node.type, node.content]);

  // ── Double-click (desktop) ────────────────────────────────────────────────

  const onDoubleClick = (e: RME) => {
    e.stopPropagation();
    enterEditMode();
  };

  // ── Connector click ───────────────────────────────────────────────────────

  const onClick = (e: RME) => {
    if (!connectorMode) return;
    e.stopPropagation();
    handleConnectorClick(node.id);
  };

  // ── Drag + double-tap (pointer events) ───────────────────────────────────
  //
  // We handle double-tap here on pointerDown because:
  //  1. dblclick doesn't fire reliably on mobile touch
  //  2. We can detect double-tap timing before any drag starts
  //
  // Logic: if two taps arrive within DOUBLE_TAP_MS on the same node
  // and the pointer barely moved, treat it as a double-tap → edit.

  const onPD = (e: RPE<HTMLDivElement>) => {
    if (isEditing) return;
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    if (connectorMode) return;

    e.preventDefault();
    e.stopPropagation();

    // ── Show "hover" state on touch so delete button appears ─────────────
    // On touch devices pointerType === 'touch'; we show the hover UI
    // immediately on tap (it will clear on pointerUp if no drag happened).
    if (e.pointerType === 'touch') {
      setIsHovered(true);
    }

    // ── Double-tap detection ──────────────────────────────────────────────
    const now = Date.now();
    const gap  = now - lastTapTime.current;
    if (gap < DOUBLE_TAP_MS && gap > 0) {
      // Double-tap confirmed
      if (lastTapTimer.current) { clearTimeout(lastTapTimer.current); lastTapTimer.current = null; }
      lastTapTime.current = 0;
      enterEditMode();
      return;
    }
    lastTapTime.current = now;
    // Auto-clear so a slow single tap doesn't linger
    if (lastTapTimer.current) clearTimeout(lastTapTimer.current);
    lastTapTimer.current = setTimeout(() => { lastTapTime.current = 0; }, DOUBLE_TAP_MS + 50);

    // ── Shift-tap: toggle selection ───────────────────────────────────────
    if (e.shiftKey) {
      setSelectedIds((prev) => {
        const s = new Set(prev);
        s.has(node.id) ? s.delete(node.id) : s.add(node.id);
        return s;
      });
      return;
    }

    const sel = selectedIds.has(node.id) ? selectedIds : new Set([node.id]);
    if (!selectedIds.has(node.id)) setSelectedIds(sel);

    const grp = getGroupForNode(node.id);
    const ids = new Set(sel);
    if (grp) grp.nodeIds.forEach((id) => ids.add(id));

    const movers = nodes
      .filter((n) => ids.has(n.id))
      .map((n) => ({
        id: n.id,
        el: document.getElementById(`board-node-${n.id}`) as HTMLDivElement | null,
        ox: n.x, oy: n.y,
      }));

    outerRef.current!.setPointerCapture(e.pointerId);
    setIsDragging(true);
    drag.current = { startX: e.clientX, startY: e.clientY, movers };
    movers.forEach((m) => { if (m.el) m.el.style.willChange = 'transform'; });
  };

  const onPM = (e: RPE<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX, dy = e.clientY - drag.current.startY;
    drag.current.movers.forEach((m) => {
      const rot = nodes.find((n) => n.id === m.id)?.rotation ?? 0;
      if (m.el) m.el.style.transform = `translate3d(${m.ox + dx}px, ${m.oy + dy}px, 0) rotate(${rot}deg)`;
    });
  };

  const onPU = (e: RPE<HTMLDivElement>) => {
    // On touch: hide the "hover" state when the finger lifts
    // (unless we had a drag, in which case selection state handles visibility)
    if (e.pointerType === 'touch') {
      // Small delay so taps can still trigger the delete button before it vanishes
      setTimeout(() => setIsHovered(false), 1500);
    }

    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX, dy = e.clientY - drag.current.startY;
    drag.current.movers.forEach((m) => { if (m.el) m.el.style.willChange = 'auto'; });
    updateNodes(drag.current.movers.map((m) => ({ id: m.id, x: m.ox + dx, y: m.oy + dy })));
    drag.current = null; setIsDragging(false);
  };

  // ── Content ───────────────────────────────────────────────────────────────

  const renderContent = () => {
    switch (node.type) {
      case 'image':
        return (
          <>
            <img src={node.content} alt="" className="h-full w-full object-cover" draggable={false}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='280' height='200'><rect width='100%25' height='100%25' fill='%23334155'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='sans-serif' font-size='13'>No image</text></svg>`;
              }}
            />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          </>
        );

      case 'text':
      case 'sticky': {
        const base = isSticky ? 'font-serif text-neutral-800 dark:text-neutral-900' : 'text-foreground';
        if (isEditing) {
          return (
            <div
              ref={editRef}
              contentEditable suppressContentEditableWarning
              onBlur={commit}
              onKeyDown={onEditKey}
              dangerouslySetInnerHTML={{ __html: editHtml }}
              style={{ fontSize, lineHeight: 1.6, cursor: 'text' }}
              className={`w-full outline-none break-words whitespace-pre-wrap min-h-[2em] ${base}`}
              spellCheck
            />
          );
        }
        return (
          <div
            dangerouslySetInnerHTML={{ __html: node.content || '<span style="opacity:0.35">Double-tap to edit…</span>' }}
            style={{ fontSize, lineHeight: 1.6, maxHeight: '100%' }}
            className={`w-full break-words whitespace-pre-wrap overflow-hidden ${base}`}
          />
        );
      }

      case 'color-swatch':
        return <div className="w-full h-full" style={{ backgroundColor: node.content }} />;

      default: return null;
    }
  };

  // ── Cursor ────────────────────────────────────────────────────────────────

  const cursor = (() => {
    if (connectorMode) return isPending ? 'cell' : 'crosshair';
    if (isEditing)     return 'text';
    if (isDragging)    return 'grabbing';
    return 'grab';
  })();

  // ── Styles ────────────────────────────────────────────────────────────────

  const outerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    transform: `translate3d(${node.x}px, ${node.y}px, 0) rotate(${node.rotation ?? 0}deg)`,
    width:     node.width,
    height:    isFlexH ? undefined : node.height,
    minHeight: isFlexH ? (node.height ?? 80) : undefined,
    zIndex:    node.zIndex,
    overflow: 'visible',
    cursor,
    userSelect: isEditing ? 'text' : 'none',
    // Prevent browser's native touch actions (scroll, zoom) while dragging nodes
    touchAction: 'none',
  };

  const cardClass = [
    'relative rounded-xl',
    isFlexH ? '' : 'h-full',
    isDragging ? 'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] scale-[1.02]' : 'shadow-2xl',
    isPending  ? 'ring-2 ring-blue-500'   : '',
    isSelected ? 'ring-2 ring-primary/80' : '',
    isSticky
      ? 'p-4'
      : isText
        ? 'p-4 border border-node-border bg-node-bg/80 backdrop-blur-md overflow-hidden'
        : 'border border-node-border bg-node-bg/80 backdrop-blur-md overflow-hidden',
    'transition-shadow transition-transform duration-200',
  ].filter(Boolean).join(' ');

  // ── Show delete button when: hovered (desktop) OR selected (mobile touch) ──
  const showDeleteBtn = (isHovered || isSelected) && !presentationMode && !isEditing;

  return (
    <div
      id={`board-node-${node.id}`}
      ref={outerRef}
      style={outerStyle}
      onPointerDown={onPD}
      onPointerMove={onPM}
      onPointerUp={onPU}
      onPointerCancel={onPU}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
    >
      {/* Delete button — visible on hover (desktop) or selection (touch) */}
      {showDeleteBtn && (
        <button
          data-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
          className="absolute flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg hover:scale-110 transition-transform duration-150"
          style={{ top: -12, right: -12, zIndex: 1 }}
          title="Delete"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Pending-connector pulse */}
      {isPending && (
        <div className="absolute inset-0 rounded-xl ring-4 ring-blue-400/50 animate-pulse pointer-events-none" />
      )}

      {/* Card */}
      <div
        ref={cardRef}
        className={cardClass}
        style={isSticky ? {
          backgroundColor: `hsl(${node.stickyColor})`,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
        } : undefined}
      >
        {renderContent()}
      </div>
    </div>
  );
};

export default BoardNode;
