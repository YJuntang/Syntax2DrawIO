// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, test, vi } from 'vitest';
import { DEFAULT_SOURCE_CODE, useEditorStore } from '../../store/editorStore';
import { useHistoryStore } from '../../store/historyStore';
import { HistoryPanel } from './HistoryPanel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  useEditorStore.setState({
    sourceCode: DEFAULT_SOURCE_CODE,
    sourceFilePath: null,
    currentFilePath: null,
    lastSavedSourceCode: DEFAULT_SOURCE_CODE,
  });
  useHistoryStore.setState({
    entries: [
      {
        id: 'entry-1',
        title: 'Saved Flow',
        sourceCode: 'flowchart TD\nA-->B',
        sourcePath: '/tmp/saved-flow.mmd',
        diagramType: {
          detected: 'mermaid',
          subtype: 'flowchart',
          confidence: 1,
          override: null,
        },
        exportMode: 'native-full',
        timestamp: Date.now(),
      },
    ],
  });
});

test('history panel restores a recent diagram', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<HistoryPanel isOpen onClose={() => {}} />);
  });

  const restoreButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent?.includes('Saved Flow'));

  expect(restoreButton).toBeDefined();

  await act(async () => {
    restoreButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(useEditorStore.getState().sourceCode).toBe('flowchart TD\nA-->B');
  expect(useEditorStore.getState().sourceFilePath).toBe('/tmp/saved-flow.mmd');

  act(() => {
    root.unmount();
  });
});
