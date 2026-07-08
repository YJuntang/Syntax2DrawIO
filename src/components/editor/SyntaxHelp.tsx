import React from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { Button } from '../common/Button';
import { X, ExternalLink } from 'lucide-react';
import { openExternalUrl } from '../../lib/platform';
import { getDiagramExample } from '../../examples/catalog';

export function SyntaxHelp() {
  const showSyntaxHelp = useSettingsStore((state) => state.showSyntaxHelp);
  const setShowSyntaxHelp = useSettingsStore((state) => state.setShowSyntaxHelp);

  if (!showSyntaxHelp) return null;
  const flowchartExample = getDiagramExample('mermaid-flowchart')!;
  const sequenceExample = getDiagramExample('plantuml-sequence')!;
  const useCaseExample = getDiagramExample('plantuml-usecase')!;

  return (
    <div className="flex w-80 flex-col border-l border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md light:border-zinc-200/50 light:bg-zinc-50/80 overflow-y-auto">
      <div className="sticky top-0 flex items-center justify-between border-b border-zinc-800/50 bg-zinc-950 px-4 py-3 light:border-zinc-200/50 light:bg-zinc-50">
        <h3 className="font-semibold text-zinc-100 light:text-zinc-900">Syntax Help</h3>
        <Button variant="ghost" size="icon" onClick={() => setShowSyntaxHelp(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="p-4 space-y-6">
        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-blue-400">Mermaid Flowchart</h4>
            <button
              type="button"
              onClick={() => void openExternalUrl('https://mermaid.js.org/syntax/flowchart.html')}
              className="text-zinc-500 hover:text-blue-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-3 text-sm text-zinc-300 light:text-zinc-700">
            <div>
              <p className="mb-1 font-medium text-zinc-400 light:text-zinc-500 text-xs uppercase">Basic Graph</p>
              <pre className="rounded-md bg-zinc-900 p-2 text-xs border border-zinc-800 light:bg-white light:border-zinc-200 text-emerald-400">
{flowchartExample.code}
              </pre>
            </div>
            <div>
              <p className="mb-1 font-medium text-zinc-400 light:text-zinc-500 text-xs uppercase">Node Shapes</p>
              <ul className="space-y-1 list-disc pl-4 text-xs">
                <li><code className="text-blue-300 bg-blue-900/30 px-1 rounded">id[Label]</code> Rectangle</li>
                <li><code className="text-blue-300 bg-blue-900/30 px-1 rounded">id(Label)</code> Rounded</li>
                <li><code className="text-blue-300 bg-blue-900/30 px-1 rounded">id{"{"}Label{"}"}</code> Diamond</li>
                <li><code className="text-blue-300 bg-blue-900/30 px-1 rounded">id((Label))</code> Circle</li>
                <li><code className="text-blue-300 bg-blue-900/30 px-1 rounded">id[(Database)]</code> Cylinder</li>
              </ul>
            </div>
          </div>
        </section>

        <div className="h-px w-full bg-zinc-800/50 light:bg-zinc-200/50" />

        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-purple-400">PlantUML Sequence</h4>
            <button
              type="button"
              onClick={() => void openExternalUrl('https://plantuml.com/sequence-diagram')}
              className="text-zinc-500 hover:text-purple-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-3 text-sm text-zinc-300 light:text-zinc-700">
            <div>
              <p className="mb-1 font-medium text-zinc-400 light:text-zinc-500 text-xs uppercase">Sequence Diagram</p>
              <pre className="rounded-md bg-zinc-900 p-2 text-xs border border-zinc-800 light:bg-white light:border-zinc-200 text-emerald-400">
{sequenceExample.code}
              </pre>
            </div>
          </div>
        </section>

        <div className="h-px w-full bg-zinc-800/50 light:bg-zinc-200/50" />

        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-purple-400">PlantUML Use Case</h4>
            <button
              type="button"
              onClick={() => void openExternalUrl('https://plantuml.com/use-case-diagram')}
              className="text-zinc-500 hover:text-purple-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
          <pre className="max-h-72 overflow-auto rounded-md border border-zinc-800 bg-zinc-900 p-2 text-xs text-emerald-400 light:border-zinc-200 light:bg-white">
            {useCaseExample.code}
          </pre>
        </section>
      </div>
    </div>
  );
}
