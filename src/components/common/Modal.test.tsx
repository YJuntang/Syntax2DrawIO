// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, test } from 'vitest';
import { Modal } from './Modal';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  document.body.innerHTML = '';
});

test('modal traps focus and restores it when closed', () => {
  const outsideButton = document.createElement('button');
  outsideButton.textContent = 'Outside';
  document.body.appendChild(outsideButton);
  outsideButton.focus();

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <Modal isOpen onClose={() => {}} title="Settings">
        <button type="button">First action</button>
        <button type="button">Second action</button>
      </Modal>
    );
  });

  const closeButton = container.querySelector('button[aria-label="Close modal"]') as HTMLButtonElement | null;
  expect(closeButton).toBeTruthy();
  expect(document.activeElement).toBe(closeButton);

  const secondAction = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent?.includes('Second action'));
  secondAction?.focus();

  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  });

  expect(document.activeElement).toBe(closeButton);

  act(() => {
    root.render(
      <Modal isOpen={false} onClose={() => {}} title="Settings">
        <button type="button">First action</button>
      </Modal>
    );
  });

  expect(document.activeElement).toBe(outsideButton);

  act(() => {
    root.unmount();
  });
});
