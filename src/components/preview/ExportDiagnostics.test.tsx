// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, test } from 'vitest';
import { EMPTY_SUPPORT_ANALYSIS } from '../../core/drawio/support';
import { useEditorStore } from '../../store/editorStore';
import { ExportDiagnostics } from './ExportDiagnostics';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  document.body.innerHTML = '';
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
      exportDiagnostics: ['Click directives are not preserved.'],
      unsupportedFeatures: ['Custom Mermaid theme is visual only.'],
      supportAnalysis: {
        ...EMPTY_SUPPORT_ANALYSIS,
        supportedFeatures: ['Flowchart nodes'],
        partialFeatures: ['Styled edges'],
        fallbackRegions: [{ id: 'region-1', label: 'Subgraph A', kind: 'fallback', reason: 'unsupported style' }],
      },
      xmlStatus: 'ready',
    },
  });
});

test('export diagnostics support matrix distinguishes native high-fidelity from native basic support', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ExportDiagnostics />);
  });

  const toggle = container.querySelector('button');
  act(() => {
    toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(container.textContent).toContain('native high fidelity');
  expect(container.textContent).toContain('native basic');

  act(() => {
    root.unmount();
  });
});

test('export diagnostics shows the dedicated PlantUML Use Case support rows', () => {
  useEditorStore.setState((state) => ({
    diagramType: {
      detected: 'plantuml',
      subtype: 'usecase',
      confidence: 1,
      override: null,
    },
    parseResult: state.parseResult
      ? {
          ...state.parseResult,
          drawioMode: 'native-full',
          editabilityLabel: 'Editable',
          exportDiagnostics: [],
          unsupportedFeatures: [],
          supportAnalysis: {
            ...EMPTY_SUPPORT_ANALYSIS,
            supportedFeatures: ['actors and use cases'],
          },
        }
      : null,
  }));
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => root.render(<ExportDiagnostics />));
  act(() => {
    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(container.textContent).toContain('PlantUML Use Case');
  expect(container.textContent).toContain('include/extend dependencies');

  act(() => root.unmount());
});
