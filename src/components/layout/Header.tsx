import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useSettingsStore } from '../../store/settingsStore';
import { useFileImport } from '../../hooks/useFileImport';
import { useSourceSave } from '../../hooks/useSourceSave';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { Button } from '../common/Button';
import { Clock3, Command, Moon, Sun, HelpCircle, Upload, Menu, Settings, Save } from 'lucide-react';
import { Dropdown } from '../common/Dropdown';
import { getDocumentDisplayName, getPlatformCapabilities, openExternalUrl } from '../../lib/platform';
import { useEditorStore } from '../../store/editorStore';
import { REPOSITORY_URL } from '../../config';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenCommandPalette: () => void;
}

export function Header({ onOpenSettings, onOpenHistory, onOpenCommandPalette }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const showSyntaxHelp = useSettingsStore((state) => state.showSyntaxHelp);
  const setShowSyntaxHelp = useSettingsStore((state) => state.setShowSyntaxHelp);
  const sourceFilePath = useEditorStore((state) => state.sourceFilePath);
  const sourceCode = useEditorStore((state) => state.sourceCode);
  const lastSavedSourceCode = useEditorStore((state) => state.lastSavedSourceCode);
  const { fileInputRef, handleFileUpload, triggerImport, importActionLabel } = useFileImport();
  const { saveSource, sourceSaveLabel } = useSourceSave();
  const capabilities = getPlatformCapabilities();
  const isDirty = sourceCode !== lastSavedSourceCode;
  const fileLabel = sourceFilePath ? getDocumentDisplayName(sourceFilePath) : null;

  useKeyboardShortcuts([
    {
      key: 'o',
      ctrlKey: true,
      handler: () => {
        void triggerImport();
      },
    },
    {
      key: 's',
      ctrlKey: true,
      handler: () => {
        void saveSource();
      },
    },
  ]);

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800/50 bg-zinc-950/50 px-4 backdrop-blur-md light:border-zinc-200/50 light:bg-white/50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div
            className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-blue-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_18px_rgba(0,122,255,0.22)]"
            aria-hidden="true"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.28),transparent_34%)]" />
            <div className="relative flex w-[18px] flex-col gap-[3px]">
              <span className="h-[3px] w-full rounded-full bg-white/95" />
              <span className="h-[3px] w-4 rounded-full bg-white/82" />
              <span className="h-[3px] w-3 rounded-full bg-white/68" />
            </div>
          </div>
          <h1 className="hidden text-[1.35rem] font-semibold leading-none text-zinc-100 light:text-zinc-900 sm:block">
            Syntax<span className="text-blue-500">2</span>DrawIO
          </h1>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {fileLabel ? <span className="text-xs text-zinc-500 light:text-zinc-500">{fileLabel}</span> : null}
          {isDirty ? <span className="text-xs font-medium text-amber-400">Unsaved</span> : null}
          {capabilities.isDesktop ? (
            <span className="text-xs text-zinc-500 light:text-zinc-500">Desktop</span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".txt,.md,.mermaid,.puml,.plantuml"
          className="hidden"
        />
        
        <Tooltip content={importActionLabel}>
          <Button variant="ghost" size="icon" onClick={() => void triggerImport()} aria-label={importActionLabel}>
            <Upload className="h-4 w-4" />
          </Button>
        </Tooltip>

        <Tooltip content={sourceSaveLabel}>
          <Button variant="ghost" size="icon" onClick={() => void saveSource()} aria-label={sourceSaveLabel}>
            <Save className="h-4 w-4" />
          </Button>
        </Tooltip>

        <Tooltip content="Syntax Help">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowSyntaxHelp(!showSyntaxHelp)}
            className={`hidden sm:inline-flex ${showSyntaxHelp ? 'bg-zinc-800 text-zinc-100 light:bg-zinc-100' : ''}`}
            aria-label="Toggle Syntax Help"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </Tooltip>

        <Tooltip content="Recent Diagrams">
          <Button className="hidden sm:inline-flex" variant="ghost" size="icon" onClick={onOpenHistory} aria-label="Open recent diagrams">
            <Clock3 className="h-4 w-4" />
          </Button>
        </Tooltip>

        <Tooltip content="Command Palette">
          <Button className="hidden sm:inline-flex" variant="ghost" size="icon" onClick={onOpenCommandPalette} aria-label="Open command palette">
            <Command className="h-4 w-4" />
          </Button>
        </Tooltip>

        <Tooltip content={theme === 'light' ? 'Dark Mode' : 'Light Mode'}>
          <Button className="hidden sm:inline-flex" variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle Theme">
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
        </Tooltip>

        <div className="h-6 w-px bg-zinc-800 mx-2 light:bg-zinc-200" />

        <Dropdown
          trigger={
            <Button variant="ghost" size="icon" aria-label="Open main menu">
              <Menu className="h-4 w-4" />
            </Button>
          }
          align="right"
          items={[
            { id: 'settings', label: 'Settings...', icon: <Settings className="h-4 w-4" />, onClick: onOpenSettings },
            { id: 'syntax-help', label: showSyntaxHelp ? 'Hide Syntax Help' : 'Show Syntax Help', icon: <HelpCircle className="h-4 w-4" />, onClick: () => setShowSyntaxHelp(!showSyntaxHelp) },
            { id: 'history', label: 'Recent Diagrams', icon: <Clock3 className="h-4 w-4" />, onClick: onOpenHistory },
            { id: 'commands', label: 'Command Palette', icon: <Command className="h-4 w-4" />, onClick: onOpenCommandPalette },
            { id: 'theme', label: theme === 'light' ? 'Dark Mode' : 'Light Mode', icon: theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />, onClick: toggleTheme },
            { id: 'github', label: 'GitHub Repository', onClick: () => void openExternalUrl(REPOSITORY_URL) },
          ]}
        />
      </div>
    </header>
  );
}

// Simple internal Tooltip for Header to avoid cyclic dependency if needed, 
// but we already created it in common so let's import it.
import { Tooltip } from '../common/Tooltip';
