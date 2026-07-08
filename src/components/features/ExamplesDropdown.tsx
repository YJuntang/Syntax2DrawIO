import React, { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { ChevronDown } from 'lucide-react';
import { confirmBeforeReplacingSource } from '../../hooks/useFileImport';
import { DIAGRAM_EXAMPLES } from '../../examples/catalog';

export function ExamplesDropdown() {
  const setSourceCode = useEditorStore((state) => state.setSourceCode);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 h-6 px-2 text-xs font-medium bg-zinc-800 text-zinc-300 rounded border border-zinc-700 hover:bg-zinc-700 transition-colors focus:outline-none light:bg-white light:border-zinc-300 light:text-zinc-700 light:hover:bg-zinc-50"
      >
        Examples
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 z-50 max-h-[70vh] w-56 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900 shadow-xl light:border-zinc-200 light:bg-white">
          <div className="py-1">
            {['Mermaid', 'PlantUML'].map((group) => (
              <div key={group}>
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {group}
                </div>
                {DIAGRAM_EXAMPLES.filter((example) => example.group === group).map((example, idx) => (
                  <button
                    key={`${group}-${idx}`}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white light:text-zinc-700 light:hover:bg-zinc-100 light:hover:text-zinc-900"
                    onClick={() => {
                      void (async () => {
                        if (!await confirmBeforeReplacingSource()) {
                          return;
                        }
                        setSourceCode(example.code);
                        setIsOpen(false);
                      })();
                    }}
                  >
                    {example.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
