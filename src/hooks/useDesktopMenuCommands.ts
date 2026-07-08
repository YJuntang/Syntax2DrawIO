import { useEffect } from 'react';
import { toast } from '../components/common/Toast';
import { useFileImport } from './useFileImport';
import { useExport } from './useExport';
import { useSourceSave } from './useSourceSave';
import { useTheme } from './useTheme';
import { useSettingsStore } from '../store/settingsStore';
import { isDesktopApp, openExternalUrl } from '../lib/platform';
import { REPOSITORY_URL } from '../config';

type DesktopMenuCommand =
  | 'open'
  | 'save-source'
  | 'save-drawio'
  | 'export-svg'
  | 'export-png'
  | 'settings'
  | 'toggle-syntax-help'
  | 'toggle-theme'
  | 'open-github';

interface DesktopMenuCommandEvent {
  payload: DesktopMenuCommand;
}

interface DesktopMenuCommandOptions {
  onOpenSettings: () => void;
}

export function useDesktopMenuCommands({ onOpenSettings }: DesktopMenuCommandOptions) {
  const { triggerImport } = useFileImport();
  const { downloadDrawio, downloadSvg, downloadPng } = useExport();
  const { saveSource } = useSourceSave();
  const { toggleTheme } = useTheme();
  const showSyntaxHelp = useSettingsStore((state) => state.showSyntaxHelp);
  const setShowSyntaxHelp = useSettingsStore((state) => state.setShowSyntaxHelp);

  useEffect(() => {
    if (!isDesktopApp()) {
      return;
    }

    let unlisten: (() => void) | undefined;
    let disposed = false;

    void (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      const stopListening = await listen<DesktopMenuCommand>(
        'desktop-menu-command',
        (event: DesktopMenuCommandEvent) => {
          switch (event.payload) {
            case 'open':
              void triggerImport();
              break;
            case 'save-source':
              void saveSource();
              break;
            case 'save-drawio':
              void downloadDrawio();
              break;
            case 'export-svg':
              void downloadSvg();
              break;
            case 'export-png':
              downloadPng();
              break;
            case 'settings':
              onOpenSettings();
              break;
            case 'toggle-syntax-help':
              setShowSyntaxHelp(!showSyntaxHelp);
              break;
            case 'toggle-theme':
              toggleTheme();
              break;
            case 'open-github':
              void openExternalUrl(REPOSITORY_URL).catch(() => {
                toast({
                  title: 'Error',
                  description: 'Failed to open GitHub repository',
                  variant: 'error',
                });
              });
              break;
          }
        }
      );

      if (disposed) {
        stopListening();
        return;
      }

      unlisten = stopListening;
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [
    downloadDrawio,
    downloadPng,
    downloadSvg,
    onOpenSettings,
    saveSource,
    setShowSyntaxHelp,
    showSyntaxHelp,
    toggleTheme,
    triggerImport,
  ]);
}
