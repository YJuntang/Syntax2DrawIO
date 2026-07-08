import React from 'react';
import { Clock3, Trash2, X } from 'lucide-react';
import { useHistoryStore } from '../../store/historyStore';
import { useEditorStore } from '../../store/editorStore';
import { Button } from '../common/Button';
import { confirmBeforeReplacingSource } from '../../hooks/useFileImport';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HistoryPanel({ isOpen, onClose }: HistoryPanelProps) {
  const entries = useHistoryStore((state) => state.entries);
  const removeEntry = useHistoryStore((state) => state.removeEntry);
  const clearAll = useHistoryStore((state) => state.clearAll);
  const loadDocument = useEditorStore((state) => state.loadDocument);

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="fixed right-0 top-0 z-40 flex h-screen w-full max-w-sm flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl light:border-zinc-200 light:bg-white">
      <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4 light:border-zinc-200">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-blue-400" />
          <h2 className="font-semibold text-zinc-100 light:text-zinc-900">Recent Diagrams</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close history">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {entries.length ? (
        <>
          <p className="border-b border-zinc-800 px-4 py-2 text-xs text-zinc-500 light:border-zinc-200">
            Recent source is stored only in this browser or desktop profile.
          </p>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-2">
              {entries.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-md border border-zinc-800 bg-zinc-900/70 p-3 light:border-zinc-200 light:bg-zinc-50"
                >
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        if (!await confirmBeforeReplacingSource()) {
                          return;
                        }
                        loadDocument(entry.sourceCode, entry.sourcePath ?? null);
                        onClose();
                      })();
                    }}
                    className="block w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-medium text-zinc-100 light:text-zinc-900">
                          {entry.title || 'Untitled diagram'}
                        </h3>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatHistoryDate(entry.timestamp)} · {entry.diagramType.detected ?? 'Unknown'}
                          {entry.diagramType.subtype && entry.diagramType.subtype !== 'auto' ? ` · ${entry.diagramType.subtype}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400 light:bg-white light:text-zinc-500">
                        {entry.exportMode ?? 'preview'}
                      </span>
                    </div>
                    <pre className="mt-3 max-h-16 overflow-hidden whitespace-pre-wrap text-xs leading-5 text-zinc-400 light:text-zinc-600">
                      {entry.sourceCode}
                    </pre>
                  </button>
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEntry(entry.id)}
                      className="gap-1 text-zinc-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-800 p-3 light:border-zinc-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm('Clear all recent diagrams?')) {
                  clearAll();
                }
              }}
              className="w-full gap-2"
            >
              <Trash2 className="h-4 w-4" /> Clear History
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-zinc-500">
          <Clock3 className="mb-3 h-10 w-10 opacity-50" />
          <p className="text-sm">Converted diagrams will appear here.</p>
        </div>
      )}
    </aside>
  );
}

function formatHistoryDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}
