import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { ErrorDisplay } from './ErrorDisplay';
import { Layers } from 'lucide-react';
import {
  PREVIEW_ZOOM_STEP,
  remapPreviewViewportToContent,
} from './previewViewport';

export function DiagramPreview() {
  const parseResult = useEditorStore((state) => state.parseResult);
  const parseError = useEditorStore((state) => state.parseError);
  const isConverting = useEditorStore((state) => state.isConverting);
  const detectedType = useEditorStore((state) => state.diagramType.override || state.diagramType.detected);
  const previewViewport = useEditorStore((state) => state.previewViewport);
  const setPreviewViewport = useEditorStore((state) => state.setPreviewViewport);
  const setPreviewViewportSize = useEditorStore((state) => state.setPreviewViewportSize);
  const setPreviewContentSize = useEditorStore((state) => state.setPreviewContentSize);
  const panPreviewBy = useEditorStore((state) => state.panPreviewBy);
  const zoomPreviewAtPoint = useEditorStore((state) => state.zoomPreviewAtPoint);
  const fitPreview = useEditorStore((state) => state.fitPreview);
  const resetPreview = useEditorStore((state) => state.resetPreview);
  const resetPreviewState = useEditorStore((state) => state.resetPreviewState);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pointerStateRef = useRef<{ pointerId: number; clientX: number; clientY: number } | null>(null);
  const previousContentSizeRef = useRef({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const touchPointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistanceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!parseResult?.svg) {
      previousContentSizeRef.current = { width: 0, height: 0 };
      resetPreviewState();
    }
  }, [parseResult?.svg, resetPreviewState]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;
      setPreviewViewportSize(width, height);

      const state = useEditorStore.getState().previewViewport;
      if (!state.hasInteracted && state.contentWidth > 0 && state.contentHeight > 0) {
        useEditorStore.getState().fitPreview();
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [setPreviewViewportSize]);

  useLayoutEffect(() => {
    if (!parseResult?.svg || !contentRef.current) {
      return;
    }

    const svg = contentRef.current.querySelector('svg');
    if (!svg) {
      return;
    }

    const { width, height } = readSvgSize(svg);
    if (width <= 0 || height <= 0) {
      return;
    }

    const state = useEditorStore.getState().previewViewport;
    const previousSize = previousContentSizeRef.current;

    if (!state.hasInteracted || previousSize.width <= 0 || previousSize.height <= 0) {
      setPreviewContentSize(width, height);
      useEditorStore.getState().fitPreview();
    } else {
      setPreviewViewport(
        remapPreviewViewportToContent(state, width, height)
      );
    }

    previousContentSizeRef.current = { width, height };
  }, [parseResult?.svg, setPreviewContentSize, setPreviewViewport]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      event.preventDefault();
      touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setIsPanning(true);
      return;
    }
    if (event.button !== 2) {
      return;
    }

    event.preventDefault();
    event.currentTarget.focus();
    pointerStateRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' && touchPointersRef.current.has(event.pointerId)) {
      const previous = touchPointersRef.current.get(event.pointerId)!;
      touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const points = Array.from(touchPointersRef.current.values());
      if (points.length === 1) {
        panPreviewBy(event.clientX - previous.x, event.clientY - previous.y);
      } else if (points.length >= 2) {
        const [first, second] = points;
        const distance = Math.hypot(second.x - first.x, second.y - first.y);
        const rect = event.currentTarget.getBoundingClientRect();
        const anchorX = ((first.x + second.x) / 2) - rect.left;
        const anchorY = ((first.y + second.y) / 2) - rect.top;
        if (pinchDistanceRef.current && pinchDistanceRef.current > 0) {
          zoomPreviewAtPoint(previewViewport.zoom * (distance / pinchDistanceRef.current), anchorX, anchorY);
        }
        pinchDistanceRef.current = distance;
      }
      return;
    }
    const pointerState = pointerStateRef.current;
    if (!pointerState || pointerState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - pointerState.clientX;
    const deltaY = event.clientY - pointerState.clientY;
    pointerStateRef.current = {
      ...pointerState,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    panPreviewBy(deltaX, deltaY);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      touchPointersRef.current.delete(event.pointerId);
      if (touchPointersRef.current.size < 2) pinchDistanceRef.current = null;
      if (touchPointersRef.current.size === 0) setIsPanning(false);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
      return;
    }
    const pointerState = pointerStateRef.current;
    if (!pointerState || pointerState.pointerId !== event.pointerId) {
      return;
    }

    pointerStateRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleNativeWheel = (event: WheelEvent) => {
      const { parseResult, previewViewport, zoomPreviewAtPoint, panPreviewBy } = useEditorStore.getState();
      if (!parseResult?.svg) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.metaKey || event.ctrlKey) {
        const rect = container.getBoundingClientRect();
        const anchorX = event.clientX - rect.left;
        const anchorY = event.clientY - rect.top;
        const scaleFactor = Math.exp(-event.deltaY * 0.0015);
        zoomPreviewAtPoint(previewViewport.zoom * scaleFactor, anchorX, anchorY);
        return;
      }

      panPreviewBy(-event.deltaX, -event.deltaY);
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false, capture: true });
    return () => container.removeEventListener('wheel', handleNativeWheel, { capture: true });
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && (event.key === '=' || event.key === '+')) {
      event.preventDefault();
      zoomPreviewAtPoint(
        previewViewport.zoom * (1 + PREVIEW_ZOOM_STEP),
        previewViewport.viewportWidth / 2,
        previewViewport.viewportHeight / 2
      );
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === '-') {
      event.preventDefault();
      zoomPreviewAtPoint(
        previewViewport.zoom * (1 - PREVIEW_ZOOM_STEP),
        previewViewport.viewportWidth / 2,
        previewViewport.viewportHeight / 2
      );
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === '0') {
      event.preventDefault();
      resetPreview();
      return;
    }

    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      fitPreview();
    }
  };

  const zoomPercentage = Math.round(previewViewport.zoom * 100);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-zinc-900 light:bg-zinc-100">
      <div
        ref={containerRef}
        tabIndex={0}
        aria-label={`Diagram preview canvas${parseResult?.svg ? ` at ${zoomPercentage}% zoom` : ''}`}
        className={`relative flex-1 overflow-hidden overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80 focus-visible:ring-inset ${isPanning ? 'cursor-grabbing' : 'cursor-default'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={handleKeyDown}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-20 light:opacity-50"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, var(--color-zinc-600) 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        {parseResult?.svg ? (
          <div
            className="absolute left-0 top-0 origin-top-left will-change-transform"
            style={{
              width: `${previewViewport.contentWidth}px`,
              height: `${previewViewport.contentHeight}px`,
              transform: `translate(${previewViewport.panX}px, ${previewViewport.panY}px) scale(${previewViewport.zoom})`,
            }}
          >
            <div
              ref={contentRef}
              className={`pointer-events-none relative z-10 select-none transition-opacity duration-300 ${isConverting ? 'opacity-50' : 'opacity-100'} ${detectedType === 'plantuml' ? 'invert hue-rotate-180 light:invert-0 light:hue-rotate-0' : ''}`}
              dangerouslySetInnerHTML={{ __html: parseResult.svg }}
            />
          </div>
        ) : !parseError ? (
          <div className="flex h-full flex-col items-center justify-center text-zinc-500 light:text-zinc-400">
            <Layers className="mb-4 h-16 w-16 opacity-20" />
            <p>Diagram preview will appear here</p>
          </div>
        ) : null}

        {parseError && <ErrorDisplay error={parseError} />}
        {parseResult?.isStale ? (
          <div role="status" className="absolute right-3 top-3 z-20 rounded-full border border-amber-500/30 bg-zinc-950/90 px-3 py-1 text-xs font-medium text-amber-300 shadow">
            Preview is from the last valid source
          </div>
        ) : null}
      </div>
    </div>
  );
}

function readSvgSize(svg: SVGSVGElement) {
  const viewBox = svg.viewBox?.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return {
      width: viewBox.width,
      height: viewBox.height,
    };
  }

  const widthAttribute = svg.getAttribute('width');
  const heightAttribute = svg.getAttribute('height');
  const width = Number.parseFloat(widthAttribute || '0');
  const height = Number.parseFloat(heightAttribute || '0');
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height };
  }

  try {
    const bbox = svg.getBBox();
    if (bbox.width > 0 && bbox.height > 0) {
      return {
        width: bbox.width,
        height: bbox.height,
      };
    }
  } catch {
    return { width: 0, height: 0 };
  }

  return { width: 0, height: 0 };
}
