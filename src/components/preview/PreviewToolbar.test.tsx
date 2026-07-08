// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, test } from 'vitest';
import { useEditorStore } from '../../store/editorStore';
import { useSettingsStore } from '../../store/settingsStore';
import { PreviewToolbar } from './PreviewToolbar';
import { EMPTY_SUPPORT_ANALYSIS } from '../../core/drawio/support';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  useEditorStore.setState({
    diagramType: {
      detected: 'mermaid',
      subtype: 'classDiagram',
      confidence: 1,
      override: null,
    },
    previewViewport: {
      zoom: 1,
      panX: 0,
      panY: 0,
      hasInteracted: false,
      contentWidth: 100,
      contentHeight: 100,
      viewportWidth: 800,
      viewportHeight: 600,
    },
    parseResult: {
      svg: '<svg width="100" height="100"></svg>',
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
  });
  useSettingsStore.setState({ mermaidClassExportMode: 'editable' });
});

test('preview toolbar shows Mermaid class export mode controls', () => {
  const container = document.createElement('div');
  const root = createRoot(container);

  act(() => {
    root.render(<PreviewToolbar />);
  });

  expect(container.textContent).toContain('Visual');
  expect(container.textContent).toContain('Editable');
  expect(container.textContent).toContain('Editable .drawio ready');
  expect(container.textContent).toContain('100%');

  act(() => {
    root.unmount();
  });
});

test('preview toolbar switches Mermaid class export mode to visual', () => {
  const container = document.createElement('div');
  const root = createRoot(container);

  act(() => {
    root.render(<PreviewToolbar />);
  });

  const visualButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent?.includes('Visual'));

  expect(visualButton).toBeDefined();

  act(() => {
    visualButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(useSettingsStore.getState().mermaidClassExportMode).toBe('visual');

  act(() => {
    root.unmount();
  });
});

test('preview toolbar shows the PlantUML internet hint', () => {
  useEditorStore.setState({
    diagramType: {
      detected: 'plantuml',
      subtype: 'auto',
      confidence: 1,
      override: null,
    },
    parseResult: {
      svg: '<svg width="100" height="100"></svg>',
      drawioXml: '<mxfile />',
      drawioMode: 'visual-full',
      editabilityLabel: 'Visual only',
      exportDiagnostics: ['Unsupported diagram family for editable draw.io export.'],
      unsupportedFeatures: ['Unsupported diagram family for editable draw.io export.'],
      supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
      xmlStatus: 'ready',
    },
  });

  const container = document.createElement('div');
  const root = createRoot(container);

  act(() => {
    root.render(<PreviewToolbar />);
  });

  expect(container.textContent).toContain('PlantUML preview uses the online renderer');

  act(() => {
    root.unmount();
  });
});

test('preview toolbar shows limited editing status when export is partially editable', () => {
  useEditorStore.setState({
    diagramType: {
      detected: 'mermaid',
      subtype: 'flowchart',
      confidence: 1,
      override: null,
    },
    parseResult: {
      svg: '<svg width="100" height="100"></svg>',
      drawioXml: '<mxfile />',
      drawioMode: 'native-hybrid',
      editabilityLabel: 'Editable with visual fallbacks',
      exportDiagnostics: ['Flowchart styling and click directives are not preserved in editable export.'],
      unsupportedFeatures: ['Flowchart styling and click directives are not preserved in editable export.'],
      supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
      xmlStatus: 'ready',
    },
  });

  const container = document.createElement('div');
  const root = createRoot(container);

  act(() => {
    root.render(<PreviewToolbar />);
  });

  expect(container.textContent).toContain('Editable with visual fallbacks');

  act(() => {
    root.unmount();
  });
});

test('preview toolbar zoom controls update the shared preview viewport', () => {
  const container = document.createElement('div');
  const root = createRoot(container);

  act(() => {
    root.render(<PreviewToolbar />);
  });

  const zoomInButton = container.querySelector('button[aria-label="Zoom in preview"]');
  expect(zoomInButton).toBeDefined();

  act(() => {
    zoomInButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(useEditorStore.getState().previewViewport.zoom).toBeGreaterThan(1);

  act(() => {
    root.unmount();
  });
});

test('preview toolbar disables export actions and hides ready status when a parse error exists', () => {
  useEditorStore.setState({
    parseError: {
      message: 'Could not detect diagram type. Please select one manually.',
    },
  });

  const container = document.createElement('div');
  const root = createRoot(container);

  act(() => {
    root.render(<PreviewToolbar />);
  });

  expect(container.textContent).not.toContain('Editable .drawio ready');

  const copyButton = container.querySelector('button[aria-label="Copy for draw.io"]') as HTMLButtonElement | null;
  const exportButton = container.querySelector('button[aria-label="Export diagram"]') as HTMLButtonElement | null;

  expect(copyButton?.disabled).toBe(true);
  expect(exportButton?.disabled).toBe(true);

  act(() => {
    root.unmount();
  });
});
