import React from 'react';
import { useEditorStore } from '../../store/editorStore';
import { Badge } from '../common/Badge';
import { ExamplesDropdown } from '../features/ExamplesDropdown';

export function EditorToolbar() {
  const detectedType = useEditorStore((state) => state.diagramType.detected);
  const subtype = useEditorStore((state) => state.diagramType.subtype);
  const override = useEditorStore((state) => state.diagramType.override);
  const setOverride = useEditorStore((state) => state.setDiagramTypeOverride);
  const isConverting = useEditorStore((state) => state.isConverting);

  const displayType = override || detectedType;

  return (
    <div className="flex h-10 items-center justify-between border-b border-zinc-800/50 bg-zinc-900/50 px-4 light:border-zinc-200/50 light:bg-zinc-50/50">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-zinc-400 light:text-zinc-600 uppercase tracking-wider">Editor</span>
        <ExamplesDropdown />
        
        {isConverting && (
          <div role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs text-blue-400">
            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <select
          aria-label="Diagram type detection"
          value={override || ''}
          onChange={(e) => setOverride((e.target.value as 'mermaid' | 'plantuml') || null)}
          className="h-6 rounded bg-zinc-800 px-2 text-xs text-zinc-300 border border-zinc-700 outline-none focus:border-blue-500 light:bg-white light:border-zinc-300 light:text-zinc-700"
        >
          <option value="">Auto-detect</option>
          <option value="mermaid">Force Mermaid</option>
          <option value="plantuml">Force PlantUML</option>
        </select>

        {displayType && (
          <Badge variant={displayType as any}>
            {displayType === 'mermaid' ? 'Mermaid' : 'PlantUML'}
            {subtype && subtype !== 'auto' && ` (${subtype})`}
          </Badge>
        )}
      </div>
    </div>
  );
}
