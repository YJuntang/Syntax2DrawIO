import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface HistoryEntry {
  id: string;
  title?: string;
  sourceCode: string;
  sourcePath?: string | null;
  diagramType: {
    detected: 'mermaid' | 'plantuml' | null;
    subtype: string;
    confidence: number;
    override: string | null;
  };
  exportMode?: string;
  timestamp: number;
  previewSvg?: string;
  thumbnailSvg?: string;
}

interface HistoryState {
  entries: HistoryEntry[];
  addEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
}

const MAX_HISTORY = 50;
const MAX_HISTORY_SOURCE_CHARS = 750_000;

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((state) => {
          const sourceCode = entry.sourceCode.trim();
          if (!sourceCode) {
            return state;
          }

          const newEntry: HistoryEntry = {
            ...entry,
            sourceCode,
            title: entry.title || inferHistoryTitle(sourceCode),
            previewSvg: undefined,
            thumbnailSvg: undefined,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
          };
          
          // Avoid duplicate consecutive entries if source code is identical
          if (state.entries.length > 0 && state.entries[0].sourceCode.trim() === sourceCode) {
            return state;
          }

          const newEntries: HistoryEntry[] = [];
          let sourceChars = 0;
          for (const candidate of [newEntry, ...state.entries]) {
            if (newEntries.length >= MAX_HISTORY || sourceChars + candidate.sourceCode.length > MAX_HISTORY_SOURCE_CHARS) {
              break;
            }
            newEntries.push({
              ...candidate,
              previewSvg: undefined,
              thumbnailSvg: undefined,
            });
            sourceChars += candidate.sourceCode.length;
          }
          return { entries: newEntries };
        }),
      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),
      clearAll: () => set({ entries: [] }),
    }),
    {
      name: 's2d-history',
      version: 2,
      storage: createJSONStorage(() => ({
        getItem: (name) => localStorage.getItem(name),
        removeItem: (name) => localStorage.removeItem(name),
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch {
            // Keep the in-memory history usable if the browser storage quota is exhausted.
          }
        },
      })),
      partialize: (state) => ({
        entries: state.entries.map(({ previewSvg: _previewSvg, thumbnailSvg: _thumbnailSvg, ...entry }) => entry),
      }),
      migrate: (persisted) => {
        const state = persisted as Partial<HistoryState> | undefined;
        return {
          entries: (state?.entries || []).map(({ previewSvg: _previewSvg, thumbnailSvg: _thumbnailSvg, ...entry }) => entry),
        };
      },
    }
  )
);

function inferHistoryTitle(sourceCode: string) {
  const firstMeaningfulLine = sourceCode
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('%%') && !line.startsWith("'"));

  if (!firstMeaningfulLine) {
    return 'Untitled diagram';
  }

  return firstMeaningfulLine.length > 48
    ? `${firstMeaningfulLine.slice(0, 45)}...`
    : firstMeaningfulLine;
}
