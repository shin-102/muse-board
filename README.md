# Muse-Board

A fast, minimal whiteboard for visual thinking. Drop images, text, sticky notes, and colour swatches onto an infinite canvas, draw connections between ideas, and present without clutter.

Built with React, TypeScript, Tailwind CSS, and Vite.

---

## Features

### Canvas
- **Infinite pan** — Space + drag or middle-mouse drag to move around
- **Dot-grid background** that tracks the pan offset
- **Lasso selection** — click-drag on empty space to select multiple nodes at once
- **Shift-click** to toggle individual nodes in/out of a selection

### Nodes
| Type | Description |
|------|-------------|
| **Image** | Drop a placeholder or double-click to upload your own |
| **Text** | Rich-text block with bold, italic, and variable font size |
| **Sticky note** | Slightly rotated, pastel-coloured note with serif font |
| **Colour swatch** | Solid colour tile, fully customisable |

All nodes are draggable, stackable (z-order), and deletable.

### Connections
- Enter **connector mode** (Spline button), click a source node, click a target node
- Lines are **cubic Bézier curves** that exit from the nearest anchor face (top / right / bottom / left) and never slice through the node body
- Click any connection line to **delete** it
- Connector mode exits automatically after each connection is drawn

### Toolbar
Two-tier layout anchored to the bottom of the screen:

**Primary bar** (always visible):

```
CREATE          │ SECONDARY │ ARRANGE          │ CANVAS
Image  Text     │ Swatch    │ Connector  Group │ Present  Clear
Sticky          │           │                  │
```

**Secondary bar** (appears on selection or in connector mode):
- **Connector mode** — shows a status hint and a cancel button; replaces all other secondary content while active
- **Image selected** — Replace image button
- **Colour swatch selected** — 12 preset dots, custom colour picker, hex input
- **Text / sticky selected** — Bold, Italic, six font-size options
- **Any node** — Bring to Front, Send to Back, Delete
- **Multi-select** — node count + Delete all

### Other
- **Grouping** — select two or more nodes and group them so they drag together
- **Presentation mode** — hides all UI chrome; double-click and editing are disabled
- **Rich text** — bold and italic apply to selected text via `document.execCommand`; font size is stored per-node

---

## Tech stack

| | |
|---|---|
| Framework | React 18 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Build | Vite |
| State | React Context + `useCallback` / `useMemo` |

No external drag-and-drop library. All pointer interactions are implemented with native pointer events and direct DOM transforms for zero-jank dragging.

---

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

```bash
pnpm build   # production build
pnpm preview # preview the build locally
```

---

## Project structure

```
src/
├── components/
│   └── board/
│       ├── BoardNode.tsx     # Individual node — drag, edit, resize
│       ├── Canvas.tsx        # Infinite canvas — pan, lasso, pointer routing
│       ├── Connections.tsx   # SVG Bézier connector lines
│       └── Toolbar.tsx       # Primary + secondary toolbar
├── contexts/
│   └── BoardContext.tsx      # Global state — nodes, connections, groups, pan
├── pages/
│   └── Index.tsx
└── main.tsx
```

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Double-click text / sticky | Enter edit mode |
| `Escape` | Cancel edit (reverts changes) |
| `Ctrl + Enter` | Commit edit |
| `Space + drag` | Pan the canvas |
| `Shift + click` node | Add / remove from selection |
