import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from "@/lib/utils";

// ─── Refined TBtn to match your exact Toolbar style ───────────────────────────

interface TBtnProps {
  onClick?: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  showLabel?: boolean;
}

const TBtn = ({ onClick, title, children, className = '', showLabel }: TBtnProps) => (
  <button
    onClick={onClick}
    title={title}
    className={cn(
      'flex h-10 items-center rounded-xl transition-all duration-150 shrink-0 px-2.5',
      'text-muted-foreground hover:text-foreground hover:bg-accent',
      !showLabel ? 'w-10 justify-center' : 'w-full justify-start gap-3',
      className
    )}
  >
    {children}
    {showLabel && <span className="text-sm font-medium truncate">{title}</span>}
  </button>
);

// ─── Minimal SideBar ──────────────────────────────────────────────────────────

interface SideBarProps {
  onExport?: () => void;
  onImport?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

export const SideBar = ({ onExport, onImport, isDark, toggleTheme }: SideBarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed for minimum footprint

  return (
    <aside
      className={cn(
        "fixed left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1 p-2",
        "rounded-2xl bg-toolbar-bg/80 backdrop-blur-md border border-toolbar-border shadow-2xl",
        "transition-all duration-300 ease-in-out",
        isCollapsed ? "w-14" : "w-48"
      )}
    >
      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-toolbar-border bg-toolbar-bg backdrop-blur-md text-muted-foreground hover:text-foreground shadow-md transition-colors"
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Theme Toggle */}
      <TBtn onClick={toggleTheme} title={isDark ? "Light Mode" : "Dark Mode"} showLabel={!isCollapsed}>
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </TBtn>

      {/* Export */}
      <TBtn onClick={onExport} title="Export JSON" showLabel={!isCollapsed}>
        <Download size={18} />
      </TBtn>

      {/* Import */}
      <label className="cursor-pointer">
        <TBtn title="Import JSON" showLabel={!isCollapsed} className="pointer-events-none">
          <Upload size={18} />
        </TBtn>
        <input
          type="file"
          accept=".json"
          className="hidden"
          onChange={onImport}
        />
      </label>
    </aside>
  );
};

export default SideBar;
