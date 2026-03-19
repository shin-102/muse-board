import { BoardProvider } from '@/contexts/BoardContext';
import Canvas from '@/components/board/Canvas';
import Toolbar from '@/components/board/Toolbar';

const Index = () => {
  return (
    <BoardProvider>
      <div className="h-screen w-screen overflow-hidden">
        <Canvas />
        <Toolbar />
      </div>
    </BoardProvider>
  );
};

export default Index;
