import { useCallback, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { toast } from '../components/common/Toast';
import { confirmReplaceUnsavedSource, getImportActionLabel, isDesktopApp, openTextFileDesktop } from '../lib/platform';

function hasUnsavedSourceChanges() {
  const state = useEditorStore.getState();
  return state.sourceCode !== state.lastSavedSourceCode;
}

export async function confirmBeforeReplacingSource() {
  if (!hasUnsavedSourceChanges()) {
    return true;
  }

  return confirmReplaceUnsavedSource();
}

export function looksLikeDiagramSource(text: string) {
  const source = text.trim();
  if (!source) {
    return false;
  }

  return /^(flowchart|graph|sequenceDiagram|classDiagram|erDiagram)\b/i.test(source)
    || /^@start[A-Za-z0-9_-]+/i.test(source);
}

export function useFileImport() {
  const loadDocument = useEditorStore((state) => state.loadDocument);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImportedSource = useCallback(async (content: string, filePath: string | null, name = 'diagram source') => {
    if (!await confirmBeforeReplacingSource()) {
      return false;
    }

    loadDocument(content, filePath);
    toast({ title: filePath ? 'File Opened' : 'Source Loaded', description: `Loaded ${name}`, variant: 'success' });
    return true;
  }, [loadDocument]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        void loadImportedSource(content, null, file.name);
      }
    };
    reader.onerror = () => {
      toast({ title: 'Error', description: 'Failed to read file', variant: 'error' });
    };
    reader.readAsText(file);

    // Reset input so the same file can be uploaded again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [loadImportedSource]);

  const triggerImport = useCallback(async () => {
    if (isDesktopApp()) {
      try {
        const file = await openTextFileDesktop();
        if (!file) {
          return;
        }

        await loadImportedSource(file.content, file.path, file.name);
      } catch {
        toast({ title: 'Error', description: 'Failed to open file', variant: 'error' });
      }
      return;
    }

    fileInputRef.current?.click();
  }, [loadImportedSource]);

  return {
    fileInputRef,
    handleFileUpload,
    triggerImport,
    loadImportedSource,
    importActionLabel: getImportActionLabel(),
  };
}
