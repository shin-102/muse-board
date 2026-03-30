import { BoardProvider } from '@/contexts/BoardContext';
import Canvas from '@/components/board/Canvas';
import Toolbar from '@/components/board/Toolbar';
import { useTheme } from '@/components/ThemeProvider';
import SideBar from '@/components/SideBar';

const Index = () => {
  const { theme, setTheme } = useTheme();

  const handleToggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <BoardProvider>
      {/* Flex container:
          h-screen ensures it takes full height.
          w-screen + overflow-hidden prevents unwanted scrollbars.
      */}
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">

        {/* The Sidebar */}
        <SideBar
          isDark={theme === "dark"}
          toggleTheme={handleToggleTheme}
          // onExport and onImport will be added in the next step
        />

        {/* The Main Content Area */}
        <main className="relative flex-1 h-full overflow-hidden">
          <Canvas />
          <Toolbar />
        </main>
      </div>
    </BoardProvider>
  );
};

export default Index;
