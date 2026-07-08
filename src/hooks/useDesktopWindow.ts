import { useEffect } from 'react';
import { toast } from '../components/common/Toast';
import { confirmUnsavedChanges, getDocumentDisplayName, isDesktopApp, readTextFileDesktop } from '../lib/platform';
import { useEditorStore } from '../store/editorStore';
import { confirmBeforeReplacingSource } from './useFileImport';

const DROP_DEDUP_WINDOW_MS = 1000;

function getDirtyState() {
  const state = useEditorStore.getState();
  return state.sourceCode !== state.lastSavedSourceCode;
}

export function useDesktopWindow() {
  const sourceFilePath = useEditorStore((state) => state.sourceFilePath);
  const sourceCode = useEditorStore((state) => state.sourceCode);
  const lastSavedSourceCode = useEditorStore((state) => state.lastSavedSourceCode);
  const isDirty = sourceCode !== lastSavedSourceCode;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!getDirtyState()) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!isDesktopApp()) {
      return;
    }

    let disposeClose: (() => void) | undefined;
    let disposeDrop: (() => void) | undefined;
    let previousDrop: { path: string; at: number } | null = null;

    void (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();

      disposeClose = await appWindow.onCloseRequested(async (event) => {
        if (!getDirtyState()) {
          return;
        }

        const confirmed = await confirmUnsavedChanges();
        if (!confirmed) {
          event.preventDefault();
        }
      });

      disposeDrop = await appWindow.onDragDropEvent(async (event) => {
        if (event.payload.type !== 'drop') {
          return;
        }

        const [path] = event.payload.paths;
        if (!path) {
          return;
        }

        const now = Date.now();
        if (!shouldProcessDroppedPath(previousDrop, path, now)) {
          return;
        }
        previousDrop = { path, at: now };

        const classification = classifyDroppedPath(path);
        if (classification === 'ignore-self-export') {
          return;
        }

        if (classification !== 'import-source') {
          toast({
            title: 'Unsupported Drop',
            description: 'Drop Mermaid or PlantUML source files instead of exported draw.io artifacts.',
            variant: 'info',
          });
          return;
        }

        try {
          if (!await confirmBeforeReplacingSource()) {
            return;
          }

          const file = await readTextFileDesktop(path);
          useEditorStore.getState().loadDocument(file.content, file.path);
          toast({
            title: 'File Opened',
            description: `Loaded ${file.name}`,
            variant: 'success',
          });
        } catch {
          toast({
            title: 'Error',
            description: 'Failed to open the dropped file',
            variant: 'error',
          });
        }
      });
    })();

    return () => {
      disposeClose?.();
      disposeDrop?.();
    };
  }, []);

  useEffect(() => {
    if (!isDesktopApp()) {
      return;
    }

    void (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const documentLabel = sourceFilePath ? `${getDocumentDisplayName(sourceFilePath)} - ` : '';
      const title = `${documentLabel}Syntax2DrawIO${isDirty ? ' *' : ''}`;
      await getCurrentWindow().setTitle(title);
    })();
  }, [sourceFilePath, isDirty]);
}

export function isImportableDroppedPath(path: string) {
  return classifyDroppedPath(path) === 'import-source';
}

export function classifyDroppedPath(path: string): 'import-source' | 'ignore-self-export' | 'reject-export-artifact' {
  const normalizedPath = normalizeDroppedPath(path);

  if (
    normalizedPath.includes('/syntax2drawio/drag-export/')
    && (normalizedPath.endsWith('.drawio') || normalizedPath.endsWith('.drawio.svg'))
  ) {
    return 'ignore-self-export';
  }

  if (normalizedPath.endsWith('.drawio') || normalizedPath.endsWith('.drawio.svg')) {
    return 'reject-export-artifact';
  }

  if (
    normalizedPath.endsWith('.puml')
    || normalizedPath.endsWith('.plantuml')
    || normalizedPath.endsWith('.mermaid')
    || normalizedPath.endsWith('.mmd')
    || normalizedPath.endsWith('.md')
    || normalizedPath.endsWith('.txt')
  ) {
    return 'import-source';
  }

  return 'reject-export-artifact';
}

export function shouldProcessDroppedPath(
  previous: { path: string; at: number } | null,
  path: string,
  now: number,
  windowMs = DROP_DEDUP_WINDOW_MS
) {
  if (!previous) {
    return true;
  }

  return !(
    normalizeDroppedPath(previous.path) === normalizeDroppedPath(path)
    && (now - previous.at) < windowMs
  );
}

function normalizeDroppedPath(path: string) {
  return path.replace(/\\/g, '/').toLowerCase();
}
