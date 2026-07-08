import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { MobileGate } from './components/layout/MobileGate';
import { Header } from './components/layout/Header';
import { LandingHero } from './components/layout/LandingHero';
import { SplitPane } from './components/layout/SplitPane';
import { EditorToolbar } from './components/editor/EditorToolbar';
import { SyntaxHelp } from './components/editor/SyntaxHelp';
import { PreviewToolbar } from './components/preview/PreviewToolbar';
import { ExportDiagnostics } from './components/preview/ExportDiagnostics';
import { DiagramPreview } from './components/preview/DiagramPreview';
import { ToastContainer } from './components/common/Toast';
import { ConfirmationDialogHost } from './components/common/ConfirmationDialog';
import { SettingsModal } from './components/settings/SettingsModal';
import { HistoryPanel } from './components/features/HistoryPanel';
import { CommandPalette } from './components/features/CommandPalette';
import { PwaPrompt } from './components/features/PwaPrompt';
import { useConverter } from './hooks/useConverter';
import { useTheme } from './hooks/useTheme';
import { useDesktopWindow } from './hooks/useDesktopWindow';
import { useDesktopMenuCommands } from './hooks/useDesktopMenuCommands';
import { getPlatformCapabilities, isDesktopApp } from './lib/platform';
import { looksLikeDiagramSource, useFileImport } from './hooks/useFileImport';
import { useSettingsStore } from './store/settingsStore';

const CodeEditor = React.lazy(async () => {
  const module = await import('./components/editor/CodeEditor');
  return { default: module.CodeEditor };
});

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [activeMobilePane, setActiveMobilePane] = useState<'editor' | 'preview'>('editor');
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const showLanding = useSettingsStore((state) => state.showLanding);
  const [shouldLoadEditor, setShouldLoadEditor] = useState(!showLanding);
  const { loadImportedSource } = useFileImport();
  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const openCommandPalette = useCallback(() => setIsCommandPaletteOpen(true), []);

  // Initialize theme
  useTheme();
  
  // Initialize converter worker and reaction
  useConverter();
  useDesktopWindow();
  useDesktopMenuCommands({ onOpenSettings: openSettings });

  const capabilities = getPlatformCapabilities();

  useEffect(() => {
    if (!showLanding) {
      setShouldLoadEditor(true);
    }
  }, [showLanding]);

  useEffect(() => {
    const updateLayout = () => setIsCompactLayout(window.innerWidth < 768);
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openCommandPalette();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openCommandPalette]);

  const editorPane = (
    <div className="flex h-full flex-col border-r border-zinc-800/50 light:border-zinc-200/50 md:border-r">
      <EditorToolbar />
      {shouldLoadEditor ? (
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center bg-zinc-950 text-sm text-zinc-500 light:bg-zinc-50 light:text-zinc-500">
              Loading editor...
            </div>
          }
        >
          <CodeEditor />
        </Suspense>
      ) : (
        <button
          type="button"
          onFocus={() => setShouldLoadEditor(true)}
          onClick={() => setShouldLoadEditor(true)}
          className="flex flex-1 items-center justify-center bg-zinc-950 text-sm text-zinc-500 hover:text-zinc-300 light:bg-zinc-50 light:text-zinc-500 light:hover:text-zinc-700"
        >
          Click to load editor
        </button>
      )}
    </div>
  );

  const previewPane = (
    <div className="flex h-full flex-col bg-zinc-900 light:bg-zinc-100">
      <PreviewToolbar />
      <ExportDiagnostics />
      <DiagramPreview />
    </div>
  );

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (isDesktopApp()) {
      return;
    }

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    event.preventDefault();
    void file.text().then((content) => loadImportedSource(content, null, file.name));
  }, [loadImportedSource]);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, [contenteditable="true"], .monaco-editor')) {
      return;
    }

    const text = event.clipboardData.getData('text/plain');
    if (!looksLikeDiagramSource(text)) {
      return;
    }

    event.preventDefault();
    void loadImportedSource(text, null, 'pasted diagram');
  }, [loadImportedSource]);

  return (
    <MobileGate>
      <div
        className="flex h-screen w-full flex-col overflow-hidden bg-zinc-950 text-zinc-100 selection:bg-blue-500/30 light:bg-zinc-50 light:text-zinc-900 transition-colors duration-300 font-sans"
        onDragOver={(event) => {
          if (!isDesktopApp() && event.dataTransfer.types.includes('Files')) {
            event.preventDefault();
          }
        }}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        <Header
          onOpenSettings={openSettings}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenCommandPalette={openCommandPalette}
        />
        
        <div className="flex flex-1 flex-col overflow-hidden">
          <LandingHero />
          {capabilities.isDesktop ? (
            <div className="border-b border-zinc-800/50 bg-amber-500/10 px-4 py-2 text-xs text-amber-300 light:border-zinc-200/50 light:bg-amber-100 light:text-amber-900">
              PlantUML preview and visual fallback exports still use the public PlantUML renderer, so internet is required for those diagrams in this desktop release.
            </div>
          ) : null}
          
          {isCompactLayout ? (
            <div className="flex border-b border-zinc-800/50 bg-zinc-950 px-2 py-2 light:border-zinc-200/50 light:bg-zinc-50">
              <div role="tablist" aria-label="Workspace panes" className="grid w-full grid-cols-2 gap-1 rounded-md bg-zinc-900 p-1 light:bg-zinc-100">
                {(['editor', 'preview'] as const).map((pane) => (
                  <button
                    key={pane}
                    type="button"
                    role="tab"
                    aria-selected={activeMobilePane === pane}
                    aria-controls={`${pane}-pane`}
                    onClick={() => {
                      setActiveMobilePane(pane);
                      if (pane === 'editor') {
                        setShouldLoadEditor(true);
                      }
                    }}
                    className={`h-8 rounded text-sm font-medium capitalize ${activeMobilePane === pane ? 'bg-blue-600 text-white' : 'text-zinc-400 light:text-zinc-600'}`}
                  >
                    {pane}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          
          <div className="flex flex-1 overflow-hidden">
            {!isCompactLayout ? <SyntaxHelp /> : null}
            {!isCompactLayout ? (
              <div id={`${activeMobilePane}-pane`} role="tabpanel" className="min-w-0 flex-1">
                <SplitPane left={editorPane} right={previewPane} />
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                {activeMobilePane === 'editor' ? editorPane : previewPane}
              </div>
            )}
          </div>
        </div>
        
        <ToastContainer />
        <ConfirmationDialogHost />
        <PwaPrompt />
        <HistoryPanel isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onOpenSettings={openSettings}
          onOpenHistory={() => setIsHistoryOpen(true)}
        />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    </MobileGate>
  );
}

export default App;
