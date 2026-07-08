import React, { useEffect, useMemo, useState } from 'react';
import { Command, Download, FileCode2, Image, Save, Search, Upload } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useFileImport } from '../../hooks/useFileImport';
import { useSourceSave } from '../../hooks/useSourceSave';
import { useExport } from '../../hooks/useExport';
import { useEditorStore } from '../../store/editorStore';
import { useSettingsStore } from '../../store/settingsStore';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}

export function CommandPalette({ isOpen, onClose, onOpenSettings, onOpenHistory }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const { triggerImport } = useFileImport();
  const { saveSource } = useSourceSave();
  const { downloadDrawio, downloadSvg, downloadPng, canDownloadDrawio, canDownloadSvg, canDownloadPng } = useExport();
  const fitPreview = useEditorStore((state) => state.fitPreview);
  const setDiagramTypeOverride = useEditorStore((state) => state.setDiagramTypeOverride);
  const showSyntaxHelp = useSettingsStore((state) => state.showSyntaxHelp);
  const setShowSyntaxHelp = useSettingsStore((state) => state.setShowSyntaxHelp);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const commands = useMemo(() => [
    { id: 'open', label: 'Open or Import Source', icon: <Upload />, run: () => void triggerImport() },
    { id: 'save-source', label: 'Save Source', icon: <Save />, run: () => void saveSource() },
    { id: 'export-drawio', label: 'Export .drawio', icon: <FileCode2 />, run: () => void downloadDrawio(), disabled: !canDownloadDrawio },
    { id: 'export-svg', label: 'Export .drawio.svg', icon: <Image />, run: () => void downloadSvg(), disabled: !canDownloadSvg },
    { id: 'export-png', label: 'Export PNG', icon: <Download />, run: () => downloadPng(), disabled: !canDownloadPng },
    { id: 'fit-preview', label: 'Fit Preview', icon: <Search />, run: () => fitPreview() },
    { id: 'syntax-help', label: showSyntaxHelp ? 'Hide Syntax Help' : 'Show Syntax Help', icon: <Command />, run: () => setShowSyntaxHelp(!showSyntaxHelp) },
    { id: 'force-mermaid', label: 'Force Mermaid Detection', icon: <Command />, run: () => setDiagramTypeOverride('mermaid') },
    { id: 'force-plantuml', label: 'Force PlantUML Detection', icon: <Command />, run: () => setDiagramTypeOverride('plantuml') },
    { id: 'auto-detect', label: 'Use Auto-Detect', icon: <Command />, run: () => setDiagramTypeOverride(null) },
    { id: 'history', label: 'Open Recent Diagrams', icon: <Command />, run: onOpenHistory },
    { id: 'settings', label: 'Open Settings', icon: <Command />, run: onOpenSettings },
  ], [
    canDownloadDrawio,
    canDownloadPng,
    canDownloadSvg,
    downloadDrawio,
    downloadPng,
    downloadSvg,
    fitPreview,
    onOpenHistory,
    onOpenSettings,
    saveSource,
    setDiagramTypeOverride,
    setShowSyntaxHelp,
    showSyntaxHelp,
    triggerImport,
  ]);

  const filteredCommands = commands.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Command Palette" className="max-w-xl">
      <div className="space-y-3">
        <div className="flex h-10 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 light:border-zinc-300 light:bg-white">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a command"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500 light:text-zinc-900"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-md border border-zinc-800 light:border-zinc-200">
          {filteredCommands.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                item.run();
                onClose();
              }}
              className="flex w-full items-center gap-3 border-b border-zinc-800 px-3 py-2.5 text-left text-sm text-zinc-200 last:border-b-0 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 light:border-zinc-200 light:text-zinc-800 light:hover:bg-zinc-100"
            >
              <span className="h-4 w-4 text-zinc-500">{item.icon}</span>
              {item.label}
            </button>
          ))}
          {!filteredCommands.length ? (
            <div className="px-3 py-8 text-center text-sm text-zinc-500">No matching commands</div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
