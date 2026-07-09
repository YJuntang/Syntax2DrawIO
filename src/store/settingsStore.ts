import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MermaidClassExportMode } from '../core/mermaid/converter';
import {
  DEFAULT_PNG_EXPORT_SETTINGS,
  normalizePngExportSettings,
  type PngBackgroundMode,
  type PngExportSettings,
} from '../core/export/png';

export type { PngBackgroundMode, PngExportSettings } from '../core/export/png';

interface SettingsState {
  theme: 'dark' | 'light';
  splitRatio: number;
  showSyntaxHelp: boolean;
  showLanding: boolean;
  mermaidClassExportMode: MermaidClassExportMode;
  pngScale: number;
  pngBackground: PngBackgroundMode;
  pngExportSettings: PngExportSettings;
  plantUmlServerUrl: string;
  plantUmlConsentOrigins: string[];
  setTheme: (theme: 'dark' | 'light') => void;
  setSplitRatio: (ratio: number) => void;
  setShowSyntaxHelp: (show: boolean) => void;
  setShowLanding: (show: boolean) => void;
  setMermaidClassExportMode: (mode: MermaidClassExportMode) => void;
  setPngScale: (scale: number) => void;
  setPngBackground: (background: PngBackgroundMode) => void;
  setPngExportSettings: (settings: Partial<PngExportSettings>) => void;
  setPlantUmlServerUrl: (url: string) => void;
  grantPlantUmlConsent: (url?: string) => void;
  revokePlantUmlConsent: (url?: string) => void;
}

export const DEFAULT_PLANTUML_SERVER_URL = 'https://www.plantuml.com/plantuml';
export const DEFAULT_SETTINGS_PNG_EXPORT = DEFAULT_PNG_EXPORT_SETTINGS;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      splitRatio: 50,
      showSyntaxHelp: false,
      showLanding: true,
      mermaidClassExportMode: 'editable',
      pngScale: 2,
      pngBackground: 'white',
      pngExportSettings: DEFAULT_SETTINGS_PNG_EXPORT,
      plantUmlServerUrl: DEFAULT_PLANTUML_SERVER_URL,
      plantUmlConsentOrigins: [],
      setTheme: (theme) => set({ theme }),
      setSplitRatio: (splitRatio) => set({ splitRatio }),
      setShowSyntaxHelp: (showSyntaxHelp) => set({ showSyntaxHelp }),
      setShowLanding: (showLanding) => set({ showLanding }),
      setMermaidClassExportMode: (mermaidClassExportMode) => set({ mermaidClassExportMode }),
      setPngScale: (pngScale) => set((state) => {
        const nextScale = clampLegacyPngScale(pngScale);
        const pngExportSettings = normalizePngExportSettings({
          ...state.pngExportSettings,
          sizingMode: 'scale',
          scalePercent: nextScale * 100,
        });

        return {
          pngScale: nextScale,
          pngExportSettings,
        };
      }),
      setPngBackground: (pngBackground) => set((state) => {
        const pngExportSettings = normalizePngExportSettings({
          ...state.pngExportSettings,
          background: pngBackground,
        });

        return {
          pngBackground: pngExportSettings.background,
          pngExportSettings,
        };
      }),
      setPngExportSettings: (settings) => set((state) => {
        const pngExportSettings = normalizePngExportSettings({
          ...state.pngExportSettings,
          ...settings,
        });

        return {
          pngScale: pngScaleFromSettings(pngExportSettings),
          pngBackground: pngExportSettings.background,
          pngExportSettings,
        };
      }),
      setPlantUmlServerUrl: (plantUmlServerUrl) => set((state) => {
        const previousOrigin = getRendererOrigin(state.plantUmlServerUrl);
        const nextOrigin = getRendererOrigin(plantUmlServerUrl);
        return {
          plantUmlServerUrl,
          plantUmlConsentOrigins: previousOrigin && nextOrigin !== previousOrigin
            ? state.plantUmlConsentOrigins.filter((origin) => origin !== previousOrigin)
            : state.plantUmlConsentOrigins,
        };
      }),
      grantPlantUmlConsent: (url) => set((state) => {
        const origin = getRendererOrigin(url || state.plantUmlServerUrl);
        return origin && !state.plantUmlConsentOrigins.includes(origin)
          ? { plantUmlConsentOrigins: [...state.plantUmlConsentOrigins, origin] }
          : {};
      }),
      revokePlantUmlConsent: (url) => set((state) => {
        const origin = getRendererOrigin(url || state.plantUmlServerUrl);
        return { plantUmlConsentOrigins: state.plantUmlConsentOrigins.filter((item) => item !== origin) };
      }),
    }),
    {
      name: 's2d-settings',
      version: 3,
      migrate: (persistedState) => migratePersistedSettings(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<SettingsState> | undefined),
        ...migratePersistedSettings(persistedState),
      }),
    }
  )
);

function migratePersistedSettings(persistedState: unknown): Partial<SettingsState> {
  const persisted = (persistedState || {}) as Partial<SettingsState>;
  const legacyScalePercent = typeof persisted.pngScale === 'number'
    ? clampLegacyPngScale(persisted.pngScale) * 100
    : undefined;
  const pngExportSettings = normalizePngExportSettings({
    ...(persisted.pngExportSettings || {}),
    scalePercent: persisted.pngExportSettings?.scalePercent ?? legacyScalePercent,
    background: persisted.pngExportSettings?.background ?? persisted.pngBackground,
  });

  return {
    ...persisted,
    pngScale: pngScaleFromSettings(pngExportSettings),
    pngBackground: pngExportSettings.background,
    pngExportSettings,
    plantUmlServerUrl: persisted.plantUmlServerUrl || DEFAULT_PLANTUML_SERVER_URL,
    plantUmlConsentOrigins: Array.isArray(persisted.plantUmlConsentOrigins)
      ? persisted.plantUmlConsentOrigins.filter((value): value is string => typeof value === 'string')
      : [],
  };
}

export function getRendererOrigin(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

function clampLegacyPngScale(scale: number) {
  if (!Number.isFinite(scale)) {
    return 1;
  }

  return Math.min(Math.max(Math.round(scale), 1), 4);
}

function pngScaleFromSettings(settings: PngExportSettings) {
  return clampLegacyPngScale(settings.scalePercent / 100);
}
