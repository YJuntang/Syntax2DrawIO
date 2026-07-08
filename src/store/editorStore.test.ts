import { beforeEach, expect, test } from 'vitest';
import { DEFAULT_SOURCE_CODE, useEditorStore } from './editorStore';
import { DEFAULT_PREVIEW_VIEWPORT } from '../components/preview/previewViewport';

beforeEach(() => {
  useEditorStore.setState({
    sourceCode: DEFAULT_SOURCE_CODE,
    sourceFilePath: null,
    currentFilePath: null,
    lastSavedSourceCode: DEFAULT_SOURCE_CODE,
    lastExportPath: null,
    diagramType: {
      detected: null,
      subtype: '',
      confidence: 0,
      override: null,
    },
    parseResult: null,
    parseError: null,
    isConverting: false,
    previewViewport: DEFAULT_PREVIEW_VIEWPORT,
  });
});

test('markSourceSaved records the source path and clears dirty state', () => {
  useEditorStore.setState({
    sourceCode: 'flowchart TD\nA-->B',
    sourceFilePath: null,
    currentFilePath: null,
    lastSavedSourceCode: DEFAULT_SOURCE_CODE,
  });

  useEditorStore.getState().markSourceSaved('/Users/kal/Downloads/diagram.mmd');

  expect(useEditorStore.getState().sourceFilePath).toBe('/Users/kal/Downloads/diagram.mmd');
  expect(useEditorStore.getState().currentFilePath).toBe('/Users/kal/Downloads/diagram.mmd');
  expect(useEditorStore.getState().lastSavedSourceCode).toBe('flowchart TD\nA-->B');
});

test('markSourceSaved preserves the source path when no new path is provided', () => {
  useEditorStore.setState({
    sourceCode: 'sequenceDiagram\nA->>B: hi',
    sourceFilePath: '/Users/kal/Downloads/diagram.mmd',
    currentFilePath: '/Users/kal/Downloads/diagram.mmd',
    lastSavedSourceCode: DEFAULT_SOURCE_CODE,
  });

  useEditorStore.getState().markSourceSaved();

  expect(useEditorStore.getState().sourceFilePath).toBe('/Users/kal/Downloads/diagram.mmd');
  expect(useEditorStore.getState().currentFilePath).toBe('/Users/kal/Downloads/diagram.mmd');
  expect(useEditorStore.getState().lastSavedSourceCode).toBe('sequenceDiagram\nA->>B: hi');
});

test('markExportSaved records the export path without clearing dirty source state', () => {
  useEditorStore.setState({
    sourceCode: 'flowchart TD\nA-->B\nB-->C',
    sourceFilePath: '/Users/kal/Downloads/diagram.mmd',
    currentFilePath: '/Users/kal/Downloads/diagram.mmd',
    lastSavedSourceCode: 'flowchart TD\nA-->B',
    lastExportPath: null,
  });

  useEditorStore.getState().markExportSaved('/Users/kal/Downloads/diagram.drawio');

  expect(useEditorStore.getState().lastExportPath).toBe('/Users/kal/Downloads/diagram.drawio');
  expect(useEditorStore.getState().sourceFilePath).toBe('/Users/kal/Downloads/diagram.mmd');
  expect(useEditorStore.getState().lastSavedSourceCode).toBe('flowchart TD\nA-->B');
});

test('fitPreview updates the preview viewport using the stored content and viewport size', () => {
  useEditorStore.getState().setPreviewViewport({
    contentWidth: 1000,
    contentHeight: 500,
    viewportWidth: 800,
    viewportHeight: 600,
  });

  useEditorStore.getState().fitPreview();

  expect(useEditorStore.getState().previewViewport.zoom).toBeGreaterThan(0.6);
  expect(useEditorStore.getState().previewViewport.hasInteracted).toBe(false);
});

test('panPreviewBy marks the preview viewport as user-adjusted', () => {
  useEditorStore.getState().panPreviewBy(24, -12);

  expect(useEditorStore.getState().previewViewport.panX).toBe(24);
  expect(useEditorStore.getState().previewViewport.panY).toBe(-12);
  expect(useEditorStore.getState().previewViewport.hasInteracted).toBe(true);
});
