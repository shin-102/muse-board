import { useState } from 'react';
import { Image, Type, Palette, Presentation, X, StickyNote, Spline, Trash2 } from 'lucide-react';
import { useBoardContext } from '@/contexts/BoardContext';

const Toolbar = () => {
  const { addNode, presentationMode, togglePresentationMode, connectorMode, toggleConnectorMode, clearBoard, nodes } = useBoardContext();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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

  const tools = [
    { icon: Image, label: 'Add Image', action: () => addNode('image') },
    { icon: Type, label: 'Add Text', action: () => addNode('text') },
    { icon: Palette, label: 'Add Color Swatch', action: () => addNode('color-swatch') },
    { icon: StickyNote, label: 'Add Sticky Note', action: () => addNode('sticky') },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-2xl bg-toolbar-bg/80 backdrop-blur-md border border-toolbar-border px-2 py-2 shadow-2xl">
        {tools.map((tool, index) => (
          <button
            key={index}
            onClick={tool.action}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
            title={tool.label}
          >
            <tool.icon className="h-5 w-5" />
          </button>
        ))}

        <div className="w-px h-6 bg-border mx-1" />

        {/* Connector Mode */}
        <button
          onClick={toggleConnectorMode}
          className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 ${
            connectorMode ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
          title="Connector Mode"
        >
          <Spline className="h-5 w-5" />
        </button>

        {/* Presentation */}
        <button
          onClick={togglePresentationMode}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
          title="Presentation Mode"
        >
          <Presentation className="h-5 w-5" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Clear Board */}
        <div className="relative">
          <button
            onClick={() => {
              if (nodes.length === 0) return;
              setShowClearConfirm(true);
            }}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-accent transition-all duration-200"
            title="Clear Board"
          >
            <Trash2 className="h-5 w-5" />
          </button>

          {showClearConfirm && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 rounded-xl bg-popover border border-border p-3 shadow-2xl backdrop-blur-md transition-all duration-200">
              <p className="text-xs text-foreground text-center mb-2">Clear entire board?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 rounded-lg bg-secondary text-foreground text-xs py-1.5 hover:bg-accent transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    clearBoard();
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 rounded-lg bg-destructive text-destructive-foreground text-xs py-1.5 hover:opacity-90 transition-all duration-200"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
