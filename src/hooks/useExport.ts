import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getDrawioExportLabel, isEditableDrawioMode } from '../core/drawio/output';
import { remintDrawioXmlIds } from '../core/drawio/remint';
import { prepareDrawioTransfer, writeDrawioTransferToClipboard } from '../core/drawio/transfer';
import {
  calculatePngExportDimensions,
  embedDrawioXmlInPng,
  getPngExportDescription as describePngExport,
  normalizePngExportSettings,
  type PngBackgroundMode,
  type PngExportSettings,
} from '../core/export/png';
import { useEditorStore } from '../store/editorStore';
import { useSettingsStore } from '../store/settingsStore';
import { toast } from '../components/common/Toast';
import {
  getDefaultExportPath,
  getDrawioFilters,
  getExportSaveLabel,
  getPngFilters,
  getPlatformCapabilities,
  getPrimaryExportActionLabel,
  getSvgFilters,
  isDesktopApp,
  saveBinaryFileDesktop,
  saveTextFileDesktop,
} from '../lib/platform';

const DRAG_EXPORT_COOLDOWN_MS = 1000;
let dragExportInFlight = false;
let lastDragExportStartedAt = 0;

export function useExport() {
  const parseResult = useEditorStore((state) => state.parseResult);
  const parseError = useEditorStore((state) => state.parseError);
  const isConverting = useEditorStore((state) => state.isConverting);
  const sourceFilePath = useEditorStore((state) => state.sourceFilePath);
  const markExportSaved = useEditorStore((state) => state.markExportSaved);
  const pngExportSettings = useSettingsStore((state) => state.pngExportSettings);
  const capabilities = getPlatformCapabilities();
  const hasBlockingState = isConverting || !!parseError;
  const canDownloadDrawio = !hasBlockingState && !!parseResult?.drawioXml && parseResult.xmlStatus === 'ready';
  const canDragEditableDrawio =
    !hasBlockingState &&
    capabilities.supportsEditableDragOut &&
    !!parseResult?.drawioXml &&
    parseResult.xmlStatus === 'ready' &&
    isEditableDrawioMode(parseResult.drawioMode);
  const canCopyXml = canDownloadDrawio;
  const canDownloadSvg = !hasBlockingState && !!parseResult?.svg;
  const canDownloadPng = !hasBlockingState && !!parseResult?.svg;
  const canOpenInVSCode = canDownloadDrawio && !isDesktopApp();
  const canExportAnything = canDownloadDrawio || canDownloadSvg || canDownloadPng;

  const downloadDrawio = useCallback(async () => {
    if (!parseResult?.drawioXml || parseResult.xmlStatus !== 'ready') return;
    const transfer = prepareDrawioTransfer(parseResult.drawioXml);
    if (!transfer) {
      toast({ title: 'Export Failed', description: 'The draw.io document could not be prepared.', variant: 'error' });
      return;
    }
    const drawioXml = transfer.fileXml;

    if (capabilities.isDesktop) {
      const result = await saveTextFileDesktop(drawioXml, {
        title: 'Save Draw.io File',
        defaultPath: getDefaultExportPath(sourceFilePath, 'drawio'),
        filters: getDrawioFilters(),
      });

      if (!result.saved) {
        if (result.error) {
          toast({ title: 'Error', description: result.error, variant: 'error' });
        }
        return;
      }

      markExportSaved(result.path);

      toast({
        title: 'Saved',
        description: `${isEditableDrawioMode(parseResult.drawioMode) ? 'Editable' : 'Visual'} diagram saved as ${result.path?.split(/[\\/]/).pop()}`,
        variant: 'success',
      });
      return;
    }

    const blob = new Blob([drawioXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.drawio';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Downloaded',
      description: `${isEditableDrawioMode(parseResult.drawioMode) ? 'Editable' : 'Visual'} diagram saved as diagram.drawio`,
      variant: 'success',
    });
  }, [capabilities.isDesktop, markExportSaved, parseResult, sourceFilePath]);

  const beginDragEditableDrawio = useCallback(async () => {
    if (!parseResult?.drawioXml || parseResult.xmlStatus !== 'ready' || !isEditableDrawioMode(parseResult.drawioMode)) {
      return;
    }

    const now = Date.now();
    if (dragExportInFlight || (now - lastDragExportStartedAt) < DRAG_EXPORT_COOLDOWN_MS) {
      return;
    }

    if (!capabilities.supportsEditableDragOut) {
      toast({
        title: 'Unavailable',
        description: 'Editable drag-out is currently available on macOS desktop builds only.',
        variant: 'error',
      });
      return;
    }

    let stopDragListener: (() => void) | null = null;
    try {
      dragExportInFlight = true;
      lastDragExportStartedAt = now;
      const transfer = prepareDrawioTransfer(parseResult.drawioXml);
      if (!transfer) {
        toast({
          title: 'Drag Failed',
          description: 'The editable draw.io payload could not be prepared. Use Save .drawio instead.',
          variant: 'error',
        });
        return;
      }

      await writeDrawioTransferToClipboard(transfer);
      const sessionId = `s2d-drag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const { listen } = await import('@tauri-apps/api/event');
      let settled = false;
      const unlisten = await listen<{ sessionId: string; operation: string }>('drawio-drag-ended', (event) => {
        if (event.payload.sessionId !== sessionId) {
          return;
        }
        settled = true;
        unlisten();
        stopDragListener = null;
        if (event.payload.operation === 'none') {
          showPasteFallback();
        }
      });
      stopDragListener = unlisten;

      await invoke('begin_drawio_insert_drag', {
        graphModelXml: transfer.graphModelXml,
        htmlFragment: transfer.htmlFragment,
        suggestedName: getDragExportBasename(sourceFilePath),
        sessionId,
      });
      window.setTimeout(() => {
        if (!settled) {
          unlisten();
          stopDragListener = null;
          showPasteFallback();
        }
      }, 15000);
    } catch (error) {
      stopDragListener?.();
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Drag Failed',
        description: `${message || 'draw.io drag session could not start.'} The editable payload is on the clipboard; focus draw.io and press Cmd+V.`,
        variant: 'warning',
      });
    } finally {
      dragExportInFlight = false;
    }
  }, [capabilities.supportsEditableDragOut, parseResult, sourceFilePath]);

  const copyXml = useCallback(async () => {
    if (!parseResult?.drawioXml || parseResult.xmlStatus !== 'ready') return;
    const transfer = prepareDrawioTransfer(parseResult.drawioXml);
    if (!transfer) {
      toast({ title: 'Error', description: 'Failed to prepare the draw.io insertion payload', variant: 'error' });
      return;
    }
    try {
      await writeDrawioTransferToClipboard(transfer);
      toast({ title: 'Copied', description: 'Editable diagram copied. Paste it into draw.io.', variant: 'success' });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'error' });
    }
  }, [parseResult]);

  const openInDrawioVSCode = useCallback(() => {
    if (!parseResult?.drawioXml || parseResult.xmlStatus !== 'ready') return;
    // The VS Code extension URI scheme needs a specific format depending on how we integrate.
    // For now, we can copy to clipboard and open vscode.
    navigator.clipboard.writeText(remintDrawioXmlIds(parseResult.drawioXml)).then(() => {
      toast({ title: 'Copied to Clipboard', description: 'Paste the XML into a new .drawio file in VS Code', variant: 'info' });
      // We can try to open vscode:// but without a file it might just open the app
      window.open('vscode://', '_self');
    });
  }, [parseResult]);

  const downloadSvg = useCallback(async () => {
    if (!parseResult?.svg) return;
    
    let svgContent = parseResult.svg;
    if (parseResult.drawioXml && parseResult.xmlStatus === 'ready') {
      const drawioXml = remintDrawioXmlIds(parseResult.drawioXml);
      // Embed Draw.io XML into SVG so it can be edited natively in Draw.io Desktop
      const xmlBase64 = btoa(unescape(encodeURIComponent(drawioXml)));
      // Add content attribute to the opening svg tag
      svgContent = svgContent.replace('<svg ', `<svg content="${xmlBase64}" `);
    }

    if (capabilities.isDesktop) {
      const result = await saveTextFileDesktop(svgContent, {
        title: 'Save Editable SVG',
        defaultPath: getDefaultExportPath(sourceFilePath, 'svg'),
        filters: getSvgFilters(),
      });

      if (!result.saved) {
        if (result.error) {
          toast({ title: 'Error', description: result.error, variant: 'error' });
        }
        return;
      }

      markExportSaved(result.path);
      toast({ title: 'Saved', description: `Diagram saved as ${result.path?.split(/[\\/]/).pop()}`, variant: 'success' });
      return;
    }
    
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Save as .drawio.svg to indicate it's an editable Draw.io file
    a.download = 'diagram.drawio.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    markExportSaved('diagram.drawio.svg');
    toast({ title: 'Downloaded', description: 'Diagram saved as diagram.drawio.svg', variant: 'success' });
  }, [capabilities.isDesktop, markExportSaved, parseResult, sourceFilePath]);

  const downloadPng = useCallback(() => {
    if (!parseResult?.svg) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      const settings = normalizePngExportSettings(pngExportSettings);
      const dimensions = calculatePngExportDimensions(img.naturalWidth || img.width, img.naturalHeight || img.height, settings);
      if (dimensions.tooLarge) {
        toast({
          title: 'PNG Too Large',
          description: `${dimensions.outputWidth}x${dimensions.outputHeight}px exceeds the safe export limit. Lower the PNG size in Settings.`,
          variant: 'warning',
        });
        return;
      }

      canvas.width = dimensions.outputWidth;
      canvas.height = dimensions.outputHeight;
      if (!ctx) {
        toast({ title: 'Error', description: 'Failed to create PNG canvas', variant: 'error' });
        return;
      }

      if (settings.background === 'white') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, settings.border, settings.border, dimensions.contentWidth, dimensions.contentHeight);

      canvas.toBlob((blob) => {
        if (!blob) {
          toast({ title: 'Error', description: 'Failed to create PNG', variant: 'error' });
          return;
        }

        void blob.arrayBuffer().then(async (buffer) => {
          let pngBytes: Uint8Array<ArrayBufferLike> = new Uint8Array(buffer);
          let metadataSkipped = false;

          if (settings.embedDrawioXml && parseResult.drawioXml && parseResult.xmlStatus === 'ready') {
            try {
              pngBytes = embedDrawioXmlInPng(pngBytes, remintDrawioXmlIds(parseResult.drawioXml));
            } catch {
              metadataSkipped = true;
            }
          }

          if (capabilities.isDesktop) {
            const result = await saveBinaryFileDesktop(pngBytes, {
              title: 'Save PNG',
              defaultPath: getDefaultExportPath(sourceFilePath, 'png'),
              filters: getPngFilters(),
            });

            if (!result.saved) {
              if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'error' });
              }
              return;
            }

            markExportSaved(result.path);
            toast({
              title: 'Saved',
              description: `Diagram saved as ${result.path?.split(/[\\/]/).pop()} (${dimensions.outputWidth}x${dimensions.outputHeight}px${metadataSkipped ? ', metadata skipped' : ''})`,
              variant: metadataSkipped ? 'warning' : 'success',
            });
            return;
          }

          const webPngBytes = new Uint8Array(pngBytes);
          const url = URL.createObjectURL(new Blob([webPngBytes], { type: 'image/png' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = 'diagram.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          markExportSaved('diagram.png');
          toast({
            title: 'Downloaded',
            description: `Diagram saved as diagram.png (${dimensions.outputWidth}x${dimensions.outputHeight}px${metadataSkipped ? ', metadata skipped' : ''})`,
            variant: metadataSkipped ? 'warning' : 'success',
          });
        }).catch(() => {
          toast({ title: 'Error', description: 'Failed to save PNG', variant: 'error' });
        });
      }, 'image/png');
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(parseResult.svg)));
  }, [capabilities.isDesktop, markExportSaved, parseResult, pngExportSettings, sourceFilePath]);

  return {
    downloadDrawio,
    beginDragEditableDrawio,
    copyXml,
    openInDrawioVSCode,
    downloadSvg,
    downloadPng,
    canCopyXml,
    canDragEditableDrawio,
    canDownloadDrawio,
    canDownloadSvg,
    canDownloadPng,
    canOpenInVSCode,
    canExportAnything,
    drawioExportLabel: parseResult
      ? (capabilities.isDesktop ? getExportSaveLabel('drawio') : getDrawioExportLabel(parseResult.drawioMode))
      : '.drawio',
    svgExportLabel: getExportSaveLabel('svg'),
    pngExportLabel: getExportSaveLabel('png'),
    primaryExportActionLabel: getPrimaryExportActionLabel(),
    exportStatusLabel: getExportStatusLabel(parseResult, parseError),
    editableDragLabel: 'Drag into draw.io',
  };
}

function showPasteFallback() {
  toast({
    title: 'Ready to Paste',
    description: 'Focus draw.io and press Cmd+V to insert the editable diagram.',
    variant: 'info',
  });
}

function getExportStatusLabel(
  parseResult: ReturnType<typeof useEditorStore.getState>['parseResult'],
  parseError: ReturnType<typeof useEditorStore.getState>['parseError']
): string {
  if (parseError) {
    return '';
  }

  if (!parseResult) {
    return '';
  }

  if (parseResult.xmlStatus === 'pending') {
    return 'Preparing export...';
  }

  if (parseResult.xmlStatus === 'error') {
    return 'Export unavailable';
  }

  if (parseResult.drawioMode === 'native-full') {
    return 'Editable .drawio ready';
  }

  if (parseResult.drawioMode === 'native-hybrid') {
    return 'Editable with visual fallbacks';
  }

  return 'Visual export only';
}

function getDragExportBasename(filePath: string | null) {
  const defaultExportPath = getDefaultExportPath(filePath, 'drawio');
  return defaultExportPath.replace(/\.drawio$/, '');
}

export function clampPngScale(scale: number) {
  if (!Number.isFinite(scale)) {
    return 1;
  }

  return Math.min(Math.max(scale, 1), 4);
}

export function getPngExportDescription(scale: number, background: PngBackgroundMode) {
  return `${clampPngScale(scale)}x, ${background === 'transparent' ? 'transparent' : 'white'} background`;
}

export function getPngExportSettingsDescription(settings: PngExportSettings, dimensions?: { width: number; height: number } | null) {
  return describePngExport(settings, dimensions);
}
