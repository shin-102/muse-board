import { useBoardContext } from '@/contexts/BoardContext';

const Connections = () => {
  const { nodes, connections } = useBoardContext();

  if (connections.length === 0) return null;

  const getCenter = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return null;
    return {
      x: node.x + (node.width || 200) / 2,
      y: node.y + (node.height || 100) / 2,
    };
  };

  return (
    <svg className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }}>
      {connections.map((conn) => {
        const from = getCenter(conn.fromId);
        const to = getCenter(conn.toId);
        if (!from || !to) return null;
        return (
          <line
            key={conn.id}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="hsl(0 0% 40%)"
            strokeWidth="2"
            strokeDasharray="6 4"
            className="transition-all duration-200"
          />
        );
      })}
    </svg>
  );
};

export default Connections;
