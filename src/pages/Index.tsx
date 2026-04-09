import React from 'react';
import { BoardProvider, useBoardContext } from '@/contexts/BoardContext';
import Canvas from '@/components/board/Canvas';
import Toolbar from '@/components/board/Toolbar';
import { useTheme } from '@/components/ThemeProvider';
import SideBar from '@/components/SideBar';
import { useToast } from '@/hooks/use-toast';
import { exportBoardData, importBoardData } from '@/lib/board-io';

const BoardLayout = () => {
  const { theme, setTheme } = useTheme();
  const { nodes, connections, groups, panOffset, loadBoard } = useBoardContext();
  const { toast } = useToast();

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
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <SideBar
        isDark={theme === "dark"}
        toggleTheme={handleToggleTheme}
        onExport={handleExport}
        onImport={handleImport}
      />

      <main className="relative flex-1 h-full overflow-hidden">
        <Canvas />
        <Toolbar />
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
