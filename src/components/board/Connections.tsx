/**
 * Connections.tsx
 *
 * Lives INSIDE the panned content layer — pure canvas-space coordinates.
 *
 * BUG FIX (connection delete):
 * pointer-events="stroke" must be an SVG *attribute*, not a CSS style property.
 * On SVG elements, the CSS `pointer-events` property is overridden by the
 * presentation attribute in most browsers. We now set it as a JSX attribute
 * directly: <path pointerEvents="stroke" ...>
 *
 * BUG FIX (anchor positions for flex-height nodes):
 * Uses node.renderedHeight (synced by ResizeObserver in BoardNode) instead of
 * node.height, so sticky/text anchors track the real current card size.
 */

import { useBoardContext, type BoardNode, type Connection } from '@/contexts/BoardContext';

// ─── Anchor geometry ──────────────────────────────────────────────────────────

type Side = 'top' | 'right' | 'bottom' | 'left';
interface Anchor { side: Side; x: number; y: number; }

const N: Record<Side, [number, number]> = {
  top:    [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0],
};

function h(n: BoardNode) { return n.renderedHeight ?? n.height ?? 80; }
function w(n: BoardNode) { return n.width ?? 200; }

function anchors(n: BoardNode): Anchor[] {
  const W = w(n), H = h(n), cx = n.x + W / 2, cy = n.y + H / 2;
  return [
    { side: 'top',    x: cx,       y: n.y     },
    { side: 'right',  x: n.x + W,  y: cy      },
    { side: 'bottom', x: cx,       y: n.y + H },
    { side: 'left',   x: n.x,      y: cy      },
  ];
}

function d2(ax: number, ay: number, bx: number, by: number) {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

function best(a: BoardNode, b: BoardNode) {
  const aa = anchors(a), ba = anchors(b);
  let r = { a: aa[0], b: ba[0], d: Infinity };
  for (const ai of aa) for (const bi of ba) {
    const d = d2(ai.x, ai.y, bi.x, bi.y);
    if (d < r.d) r = { a: ai, b: bi, d };
  }
  return r;
}

function path(from: BoardNode, to: BoardNode): string {
  const { a, b } = best(from, to);
  const dist = Math.sqrt(d2(a.x, a.y, b.x, b.y));
  const cd   = Math.min(320, Math.max(60, dist * 0.45));
  const [anx, any] = N[a.side], [bnx, bny] = N[b.side];
  return `M ${a.x} ${a.y} C ${a.x + anx * cd} ${a.y + any * cd}, ${b.x + bnx * cd} ${b.y + bny * cd}, ${b.x} ${b.y}`;
}

// ─── Stroke style ─────────────────────────────────────────────────────────────

function stroke(type: Connection['type'] = 'default') {
  switch (type) {
    case 'solid':  return { dash: undefined, op: 0.85 };
    case 'dashed': return { dash: '8 5',     op: 0.75 };
    default:       return { dash: '5 4',     op: 0.65 };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const Connections = () => {
  const { nodes, connections, removeConnection } = useBoardContext();
  if (!connections.length) return null;

  const map = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg style={{
      position: 'absolute', top: 0, left: 0,
      width: 10_000, height: 10_000, overflow: 'visible',
      pointerEvents: 'none', zIndex: 0,
    }}>
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>

      {connections.map((c) => {
        const from = map.get(c.fromId), to = map.get(c.toId);
        if (!from || !to) return null;
        const d = path(from, to);
        const { dash, op } = stroke(c.type);
        return (
          <g key={c.id}>
            {/* Visible stroke */}
            <path d={d} fill="none"
              stroke="hsl(var(--foreground))" strokeWidth={1.5}
              strokeOpacity={op} strokeDasharray={dash}
              strokeLinecap="round" markerEnd="url(#arr)" />

            {/* Hit target — NOTE: pointerEvents as JSX attribute, not CSS style.
                SVG presentation attributes take precedence over CSS on SVG elements. */}
            <path d={d} fill="none" stroke="transparent" strokeWidth={16}
              pointerEvents="stroke"
              style={{ cursor: 'pointer' }}
              onClick={() => removeConnection(c.id)}
              aria-label="Click to remove" />
          </g>
        );
      })}
    </svg>
  );
};

export default Connections;
