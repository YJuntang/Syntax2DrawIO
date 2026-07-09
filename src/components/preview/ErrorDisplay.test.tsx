// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, test } from 'vitest';
import { ErrorDisplay } from './ErrorDisplay';
import { useSettingsStore } from '../../store/settingsStore';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  document.body.innerHTML = '';
  useSettingsStore.setState({ plantUmlConsentOrigins: [] });
});

test('allows PlantUML renderer directly from the warning', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <ErrorDisplay
        error={{
          message: 'PlantUML preview is paused until you allow source transmission to https://www.plantuml.com.',
          suggestion: 'Allow this renderer to preview PlantUML diagrams.',
          action: {
            type: 'grant-plantuml-consent',
            rendererUrl: 'https://www.plantuml.com/plantuml',
            rendererOrigin: 'https://www.plantuml.com',
            label: 'Allow renderer',
          },
        }}
      />
    );
  });

  const button = Array.from(container.querySelectorAll('button'))
    .find((item) => item.textContent?.includes('Allow renderer')) as HTMLButtonElement | undefined;

  expect(button).toBeTruthy();

  act(() => {
    button?.click();
  });

  expect(useSettingsStore.getState().plantUmlConsentOrigins).toEqual(['https://www.plantuml.com']);

  act(() => {
    root.unmount();
  });
});
