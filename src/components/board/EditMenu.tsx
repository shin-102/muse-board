import { useState, useRef, useEffect } from 'react';
import { BoardNode, useBoardContext } from '@/contexts/BoardContext';

interface EditMenuProps {
  node: BoardNode;
  onClose: () => void;
}

const swatchColors = [
  '#E5E5E5', '#FCA5A5', '#FCD34D', '#86EFAC',
  '#93C5FD', '#C4B5FD', '#F9A8D4', '#FDBA74',
];

const EditMenu = ({ node, onClose }: EditMenuProps) => {
  const { updateNode } = useBoardContext();
  const [urlInput, setUrlInput] = useState(node.content);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (node.type === 'image') {
    return (
      <div
        ref={menuRef}
        className="absolute top-full left-0 mt-2 w-64 rounded-xl bg-popover border border-border p-3 shadow-2xl backdrop-blur-md transition-all duration-200"
        style={{ zIndex: 10000 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <label className="text-xs text-muted-foreground mb-1.5 block">Image URL</label>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateNode(node.id, { content: urlInput });
              onClose();
            }
          }}
          className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all duration-200"
          placeholder="https://..."
          autoFocus
        />
        <button
          onClick={() => {
            updateNode(node.id, { content: urlInput });
            onClose();
          }}
          className="mt-2 w-full rounded-lg bg-accent hover:bg-secondary text-foreground text-xs py-1.5 transition-all duration-200"
        >
          Update
        </button>
      </div>
    );
  }

  if (node.type === 'color-swatch') {
    return (
      <div
        ref={menuRef}
        className="absolute top-full left-0 mt-2 w-48 rounded-xl bg-popover border border-border p-3 shadow-2xl backdrop-blur-md transition-all duration-200"
        style={{ zIndex: 10000 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <label className="text-xs text-muted-foreground mb-2 block">Pick a color</label>
        <div className="grid grid-cols-4 gap-2">
          {swatchColors.map((color) => (
            <button
              key={color}
              onClick={() => {
                updateNode(node.id, { content: color });
                onClose();
              }}
              className={`h-8 w-8 rounded-lg border-2 hover:scale-110 transition-all duration-200 ${
                node.content === color ? 'border-foreground' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    );
  }

  return null;
};

export default EditMenu;
