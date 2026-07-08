import React from 'react';
import { getPngExportSettingsDescription, useExport } from '../../hooks/useExport';
import { parseSvgDimensions } from '../../core/export/png';
import { useEditorStore } from '../../store/editorStore';
import { useSettingsStore } from '../../store/settingsStore';
import { PREVIEW_ZOOM_STEP } from './previewViewport';
import { Button } from '../common/Button';
import { Dropdown } from '../common/Dropdown';
import { Tooltip } from '../common/Tooltip';
import { cn } from '../../lib/utils';
import { Download, ExternalLink, Copy, FileCode2, Image as ImageIcon, GripVertical, ZoomIn, ZoomOut, ScanSearch, RotateCcw } from 'lucide-react';
import { getPlatformCapabilities } from '../../lib/platform';

export function PreviewToolbar() {
  const detectedType = useEditorStore((state) => state.diagramType.detected);
  const subtype = useEditorStore((state) => state.diagramType.subtype);
  const override = useEditorStore((state) => state.diagramType.override);
  const parseResult = useEditorStore((state) => state.parseResult);
  const previewViewport = useEditorStore((state) => state.previewViewport);
  const zoomPreviewAtPoint = useEditorStore((state) => state.zoomPreviewAtPoint);
  const fitPreview = useEditorStore((state) => state.fitPreview);
  const resetPreview = useEditorStore((state) => state.resetPreview);
  const mermaidClassExportMode = useSettingsStore((state) => state.mermaidClassExportMode);
  const setMermaidClassExportMode = useSettingsStore((state) => state.setMermaidClassExportMode);
  const pngExportSettings = useSettingsStore((state) => state.pngExportSettings);
  const {
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
    drawioExportLabel,
    svgExportLabel,
    pngExportLabel,
    primaryExportActionLabel,
    exportStatusLabel,
    editableDragLabel,
  } = useExport();
  const isMermaidClassDiagram = (override || detectedType) === 'mermaid' && subtype === 'classDiagram';
  const capabilities = getPlatformCapabilities();
  const effectiveType = override || detectedType;
  const needsPlantUmlInternet = effectiveType === 'plantuml';
  const canUsePreviewCamera = Boolean(parseResult?.svg && previewViewport.viewportWidth > 0 && previewViewport.viewportHeight > 0);
  const zoomPercentage = Math.round(previewViewport.zoom * 100);
  const pngDimensions = parseResult?.svg ? parseSvgDimensions(parseResult.svg) : null;

  const zoomAtCenter = (direction: 'in' | 'out') => {
    const factor = direction === 'in' ? 1 + PREVIEW_ZOOM_STEP : 1 - PREVIEW_ZOOM_STEP;
    zoomPreviewAtPoint(
      previewViewport.zoom * factor,
      previewViewport.viewportWidth / 2,
      previewViewport.viewportHeight / 2
    );
  };

  return (
    <div className="flex h-10 items-center justify-between gap-2 border-b border-zinc-800/50 bg-zinc-900/50 px-2 light:border-zinc-200/50 light:bg-zinc-50/50 md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
        <span className="text-xs font-medium text-zinc-400 light:text-zinc-600 uppercase tracking-wider">Preview</span>
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          {exportStatusLabel ? (
            <Tooltip
              content={
                parseResult?.exportDiagnostics?.length
                  ? parseResult.exportDiagnostics.join(' ')
                  : exportStatusLabel
              }
            >
              <span className="hidden max-w-[8rem] truncate text-xs text-zinc-500 light:text-zinc-500 sm:inline lg:max-w-[10rem] xl:max-w-[12rem]">
                {exportStatusLabel}
              </span>
            </Tooltip>
          ) : null}
          {needsPlantUmlInternet ? (
            <span className="hidden max-w-[11rem] truncate text-xs text-amber-400 xl:inline">
              PlantUML preview uses the online renderer
            </span>
          ) : null}
        </div>
      </div>
      
      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        <div className="hidden h-8 items-center overflow-hidden rounded-md border border-zinc-800/70 bg-zinc-950/50 light:border-zinc-200 light:bg-white sm:flex">
          <Tooltip content="Zoom out">
            <Button
              variant="ghost"
              size="icon"
              disabled={!canUsePreviewCamera}
              aria-label="Zoom out preview"
              className="h-8 w-8 rounded-none"
              onClick={() => zoomAtCenter('out')}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </Tooltip>

          <span className="min-w-[4rem] px-2 text-center text-xs font-medium text-zinc-300 light:text-zinc-700">
            {zoomPercentage}%
          </span>

          <Tooltip content="Zoom in">
            <Button
              variant="ghost"
              size="icon"
              disabled={!canUsePreviewCamera}
              aria-label="Zoom in preview"
              className="h-8 w-8 rounded-none"
              onClick={() => zoomAtCenter('in')}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </Tooltip>

          <div className="h-4 w-px bg-zinc-800/80 light:bg-zinc-200" />

          <Tooltip content="Fit preview to screen">
            <Button
              variant="ghost"
              size="icon"
              disabled={!canUsePreviewCamera}
              aria-label="Fit preview to screen"
              className="h-8 w-8 rounded-none"
              onClick={() => fitPreview()}
            >
              <ScanSearch className="h-4 w-4" />
            </Button>
          </Tooltip>

          <Tooltip content="Reset preview to 100%">
            <Button
              variant="ghost"
              size="icon"
              disabled={!canUsePreviewCamera}
              aria-label="Reset preview zoom"
              className="h-8 w-8 rounded-none"
              onClick={() => resetPreview()}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>

        <div className="flex sm:hidden">
          <Tooltip content="Fit preview to screen">
            <Button variant="ghost" size="icon" disabled={!canUsePreviewCamera} aria-label="Fit preview to screen" onClick={() => fitPreview()}>
              <ScanSearch className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Reset preview to 100%">
            <Button variant="ghost" size="icon" disabled={!canUsePreviewCamera} aria-label="Reset preview zoom" onClick={() => resetPreview()}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>

        {isMermaidClassDiagram ? (
          <div className="flex h-7 items-center overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 light:border-zinc-300 light:bg-white">
            <Tooltip content="Export as Mermaid-rendered visual">
              <button
                type="button"
                aria-pressed={mermaidClassExportMode === 'visual'}
                onClick={() => setMermaidClassExportMode('visual')}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 px-2 text-xs font-medium transition-colors',
                  mermaidClassExportMode === 'visual'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 light:text-zinc-600 light:hover:bg-zinc-100 light:hover:text-zinc-900'
                )}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Visual</span>
              </button>
            </Tooltip>

            <Tooltip content="Export as editable native draw.io UML class shapes">
              <button
                type="button"
                aria-pressed={mermaidClassExportMode === 'editable'}
                onClick={() => setMermaidClassExportMode('editable')}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 border-l border-zinc-700 px-2 text-xs font-medium transition-colors light:border-zinc-300',
                  mermaidClassExportMode === 'editable'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 light:text-zinc-600 light:hover:bg-zinc-100 light:hover:text-zinc-900'
                )}
              >
                <FileCode2 className="h-3.5 w-3.5" />
                <span>Editable</span>
              </button>
            </Tooltip>
          </div>
        ) : null}

        <Tooltip content="Copy editable shapes for draw.io">
          <Button
            variant="ghost"
            size="icon"
            onClick={copyXml}
            disabled={!canCopyXml}
            aria-label="Copy for draw.io"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </Tooltip>

        {capabilities.supportsEditableDragOut ? (
          <Tooltip content="Drag the current editable diagram into an open draw.io canvas">
            <Button
              variant="secondary"
              size="sm"
              disabled={!canDragEditableDrawio}
              className="gap-2"
              onMouseDown={(event) => {
                if (!canDragEditableDrawio) {
                  return;
                }
                event.preventDefault();
                void beginDragEditableDrawio();
              }}
            >
              <GripVertical className="h-4 w-4" /> {editableDragLabel}
            </Button>
          </Tooltip>
        ) : null}

        <div className="h-4 w-px bg-zinc-800 mx-1 light:bg-zinc-200" />

        {!capabilities.isDesktop ? (
          <div className="hidden sm:block">
          <Dropdown
            trigger={
              <Button variant="secondary" size="sm" disabled={!canOpenInVSCode} className="gap-2" aria-label="Open in external apps">
                <ExternalLink className="h-4 w-4" /> Open In...
              </Button>
            }
            align="right"
            menuClassName="w-[min(16rem,calc(100vw-1rem))]"
            items={[
              { id: 'vscode', label: 'VS Code Extension', onClick: openInDrawioVSCode, disabled: !canOpenInVSCode },
            ]}
          />
          </div>
        ) : null}

        <Dropdown
          trigger={
            <Button variant="primary" size="sm" disabled={!canExportAnything} className="gap-2" aria-label="Export diagram">
              <Download className="h-4 w-4" /> {primaryExportActionLabel}
            </Button>
          }
          align="right"
          menuClassName="w-[min(18rem,calc(100vw-1rem))]"
          items={[
            { id: 'drawio', label: drawioExportLabel, icon: <FileCode2 />, onClick: downloadDrawio, disabled: !canDownloadDrawio },
            { id: 'svg', label: svgExportLabel, icon: <ImageIcon />, onClick: downloadSvg, disabled: !canDownloadSvg },
            {
              id: 'png',
              label: `${pngExportLabel} (${getPngExportSettingsDescription(pngExportSettings, pngDimensions)})`,
              icon: <ImageIcon />,
              onClick: downloadPng,
              disabled: !canDownloadPng,
            },
          ]}
        />
      </div>
    </div>
  );
}
