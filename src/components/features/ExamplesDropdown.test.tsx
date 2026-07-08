// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, test } from 'vitest';
import { DIAGRAM_EXAMPLES } from '../../examples/catalog';
import { useEditorStore } from '../../store/editorStore';
import { ExamplesDropdown } from './ExamplesDropdown';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  document.body.innerHTML = '';
  useEditorStore.setState({
    sourceCode: DIAGRAM_EXAMPLES[0].code,
    lastSavedSourceCode: DIAGRAM_EXAMPLES[0].code,
  });
});

test('shows every complex catalog example and loads PlantUML Use Case source', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ExamplesDropdown />);
  });
  act(() => {
    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  DIAGRAM_EXAMPLES.forEach((example) => {
    expect(container.textContent).toContain(example.name);
  });

  const useCaseButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent?.includes('PlantUML Use Case'));
  await act(async () => {
    useCaseButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(useEditorStore.getState().sourceCode).toBe(
    DIAGRAM_EXAMPLES.find((example) => example.id === 'plantuml-usecase')!.code
  );

  act(() => root.unmount());
});
