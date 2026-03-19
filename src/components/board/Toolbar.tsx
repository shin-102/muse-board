import { useState, useRef } from 'react';
import {
  Image, Type, StickyNote, Palette, Spline,
  Group, Ungroup, Presentation, Trash2, X,
  ImageUp, ArrowUpToLine, ArrowDownToLine,
  Bold, Italic,
} from 'lucide-react';
import { useBoardContext } from '@/contexts/BoardContext';
import { activeEditRef } from './BoardNode';

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
const TBtn = ({ onClick, title, active, danger, children, className = '' }: TBtnProps) => (
  <button
    onClick={onClick}
    title={title}
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
// Applies a rich-text command to whatever contentEditable is currently active.
// Works whether the node is mid-edit (activeEditRef set) or the user clicked
// a toolbar button while the node retained focus.

function fmt(cmd: string) {
  const el = activeEditRef.current;
  if (el) {
    el.focus();
    document.execCommand(cmd, false);
  } else {
    // Fallback: try the document's active element if it's a contentEditable
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

  // Hidden when nothing is happening
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
      <div className="flex items-center gap-2 rounded-2xl bg-toolbar-bg/80 backdrop-blur-md border border-toolbar-border px-4 py-2 shadow-2xl">
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
          onClick={toggleConnectorMode}
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
    <div className="flex items-center gap-1 rounded-2xl bg-toolbar-bg/80 backdrop-blur-md border border-toolbar-border px-2 py-2 shadow-2xl">

      {/* ── IMAGE ──────────────────────────────────────────────────────────── */}
      {isImage && sel && (
        <>
          <button
            onClick={() => fileRef.current?.click()}
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
              onClick={() => { updateNode(sel.id, { content: c }); setHex(c); }}
              className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 shrink-0"
              style={{
                backgroundColor: c,
                borderColor: color === c ? 'hsl(var(--foreground))' : 'transparent',
              }}
              title={c}
            />
          ))}
          <Div />
          <button
            onClick={() => colorRef.current?.click()}
            className="relative h-6 w-6 rounded-full border-2 border-dashed border-border hover:border-foreground transition-colors shrink-0 overflow-hidden"
            style={{ backgroundColor: color }}
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
          {/* Formatting */}
          <TBtn onClick={() => fmt('bold')}   title="Bold (Ctrl+B)">   <Bold   className="h-4 w-4" /></TBtn>
          <TBtn onClick={() => fmt('italic')} title="Italic (Ctrl+I)"> <Italic className="h-4 w-4" /></TBtn>
          <Div />
          {/* Font size */}
          {FONT_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => updateNode(sel.id, { fontSize: s })}
              className={[
                'h-8 min-w-[2rem] rounded-lg px-1.5 text-xs transition-all duration-150 shrink-0 tabular-nums',
                (sel.fontSize ?? 14) === s
                  ? 'bg-accent text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              ].join(' ')}
              title={`Font size ${s}`}
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
//
//   CREATE         │ SECONDARY    │ ARRANGE          │ CANVAS
//   Image  Text    │ Swatch       │ Connector  Group │ Present  Clear
//   Sticky         │              │                  │

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
        onClick={togglePresentationMode}
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
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex flex-col items-center gap-2">

      {/* Secondary bar — only when selection or connector mode */}
      <SecondaryBar />

      {/* Primary bar */}
      <div className="flex items-center gap-1 rounded-2xl bg-toolbar-bg/80 backdrop-blur-md border border-toolbar-border px-2 py-2 shadow-2xl">

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
          {showClear && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 rounded-xl bg-popover border border-border p-3 shadow-2xl backdrop-blur-md">
              <p className="text-xs text-foreground text-center mb-2">Clear entire board?</p>
              <div className="flex gap-2">
                <button onClick={() => setShowClear(false)}
                  className="flex-1 rounded-lg bg-secondary text-foreground text-xs py-1.5 hover:bg-accent">Cancel</button>
                <button onClick={() => { clearBoard(); setShowClear(false); }}
                  className="flex-1 rounded-lg bg-destructive text-destructive-foreground text-xs py-1.5 hover:opacity-90">Clear</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Toolbar;
