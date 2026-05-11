import { useState, useRef } from 'react';
import {
  Image, Type, StickyNote, Palette, Spline,
  Group, Ungroup, Presentation, Trash2, X,
  ImageUp, ArrowUpToLine, ArrowDownToLine,
  Bold, Italic,
} from 'lucide-react';
import { useBoardContext } from '@/contexts/BoardContext';
import { activeEditRef } from './BoardNode';
import { createPortal } from 'react-dom';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#f43f5e', '#ef4444', '#f97316', '#f59e0b',
  '#84cc16', '#10b981', '#06b6d4', '#3b82f6',
  '#8b5cf6', '#ec4899', '#ffffff', '#1e293b',
];

const FONT_SIZES = [11, 13, 14, 16, 18, 24];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const Div = () => <div className="w-px h-6 bg-border mx-0.5 shrink-0" />;

interface TBtnProps {
  onClick: () => void;
  title: string;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
  className?: string;
}

// TBtn uses onPointerDown with `touch-action: manipulation` so it works on
// both mouse (desktop) and touch (mobile) without stealing focus from editing nodes.
// We add an explicit data attribute and stop propagation so UI interactions are
// clearly identifiable as UI-origin and won't accidentally drive canvas logic.
const TBtn = ({ onClick, title, active, danger, children, className = '' }: TBtnProps) => (
  <button
    data-muse-ui="true"
    // Capture-phase handlers: mark a short-lived global “UI active” flag and
    // dispatch a `muse-ui-activate` event so the Canvas (and any other listener)
    // can react to UI interactions quickly and robustly. We also toggle a CSS
    // class on the documentElement (`muse-ui-active`) so downstream listeners
    // that rely on a simple DOM-class check can detect UI activity.
    onPointerDownCapture={(e) => {
      try {
        const now = Date.now();
        (window as any).__muse_last_ui = now;
        document.documentElement.dataset.museLastUi = String(now);
        // set a short-lived UI-active flag and clear any previous timer
        (window as any).__muse_ui_active = true;
        // add class so canvas can quickly check `.classList.contains('muse-ui-active')`
        try { document.documentElement.classList.add('muse-ui-active'); } catch (err) { /* ignore */ }
        if ((window as any).__muse_ui_timeoutId) { clearTimeout((window as any).__muse_ui_timeoutId); }
        (window as any).__muse_ui_timeoutId = setTimeout(() => {
          try { (window as any).__muse_ui_active = false; } catch (err) { /* ignore */ }
          try { document.documentElement.classList.remove('muse-ui-active'); } catch (err) { /* ignore */ }
        }, 700);
        // Dispatch a CustomEvent to signal UI activation. Include a small rect
        // summary if possible so listeners can make spatial decisions.
        try {
          const t = e.target as HTMLElement | null;
          let rectDetail = null;
          if (t && t.getBoundingClientRect) {
            const r = t.getBoundingClientRect();
            rectDetail = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
          }
          const ev = new CustomEvent('muse-ui-activate', { detail: { time: now, rect: rectDetail } });
          document.dispatchEvent(ev);
        } catch (err) { /* ignore details if dispatch fails */ }
      } catch (err) { /* ignore */ }
      e.stopPropagation();
    }}
    onTouchStartCapture={(e) => {
      try {
        const now = Date.now();
        (window as any).__muse_last_ui = now;
        document.documentElement.dataset.museLastUi = String(now);
        // set UI-active flag and schedule clear
        (window as any).__muse_ui_active = true;
        // add class for quick DOM guard
        try { document.documentElement.classList.add('muse-ui-active'); } catch (err) { /* ignore */ }
        if ((window as any).__muse_ui_timeoutId) { clearTimeout((window as any).__muse_ui_timeoutId); }
        (window as any).__muse_ui_timeoutId = setTimeout(() => {
          try { (window as any).__muse_ui_active = false; } catch (err) { /* ignore */ }
          try { document.documentElement.classList.remove('muse-ui-active'); } catch (err) { /* ignore */ }
        }, 700);
        // Dispatch muse-ui-activate event for touchstart as well
        try {
          const t0 = e.touches && e.touches[0];
          let rectDetail = null;
          const t = e.target as HTMLElement | null;
          if (t && t.getBoundingClientRect) {
            const r = t.getBoundingClientRect();
            rectDetail = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
          } else if (t0 && typeof t0.clientX === 'number' && typeof t0.clientY === 'number') {
            rectDetail = { x: t0.clientX, y: t0.clientY };
          }
          const ev = new CustomEvent('muse-ui-activate', { detail: { time: now, rect: rectDetail } });
          document.dispatchEvent(ev);
        } catch (err) { /* ignore details if dispatch fails */ }
      } catch (err) { /* ignore */ }
      e.stopPropagation();
    }}
    // Use onPointerDown so the button responds immediately on touch.
    // e.preventDefault() stops the button from blurring contentEditable nodes.
    onPointerDown={(e) => {
      // STOP propagation so the canvas doesn't think we are clicking it
      e.stopPropagation();
      // We do NOT preventDefault here, so the 'click' event can still fire on mobile
    }}
    onClick={(e) => {
      e.stopPropagation();
      e.preventDefault();

      // Move UI-Guard logic here
      try {
        const now = Date.now();
        (window as any).__muse_last_ui = now;
        document.documentElement.dataset.museLastUi = String(now);
        (window as any).__muse_ui_active = true;
        document.documentElement.classList.add('muse-ui-active');

        if ((window as any).__muse_ui_timeoutId) clearTimeout((window as any).__muse_ui_timeoutId);
        (window as any).__muse_ui_timeoutId = setTimeout(() => {
          (window as any).__muse_ui_active = false;
          document.documentElement.classList.remove('muse-ui-active');
        }, 300); // Reduced to 300ms for better responsiveness
      } catch (err) { /* ignore */ }

      onClick();
    }}
    // Ensure clicks that arrive via other input paths don't bubble to the canvas
    title={title}
    style={{ touchAction: 'manipulation' }}
    className={[
      'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 shrink-0',
      active ? 'bg-accent text-foreground'
             : danger
               ? 'text-muted-foreground hover:text-destructive hover:bg-accent'
               : 'text-muted-foreground hover:text-foreground hover:bg-accent',
      className,
    ].join(' ')}
  >
    {children}
  </button>
);

// ─── execCommand helper ───────────────────────────────────────────────────────

function fmt(cmd: string) {
  const el = activeEditRef.current;
  if (el) {
    el.focus();
    document.execCommand(cmd, false);
  } else {
    const ae = document.activeElement as HTMLElement | null;
    if (ae?.isContentEditable) document.execCommand(cmd, false);
  }
}

// ─── Secondary bar ────────────────────────────────────────────────────────────

const SecondaryBar = () => {
  const {
    nodes, selectedIds, updateNode, removeNode,
    bringToFront, sendToBack,
    connectorMode, toggleConnectorMode, pendingConnector,
  } = useBoardContext();

  const colorRef = useRef<HTMLInputElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const [hex, setHex] = useState('');

  const sel    = selectedIds.size === 1 ? nodes.find((n) => n.id === [...selectedIds][0]) : undefined;
  const many   = selectedIds.size > 1;
  const hasAny = !!sel || many;

  const isSwatch = sel?.type === 'color-swatch';
  const isText   = sel?.type === 'text' || sel?.type === 'sticky';
  const isImage  = sel?.type === 'image';
  const color    = isSwatch ? sel!.content : '#ffffff';

  if (!hasAny && !connectorMode) return null;

  const applyHex = (raw: string) => {
    const v = raw.startsWith('#') ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v) && isSwatch && sel)
      updateNode(sel.id, { content: v });
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !sel) return;
    const reader = new FileReader();
    reader.onload = (ev) => { const u = ev.target?.result as string; if (u) updateNode(sel.id, { content: u }); };
    reader.readAsDataURL(f); e.target.value = '';
  };

  // ── Connector mode hijacks the bar ────────────────────────────────────────
  if (connectorMode) {
    return (
      <div data-muse-ui="true" onPointerDown={(e) => e.stopPropagation()} style={{ touchAction: 'manipulation' }} className="flex items-center gap-2 rounded-2xl bg-toolbar-bg/80 backdrop-blur-md border border-toolbar-border px-4 py-2 shadow-2xl">
        <span className={[
          'h-2 w-2 rounded-full shrink-0',
          pendingConnector ? 'bg-blue-500 animate-pulse' : 'bg-muted-foreground',
        ].join(' ')} />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {pendingConnector
            ? 'Now click the target node to finish'
            : 'Click any node to start a connection'}
        </span>
        <button
          data-muse-ui="true"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleConnectorMode(); }}
          style={{ touchAction: 'manipulation' }}
          className="ml-2 flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // ── Node editing bar ──────────────────────────────────────────────────────
  return (
    <div data-muse-ui="true" onPointerDown={(e) => e.stopPropagation()} style={{ touchAction: 'pan-x' }} className="flex items-center gap-1 rounded-2xl bg-toolbar-bg/80 backdrop-blur-md border border-toolbar-border px-2 py-2 shadow-2xl max-w-[95vw] overflow-x-auto">

      {/* ── IMAGE ──────────────────────────────────────────────────────────── */}
      {isImage && sel && (
        <>
          <button
            data-muse-ui="true"
            onPointerDown={(e) => { e.stopPropagation(); }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              fileRef.current?.click();
            }}
            style={{ touchAction: 'manipulation' }}
            className="flex items-center gap-2 h-10 rounded-xl px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150 shrink-0"
            title="Replace image"
          >
            <ImageUp className="h-4 w-4 shrink-0" />
            Replace image
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <Div />
        </>
      )}

      {/* ── COLOUR SWATCH ──────────────────────────────────────────────────── */}
      {isSwatch && sel && (
        <>
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              data-muse-ui="true"
              onPointerDown={(e) => { e.stopPropagation(); }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                updateNode(sel.id, { content: c });
                setHex(c);
              }}
              style={{
                touchAction: 'manipulation',
                backgroundColor: c,
                borderColor: color === c ? 'hsl(var(--foreground))' : 'transparent',
              }}
              className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 shrink-0"
              title={c}
            />
          ))}
          <Div />
          <button
            data-muse-ui="true"
            onPointerDown={(e) => { e.stopPropagation(); }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              colorRef.current?.click();
            }}
            style={{ touchAction: 'manipulation', backgroundColor: color }}
            className="relative h-6 w-6 rounded-full border-2 border-dashed border-border hover:border-foreground transition-colors shrink-0 overflow-hidden"
            title="Custom colour"
          >
            <input
              ref={colorRef} type="color" value={color} className="sr-only"
              onChange={(e) => { updateNode(sel.id, { content: e.target.value }); setHex(e.target.value); }}
            />
          </button>
          <input
            type="text" maxLength={7}
            placeholder={color}
            value={hex || color}
            onChange={(e) => setHex(e.target.value)}
            onBlur={(e) => applyHex(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyHex((e.target as HTMLInputElement).value); }}
            className="w-[5.5rem] rounded-lg border border-border bg-background px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary shrink-0"
            spellCheck={false}
          />
          <Div />
        </>
      )}

      {/* ── TEXT / STICKY ──────────────────────────────────────────────────── */}
      {isText && sel && (
        <>
          <TBtn onClick={() => fmt('bold')}   title="Bold (Ctrl+B)">   <Bold   className="h-4 w-4" /></TBtn>
          <TBtn onClick={() => fmt('italic')} title="Italic (Ctrl+I)"> <Italic className="h-4 w-4" /></TBtn>
          <Div />
          {FONT_SIZES.map((s) => (
            <button
              key={s}
              data-muse-ui="true"
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                updateNode(sel.id, { fontSize: s });
              }}
              style={{ touchAction: 'manipulation' }}
              className={[
                'h-8 min-w-[2rem] rounded-lg px-1.5 text-xs transition-all duration-150 shrink-0 tabular-nums',
                (sel.fontSize ?? 14) === s
                  ? 'bg-accent text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
          <Div />
        </>
      )}

      {/* ── MULTI-SELECT count ─────────────────────────────────────────────── */}
      {many && (
        <>
          <span className="text-xs text-muted-foreground px-2 shrink-0">
            {selectedIds.size} selected
          </span>
          <Div />
        </>
      )}

      {/* ── UNIVERSAL: z-order + delete (single node) ──────────────────────── */}
      {sel && (
        <>
          <TBtn onClick={() => bringToFront(sel.id)} title="Bring to front">
            <ArrowUpToLine className="h-4 w-4" />
          </TBtn>
          <TBtn onClick={() => sendToBack(sel.id)} title="Send to back">
            <ArrowDownToLine className="h-4 w-4" />
          </TBtn>
          <Div />
          <TBtn onClick={() => removeNode(sel.id)} title="Delete node" danger>
            <Trash2 className="h-4 w-4" />
          </TBtn>
        </>
      )}

      {/* ── MULTI: delete all ─────────────────────────────────────────────── */}
      {many && (
        <TBtn
          onClick={() => [...selectedIds].forEach((id) => removeNode(id))}
          title={`Delete ${selectedIds.size} nodes`}
          danger
        >
          <Trash2 className="h-4 w-4" />
        </TBtn>
      )}
    </div>
  );
};

// ─── Primary toolbar ──────────────────────────────────────────────────────────

const Toolbar = () => {
  const {
    addNode,
    presentationMode, togglePresentationMode,
    connectorMode, toggleConnectorMode,
    clearBoard, nodes,
    selectedIds, groupSelected, ungroupNodes, getGroupForNode,
    pendingConnector,
  } = useBoardContext();

  const [showClear, setShowClear] = useState(false);

  if (presentationMode) {
    return (
      <button
        data-muse-ui="true"
        onPointerDown={(e) => { e.stopPropagation(); }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          togglePresentationMode();
        }}
        style={{ touchAction: 'manipulation' }}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-toolbar-bg/80 backdrop-blur-md border border-toolbar-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
        title="Exit Presentation Mode"
      >
        <X className="h-5 w-5" />
      </button>
    );
  }

  const canGroup         = selectedIds.size >= 2;
  const connectorActive  = connectorMode && !pendingConnector;
  const connectorPending = connectorMode &&  pendingConnector;

  const groupId = (() => {
    if (selectedIds.size < 2) return null;
    const ids = [...selectedIds];
    const g   = getGroupForNode(ids[0]);
    if (!g) return null;
    return ids.every((id) => getGroupForNode(id)?.id === g.id) ? g.id : null;
  })();

  return (
    <div data-muse-ui="true" className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 flex flex-col items-center gap-2 max-w-[95vw]">

      {/* Secondary bar — only when selection or connector mode */}
      <SecondaryBar />

      {/* Primary bar */}
      <div
        data-muse-ui="true"
        onPointerDown={(e) => e.stopPropagation()}
        style={{ touchAction: 'pan-x' }}
        className="flex items-center gap-1 rounded-2xl bg-toolbar-bg/80 backdrop-blur-md border border-toolbar-border px-2 py-2 shadow-2xl overflow-x-auto sm:overflow-x-visible max-w-full"
      >

        {/* CREATE */}
        <TBtn onClick={() => addNode('image')}  title="Add image">      <Image      className="h-5 w-5" /></TBtn>
        <TBtn onClick={() => addNode('text')}   title="Add text">       <Type       className="h-5 w-5" /></TBtn>
        <TBtn onClick={() => addNode('sticky')} title="Add sticky note"><StickyNote className="h-5 w-5" /></TBtn>

        {/* SECONDARY TOOLS */}
        <Div />
        <TBtn onClick={() => addNode('color-swatch')} title="Add colour swatch"><Palette className="h-5 w-5" /></TBtn>

        {/* ARRANGE */}
        <Div />
        <TBtn
          onClick={toggleConnectorMode}
          title={connectorMode ? 'Cancel connector' : 'Connect nodes'}
          active={connectorActive}
          className={connectorPending ? 'bg-blue-500/20 text-blue-500 ring-2 ring-blue-500/50' : ''}
        >
          <Spline className="h-5 w-5" />
        </TBtn>

        {canGroup && (
          groupId
            ? <TBtn onClick={() => ungroupNodes(groupId)} title="Ungroup"><Ungroup className="h-5 w-5" /></TBtn>
            : <TBtn onClick={groupSelected}               title="Group selected"><Group className="h-5 w-5" /></TBtn>
        )}

        {/* CANVAS */}
        <Div />
        <TBtn onClick={togglePresentationMode} title="Presentation mode"><Presentation className="h-5 w-5" /></TBtn>

        <div className="relative">
          <TBtn onClick={() => { if (nodes.length) setShowClear(true); }} title="Clear board" danger>
            <Trash2 className="h-5 w-5" />
          </TBtn>

          {showClear && createPortal(
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                onClick={() => setShowClear(false)}
              />

              {/* The Prompt Box */}
              <div
                className="relative w-full max-w-[280px] rounded-2xl bg-popover border border-border p-6 shadow-2xl animate-in zoom-in-95"
              >
                <p className="text-sm font-medium text-center mb-6">Clear everything?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowClear(false)}
                    className="flex-1 rounded-xl bg-secondary py-3 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      clearBoard();
                      setShowClear(false);
                    }}
                    className="flex-1 rounded-xl bg-destructive text-destructive-foreground py-3 text-xs font-semibold"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>

      </div>
    </div>
  );
};

export default Toolbar;
