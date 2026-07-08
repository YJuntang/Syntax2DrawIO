// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, test, vi } from 'vitest';
import { DiagramPreview } from './DiagramPreview';
import { useEditorStore } from '../../store/editorStore';
import { DEFAULT_SOURCE_CODE } from '../../store/editorStore';
import { DEFAULT_PREVIEW_VIEWPORT } from './previewViewport';
import { EMPTY_SUPPORT_ANALYSIS } from '../../core/drawio/support';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverMock {
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [
        {
          target,
          contentRect: {
            width: 800,
            height: 600,
          } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver
    );
  }

  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  (globalThis as any).ResizeObserver = ResizeObserverMock;
  useEditorStore.setState({
    sourceCode: DEFAULT_SOURCE_CODE,
    currentFilePath: null,
    lastSavedSourceCode: DEFAULT_SOURCE_CODE,
    diagramType: {
      detected: 'mermaid',
      subtype: 'flowchart',
      confidence: 1,
      override: null,
    },
    parseResult: {
      svg: '<svg width="400" height="200" viewBox="0 0 400 200"></svg>',
      drawioXml: '<mxfile />',
      drawioMode: 'native-full',
      editabilityLabel: 'Editable',
      exportDiagnostics: [],
      unsupportedFeatures: [],
      supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
      xmlStatus: 'ready',
    },
    parseError: null,
    isConverting: false,
    previewViewport: DEFAULT_PREVIEW_VIEWPORT,
  });
});

test('diagram preview suppresses the context menu and pans on right drag', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<DiagramPreview />);
  });

  const preview = container.querySelector('[aria-label^="Diagram preview canvas"]') as HTMLDivElement;
  expect(preview).toBeTruthy();

  const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  preview.dispatchEvent(contextMenuEvent);
  expect(contextMenuEvent.defaultPrevented).toBe(true);
  const { panX: beforePanX, panY: beforePanY } = useEditorStore.getState().previewViewport;

  act(() => {
    preview.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 2, pointerId: 1, clientX: 100, clientY: 100 }));
    preview.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 130, clientY: 120 }));
    preview.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 130, clientY: 120 }));
  });

  expect(useEditorStore.getState().previewViewport.panX).toBe(beforePanX + 30);
  expect(useEditorStore.getState().previewViewport.panY).toBe(beforePanY + 20);

  act(() => {
    root.unmount();
  });
});

test('modifier wheel zoom stays inside the preview surface', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const parentWheel = vi.fn();

  act(() => {
    root.render(
      <div onWheel={parentWheel}>
        <DiagramPreview />
      </div>
    );
  });

  const preview = container.querySelector('[aria-label^="Diagram preview canvas"]') as HTMLDivElement;
  const beforeZoom = useEditorStore.getState().previewViewport.zoom;
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    metaKey: true,
    deltaY: -100,
    clientX: 200,
    clientY: 150,
  });

  act(() => {
    preview.dispatchEvent(event);
  });

  expect(event.defaultPrevented).toBe(true);
  expect(parentWheel).not.toHaveBeenCalled();
  expect(useEditorStore.getState().previewViewport.zoom).toBeGreaterThan(beforeZoom);

  act(() => {
    root.unmount();
  });
});

test('plain wheel pans the preview instead of zooming it', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<DiagramPreview />);
  });

  const preview = container.querySelector('[aria-label^="Diagram preview canvas"]') as HTMLDivElement;
  const beforeViewport = useEditorStore.getState().previewViewport;
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaX: 24,
    deltaY: 48,
    clientX: 200,
    clientY: 150,
  });

  act(() => {
    preview.dispatchEvent(event);
  });

  const nextViewport = useEditorStore.getState().previewViewport;
  expect(event.defaultPrevented).toBe(true);
  expect(nextViewport.zoom).toBe(beforeViewport.zoom);
  expect(nextViewport.panX).toBe(beforeViewport.panX - 24);
  expect(nextViewport.panY).toBe(beforeViewport.panY - 48);

  act(() => {
    root.unmount();
  });
});

test('preview keyboard shortcuts only affect the focused preview surface', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<DiagramPreview />);
  });

  const preview = container.querySelector('[aria-label^="Diagram preview canvas"]') as HTMLDivElement;
  const beforeZoom = useEditorStore.getState().previewViewport.zoom;

  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '=', metaKey: true, bubbles: true }));
  });
  expect(useEditorStore.getState().previewViewport.zoom).toBe(beforeZoom);

  act(() => {
    preview.focus();
    preview.dispatchEvent(new KeyboardEvent('keydown', { key: '=', metaKey: true, bubbles: true }));
  });

  expect(useEditorStore.getState().previewViewport.zoom).toBeGreaterThan(beforeZoom);

  act(() => {
    root.unmount();
  });
});
