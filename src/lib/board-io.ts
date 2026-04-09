import { BoardNode, Connection, Group, Point } from '@/contexts/BoardContext';

export interface BoardData {
  version: string;
  nodes: BoardNode[];
  connections: Connection[];
  groups: Group[];
  panOffset: Point;
}

const CURRENT_VERSION = '1.0.0';

export const exportBoardData = (data: Omit<BoardData, 'version'>) => {
  const blobData: BoardData = {
    version: CURRENT_VERSION,
    ...data,
  };

  const blob = new Blob([JSON.stringify(blobData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `muse-canvas-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export const importBoardData = (file: File): Promise<BoardData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json.nodes || !Array.isArray(json.nodes)) {
          throw new Error('Invalid board file format');
        }
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};
