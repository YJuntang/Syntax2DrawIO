import { useCallback } from 'react';
import { toast } from '../components/common/Toast';
import {
  getDefaultSourcePath,
  getSourceFilters,
  getSourceSaveLabel,
  isDesktopApp,
  saveTextFileDesktop,
} from '../lib/platform';
import { useEditorStore } from '../store/editorStore';

export function useSourceSave() {
  const sourceCode = useEditorStore((state) => state.sourceCode);
  const sourceFilePath = useEditorStore((state) => state.sourceFilePath);
  const detectedType = useEditorStore((state) => state.diagramType.override || state.diagramType.detected);
  const markSourceSaved = useEditorStore((state) => state.markSourceSaved);

  const saveSource = useCallback(async () => {
    if (isDesktopApp()) {
      const result = await saveTextFileDesktop(sourceCode, {
        title: 'Save Diagram Source',
        defaultPath: getDefaultSourcePath(sourceFilePath, detectedType),
        filters: getSourceFilters(),
      });

      if (!result.saved) {
        if (result.error) {
          toast({ title: 'Error', description: result.error, variant: 'error' });
        }
        return;
      }

      markSourceSaved(result.path);
      toast({
        title: 'Source Saved',
        description: `${result.path?.split(/[\\/]/).pop() ?? 'Diagram source'} saved`,
        variant: 'success',
      });
      return;
    }

    const fileName = getDefaultSourcePath(sourceFilePath, detectedType);
    const blob = new Blob([sourceCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    markSourceSaved(sourceFilePath);
    toast({ title: 'Source Downloaded', description: `${fileName} downloaded`, variant: 'success' });
  }, [detectedType, markSourceSaved, sourceCode, sourceFilePath]);

  return {
    saveSource,
    sourceSaveLabel: getSourceSaveLabel(),
  };
}
