import { useState, useRef, useEffect } from 'react';
import { X, Move } from 'lucide-react';
import { BoardNode as BoardNodeType, useBoardContext } from '@/contexts/BoardContext';
import EditMenu from './EditMenu';

interface BoardNodeProps {
  node: BoardNodeType;
}

const BoardNode = ({ node }: BoardNodeProps) => {
  const {
    updateNode, removeNode, bringToFront,
    presentationMode, connectorMode, handleConnectorClick, pendingConnector,
  } = useBoardContext();

  const [isHovered, setIsHovered]     = useState(false);
  const [isDragging, setIsDragging]   = useState(false);
  const [isEditing, setIsEditing]     = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [editContent, setEditContent] = useState(node.content);

  // Refs for the two DOM layers
  const outerRef = useRef<HTMLDivElement>(null); // the positioned wrapper
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Drag state stored in a ref — no re-renders during the drag
  const drag = useRef<{
    startX: number; startY: number;
    originX: number; originY: number;
  } | null>(null);

  // ─── Editing ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    // Handle double-click based on node type
    switch (node.type) {
      case 'text':
      case 'sticky':
        // Edit text content
        setIsEditing(true);
        setEditContent(node.content);
        break;

      case 'image':
        // For images, you might want to:
        // - Open image in a modal/viewer
        // - Edit image source
        // - Or show edit menu (like below)
        setShowEditMenu(true);
        break;

      case 'color-swatch':
        // For color swatches, you might want to:
        // - Open color picker
        // - Edit color value
        // - Or show edit menu
        setShowEditMenu(true);
        break;

      default:
        break;
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    updateNode(node.id, { content: editContent });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBlur(); }
    if (e.key === 'Escape') { setIsEditing(false); setEditContent(node.content); }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only handle connector mode clicks here
    // All other interactions are handled by double-click
    if (connectorMode) {
      e.stopPropagation();
      handleConnectorClick(node.id);
      return;
    }
    // For non-connector mode, single click does nothing now
    // (You could optionally add selection/highlighting here)
  };

  // ─── Drag — pointer events, DOM-direct, no React state during move ──────────

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditing) return;
    if (e.button !== 0) return;
    // Don't drag when clicking the delete button or edit menu
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;

    e.preventDefault();
    const el = outerRef.current!;
    el.setPointerCapture(e.pointerId);
    bringToFront(node.id);
    setIsDragging(true);

    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: node.x,
      originY: node.y,
    };

    // Apply will-change once — promotes to GPU compositor layer
    el.style.willChange = 'transform';
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const newX = drag.current.originX + (e.clientX - drag.current.startX);
    const newY = drag.current.originY + (e.clientY - drag.current.startY);
    // Write directly to DOM — zero React involvement during the move
    outerRef.current!.style.transform =
      `translate3d(${newX}px, ${newY}px, 0) rotate(${node.rotation ?? 0}deg)`;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const finalX = drag.current.originX + (e.clientX - drag.current.startX);
    const finalY = drag.current.originY + (e.clientY - drag.current.startY);

    outerRef.current!.style.willChange = 'auto';
    drag.current = null;
    setIsDragging(false);

    // Single state commit — one re-render for the whole drag gesture
    updateNode(node.id, { x: finalX, y: finalY });
  };

  // ─── Render helpers ──────────────────────────────────────────────────────────

  const isSelected = pendingConnector === node.id;
  const isSticky   = node.type === 'sticky';

  const renderContent = () => {
    switch (node.type) {
      case 'image':
        return (
          <img
            src={node.content}
            alt="Board node"
            className="h-full w-full object-cover"
            draggable={false}
          />
        );

      case 'text':
      case 'sticky':
        return isEditing ? (
          <textarea
            ref={inputRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`w-full min-h-[60px] resize-none bg-transparent text-sm leading-relaxed focus:outline-none ${
              isSticky ? 'font-serif text-neutral-800' : 'text-foreground'
            }`}
            placeholder="Type something..."
          />
        ) : (
          <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
            isSticky ? 'font-serif text-neutral-800' : 'text-foreground/90'
          }`}>
            {node.content}
          </p>
        );

      case 'color-swatch':
        return <div className="w-full h-full" style={{ backgroundColor: node.content }} />;

      default:
        return null;
    }
  };

  // ─── Styles ──────────────────────────────────────────────────────────────────

  // OUTER: positions on canvas, overflow VISIBLE so buttons aren't clipped
  const outerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    // translate3d for the committed position; rotate for sticky tilt
    // During a drag this is overwritten directly by onPointerMove
    transform: `translate3d(${node.x}px, ${node.y}px, 0) rotate(${node.rotation ?? 0}deg)`,
    width:  node.width,
    height: node.height,
    zIndex: node.zIndex,
    overflow: 'visible',          // ← CRITICAL: lets buttons escape the boundary
    cursor: isDragging ? 'grabbing' : connectorMode ? 'crosshair' : 'grab',
    userSelect: 'none',
    // No transition here — transition on a dragged element makes it lag behind the cursor
  };

  // INNER card: safe to clip and round corners
  const innerCardClass = [
    'relative h-full rounded-xl',
    isDragging
      ? 'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] scale-[1.02]'
      : 'shadow-2xl',
    isSelected ? 'ring-2 ring-blue-500' : '',
    isSticky
      ? 'p-4'
      : node.type === 'text'
        ? 'p-4 border border-node-border bg-node-bg/80 backdrop-blur-md'
        : 'border border-node-border bg-node-bg/80 backdrop-blur-md overflow-hidden',
    // Only animate shadow/scale, NOT position — position is driven by transform on outer
    'transition-shadow transition-transform duration-200',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={outerRef}
      style={outerStyle}
      onPointerDown={startDrag}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleDoubleClick}  // Now handles all node types
      onClick={handleClick}               // Only handles connector mode now
    >
      {/*
        ── UI chrome lives on OUTER ──────────────────────────────────────────
        Because outer has overflow:visible these buttons are never clipped,
        even when the inner card has overflow:hidden or border-radius.
        zIndex here only needs to beat siblings inside this stacking context.
      */}
      {isHovered && !presentationMode && !isEditing && (
        <>
          {/* Delete — top-right, outside card boundary */}
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
        </>
      )}

      {/* ── Inner card ── safe to have overflow:hidden / border-radius ──────── */}
      <div
        className={innerCardClass}
        style={isSticky ? {
          backgroundColor: `hsl(${node.stickyColor})`,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
        } : undefined}
      >
        {renderContent()}
      </div>

      {/* Edit Menu */}
      {showEditMenu && !presentationMode && (
        <EditMenu node={node} onClose={() => setShowEditMenu(false)} />
      )}
    </div>
  );
};

export default BoardNode;
