import { useBoardContext } from '@/contexts/BoardContext';
import BoardNode from './BoardNode';
import Connections from './Connections';

const Canvas = () => {
  const { nodes, presentationMode, canvasCursor } = useBoardContext();

  return (
    <div
      className={`fixed inset-0 overflow-hidden transition-colors duration-500 ${
        presentationMode ? 'bg-black' : 'bg-background'
      }`}
      style={{
        cursor: canvasCursor,
        ...(presentationMode
          ? {}
          : {
              backgroundImage: `radial-gradient(circle, hsl(var(--canvas-dot)) 1px, transparent 1px)`,
              backgroundSize: '20px 20px',
            }),
      }}
    >
      <Connections />

      {nodes.map((node) => (
        <BoardNode key={node.id} node={node} />
      ))}

      {nodes.length === 0 && !presentationMode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <h2 className="text-2xl font-light text-muted-foreground/50 tracking-wide mb-2">
              Muse-Board
            </h2>
            <p className="text-sm text-muted-foreground/30">
              Add images, text, color swatches, or sticky notes to begin
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;
