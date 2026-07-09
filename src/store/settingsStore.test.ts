// @vitest-environment jsdom

import { beforeEach, expect, test } from 'vitest';
import { DEFAULT_PLANTUML_SERVER_URL, DEFAULT_SETTINGS_PNG_EXPORT, useSettingsStore } from './settingsStore';

beforeEach(() => {
  useSettingsStore.setState({
    mermaidClassExportMode: 'editable',
    pngScale: 2,
    pngBackground: 'white',
    pngExportSettings: DEFAULT_SETTINGS_PNG_EXPORT,
    plantUmlServerUrl: DEFAULT_PLANTUML_SERVER_URL,
    plantUmlConsentOrigins: [],
  });
});

test('settings default Mermaid class exports to editable mode', () => {
  expect(useSettingsStore.getInitialState().mermaidClassExportMode).toBe('editable');
});

test('settings default to light theme', () => {
  expect(useSettingsStore.getInitialState().theme).toBe('light');
});

test('settings can switch Mermaid class exports to visual mode', () => {
  useSettingsStore.getState().setMermaidClassExportMode('visual');

  expect(useSettingsStore.getState().mermaidClassExportMode).toBe('visual');
});

test('settings clamp PNG export scale', () => {
  useSettingsStore.getState().setPngScale(8);
  expect(useSettingsStore.getState().pngScale).toBe(4);
  expect(useSettingsStore.getState().pngExportSettings.scalePercent).toBe(400);

  useSettingsStore.getState().setPngScale(0);
  expect(useSettingsStore.getState().pngScale).toBe(1);
  expect(useSettingsStore.getState().pngExportSettings.scalePercent).toBe(100);
});

test('settings can update PNG export controls together', () => {
  useSettingsStore.getState().setPngExportSettings({
    sizingMode: 'width',
    targetWidth: 1600,
    background: 'transparent',
    embedDrawioXml: false,
  });

  expect(useSettingsStore.getState().pngExportSettings).toMatchObject({
    sizingMode: 'width',
    targetWidth: 1600,
    background: 'transparent',
    embedDrawioXml: false,
  });
  expect(useSettingsStore.getState().pngBackground).toBe('transparent');
});

test('settings can store a custom PlantUML renderer endpoint', () => {
  useSettingsStore.getState().setPlantUmlServerUrl('https://plantuml.internal/plantuml');

  expect(useSettingsStore.getState().plantUmlServerUrl).toBe('https://plantuml.internal/plantuml');
});

test('PlantUML renderer consent is scoped to an origin and reset when the endpoint changes', () => {
  useSettingsStore.getState().grantPlantUmlConsent();
  expect(useSettingsStore.getState().plantUmlConsentOrigins).toEqual(['https://www.plantuml.com']);

  useSettingsStore.getState().setPlantUmlServerUrl('https://plantuml.internal/plantuml');
  expect(useSettingsStore.getState().plantUmlConsentOrigins).toEqual([]);

  useSettingsStore.getState().grantPlantUmlConsent();
  expect(useSettingsStore.getState().plantUmlConsentOrigins).toEqual(['https://plantuml.internal']);
  useSettingsStore.getState().revokePlantUmlConsent();
  expect(useSettingsStore.getState().plantUmlConsentOrigins).toEqual([]);
});
