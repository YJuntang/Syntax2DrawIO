import React from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { useHistoryStore } from '../../store/historyStore';
import { useEditorStore } from '../../store/editorStore';
import { Button } from '../common/Button';
import { ChevronDown, Code2, Workflow, Upload, Clock3 } from 'lucide-react';
import { useFileImport, confirmBeforeReplacingSource } from '../../hooks/useFileImport';

export function LandingHero() {
  const showLanding = useSettingsStore((state) => state.showLanding);
  const setShowLanding = useSettingsStore((state) => state.setShowLanding);
  const latestEntry = useHistoryStore((state) => state.entries[0]);
  const loadDocument = useEditorStore((state) => state.loadDocument);
  const { triggerImport, importActionLabel } = useFileImport();

  if (!showLanding) return null;

  return (
    <div className="relative border-b border-zinc-800/50 bg-zinc-950 px-4 py-3 light:border-zinc-200/50 light:bg-zinc-50">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100 light:text-zinc-900">
            <Code2 className="h-4 w-4 text-blue-400" />
            Code diagrams into editable Draw.io files
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500 light:text-zinc-600">
            <span className="inline-flex items-center gap-1"><Code2 className="h-3.5 w-3.5" /> Mermaid</span>
            <span className="inline-flex items-center gap-1"><Workflow className="h-3.5 w-3.5" /> PlantUML</span>
            <span>Native export where supported</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void triggerImport()} className="gap-2">
            <Upload className="h-4 w-4" /> {importActionLabel}
          </Button>
          {latestEntry ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void (async () => {
                  if (!await confirmBeforeReplacingSource()) {
                    return;
                  }
                  loadDocument(latestEntry.sourceCode, latestEntry.sourcePath ?? null);
                })();
              }}
              className="gap-2"
            >
              <Clock3 className="h-4 w-4" /> Last Recent
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => setShowLanding(false)}>
            Hide
          </Button>
        </div>
      </div>

      <button 
        onClick={() => setShowLanding(false)}
        className="absolute bottom-2 right-2 text-zinc-500 transition-colors hover:text-zinc-300 light:hover:text-zinc-700"
        aria-label="Dismiss landing section"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}
