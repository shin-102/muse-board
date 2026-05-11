# Muse-Canvas

A fast, minimal whiteboard for visual thinking. Drop images, text, sticky notes, and colour swatches onto an infinite canvas, draw connections between ideas, and present without clutter.

Built with React, TypeScript, Tailwind CSS, and Vite.

---

## Features

### Canvas
- **Infinite pan** — Space + drag or middle-mouse drag to move around.
- **Dot-grid background** that tracks the pan offset seamlessly.
- **Lasso selection** — Click-drag on empty space to select multiple nodes at once.
- **Shift-click** to toggle individual nodes in/out of a selection.

### Nodes
| Type | Description |
|------|-------------|
| **Image** | Drop a placeholder or double-click to upload your own (stored as Base64). |
| **Text** | Rich-text block with bold, italic, and variable font size. |
| **Sticky note** | Slightly rotated, pastel-coloured note with serif font. |
| **Colour swatch** | Solid colour tile, fully customisable via hex or picker. |

All nodes are draggable, stackable (z-order), and deletable. Editing is triggered via double-click, changing the cursor from `grab` to `text`.

### Connections
- Enter **connector mode** (Spline button), click a source node, click a target node.
- Lines are **cubic Bézier curves** that exit from the nearest anchor face and never slice through the node body.
- Click any connection line to **delete** it.
- Connector mode exits automatically after each connection is drawn.

### Sidebar (Navigation & Files)
A collapsible sidebar on the left for project-level actions:
- **Theme Toggle** — Switch between Light and Dark mode.
- **Export JSON** — Saves the entire board state (nodes, connections, groups, and pan position) to a local file.
- **Import JSON** — Load a previously saved board file to restore your workspace.

### Toolbar
Two-tier layout anchored to the bottom of the screen:

**Primary bar** (always visible):
```
CREATE          │ SECONDARY │ ARRANGE          │ CANVAS
Image   Text    │ Swatch    │ Connector  Group │ Present  Clear
Sticky          │           │                  │
```

**Secondary bar** (appears on selection or in connector mode):
- **Connector mode** — shows a status hint and a cancel button.
- **Text / sticky selected** — Bold, Italic, and font-size options (11px to 24px) with focus-retention logic.
- **Any node** — Bring to Front, Send to Back, Delete.
- **Multi-select** — Node count + "Delete all" functionality.

### Interaction Logic
- **Focus Retention** — Toolbar buttons use `onMouseDown` preventing focus loss, allowing you to style text without losing your selection.
- **Auto-Focus** — Changing font size while editing automatically re-focuses the text area.
- **Smart Cursors** — The cursor stays as a `grab` hand for better UX, only switching to a `text` I-beam when actively editing.
- **UI Portaling** — Critical UI overlays (like the Clear Board prompt) are rendered via React Portals to the document root. This prevents nested layout constraints and ensures zero horizontal scrolling on mobile browsers.
- **Event Isolation** — Comprehensive use of `stopPropagation` and `onPointerDown` ensures that toolbar interactions never bleed through to the canvas background.
- 
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
│   ├── board/
│   │   ├── BoardNode.tsx     # Individual node — drag, edit, resize, style logic
│   │   ├── Canvas.tsx        # Infinite canvas — pan, lasso, pointer routing
│   │   ├── Connections.tsx   # SVG Bézier connector lines
│   │   └── Toolbar.tsx       # Primary + secondary toolbar + execCommand logic
│   ├── SideBar.tsx           # File I/O and Theme controls
│   └── ThemeProvider.tsx     # Dark/Light mode context
├── contexts/
│   └── BoardContext.tsx      # Global state — nodes, connections, groups, pan, hydration
├── lib/
│   ├── board-io.ts           # File System API / Blob export logic
│   └── utils.ts              # Tailwind merging (cn)
├── pages/
│   └── Index.tsx             # Main entry point with BoardProvider
└── main.tsx
```

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| **Double-click** | Enter edit mode (Text/Sticky) or Upload (Image) |
| `Escape` | Cancel edit (reverts changes) |
| `Ctrl + Enter` | Commit edit and exit |
| `Ctrl + B` | Bold selected text |
| `Ctrl + I` | Italicize selected text |
| `Space + drag` | Pan the canvas |
| `Shift + click` | Add / remove node from selection |
