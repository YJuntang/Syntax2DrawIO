// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, test } from 'vitest';
import { Dropdown } from './Dropdown';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  document.body.innerHTML = '';
});

test('dropdown renders its menu in a portal attached to document.body', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <Dropdown
        trigger={<button type="button">Open Menu</button>}
        align="right"
        items={[{ id: 'one', label: 'First item', onClick: () => {} }]}
      />
    );
  });

  const trigger = container.querySelector('button');
  expect(trigger).toBeTruthy();

  act(() => {
    trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const menuItem = Array.from(document.body.querySelectorAll('[role="menuitem"]'))
    .find((item) => item.textContent?.includes('First item'));

  expect(menuItem).toBeTruthy();
  expect(menuItem?.parentElement?.parentElement?.parentElement).toBe(document.body);

  act(() => {
    root.unmount();
  });
});

test('dropdown closes when clicking outside the trigger and portal menu', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const outside = document.createElement('div');
  outside.textContent = 'outside';
  document.body.appendChild(outside);
  const root = createRoot(container);

  act(() => {
    root.render(
      <Dropdown
        trigger={<button type="button">Open Menu</button>}
        items={[{ id: 'one', label: 'First item', onClick: () => {} }]}
      />
    );
  });

  const trigger = container.querySelector('button');
  expect(trigger).toBeTruthy();

  act(() => {
    trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(document.body.querySelector('[role="menuitem"]')).toBeTruthy();

  act(() => {
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });

  expect(document.body.querySelector('[role="menuitem"]')).toBeNull();

  act(() => {
    root.unmount();
  });
});

test('dropdown exposes menu-button semantics and restores focus after escape', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <Dropdown
        trigger={<button type="button" aria-label="Open Menu">Open Menu</button>}
        items={[
          { id: 'one', label: 'First item', onClick: () => {} },
          { id: 'two', label: 'Second item', onClick: () => {}, disabled: true },
        ]}
      />
    );
  });

  const trigger = container.querySelector('button');
  expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');
  expect(trigger?.getAttribute('aria-expanded')).toBe('false');

  act(() => {
    trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  });

  expect(trigger?.getAttribute('aria-expanded')).toBe('true');
  expect(document.activeElement?.textContent).toContain('First item');

  const menu = document.body.querySelector('[role="menu"]');
  expect(menu).toBeTruthy();

  act(() => {
    menu?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  expect(document.body.querySelector('[role="menuitem"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);

  act(() => {
    root.unmount();
  });
});
