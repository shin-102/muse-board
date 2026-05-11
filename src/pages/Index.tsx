import React from 'react';
import { BoardProvider, useBoardContext } from '@/contexts/BoardContext';
import Canvas from '@/components/board/Canvas';
import Toolbar from '@/components/board/Toolbar';
import { useTheme } from '@/components/ThemeProvider';
import SideBar from '@/components/SideBar';
import { useToast } from '@/hooks/use-toast';
import { exportBoardData, importBoardData } from '@/lib/board-io';
import { useIsMobile } from '@/hooks/use-mobile';

const BoardLayout = () => {
  const { theme, setTheme } = useTheme();
  const { nodes, connections, groups, panOffset, loadBoard } = useBoardContext();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const handleToggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleExport = () => {
    if (nodes.length === 0) {
      toast({ title: "Nothing to export", description: "Your board is empty!" });
      return;
    }
    exportBoardData({ nodes, connections, groups, panOffset });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await importBoardData(file);
      loadBoard(data);
      toast({ title: "Import Successful", description: "Board loaded." });
    } catch (err) {
      toast({
        title: "Import Failed",
        description: "Invalid .json file.",
        variant: "destructive"
      });
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground fixed inset-0">
      {/* Added 'fixed inset-0' to lock the viewport against mobile keyboard/overscroll shifts */}

      <div className={`${isMobile ? 'fixed top-4 left-4 z-[60]' : 'relative'}`}>
        <SideBar
          isDark={theme === "dark"}
          toggleTheme={handleToggleTheme}
          onExport={handleExport}
          onImport={handleImport}
        />
      </div>

      {/* Crucial: added 'max-w-full' and changed overflow behavior */}
      <main className="relative flex-1 h-full w-full overflow-hidden max-w-full">
        <Canvas />
        <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none z-50">
          <div className="pointer-events-auto">
             <Toolbar />
          </div>
        </div>
      </main>
    </div>
  );
};

// Main Entry Point
const Index = () => {
  return (
    <BoardProvider>
      <BoardLayout />
    </BoardProvider>
  );
};

export default Index;
