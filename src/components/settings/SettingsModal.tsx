import React from 'react';
import type { MermaidClassExportMode } from '../../core/mermaid/converter';
import {
  calculatePngExportDimensions,
  getPngExportDescription,
  parseSvgDimensions,
  type PngSizingMode,
} from '../../core/export/png';
import { useEditorStore } from '../../store/editorStore';
import { DEFAULT_PLANTUML_SERVER_URL, getRendererOrigin, useSettingsStore } from '../../store/settingsStore';
import { cn } from '../../lib/utils';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const mermaidClassExportMode = useSettingsStore((state) => state.mermaidClassExportMode);
  const setMermaidClassExportMode = useSettingsStore((state) => state.setMermaidClassExportMode);
  const showLanding = useSettingsStore((state) => state.showLanding);
  const setShowLanding = useSettingsStore((state) => state.setShowLanding);
  const pngExportSettings = useSettingsStore((state) => state.pngExportSettings);
  const setPngExportSettings = useSettingsStore((state) => state.setPngExportSettings);
  const plantUmlServerUrl = useSettingsStore((state) => state.plantUmlServerUrl);
  const setPlantUmlServerUrl = useSettingsStore((state) => state.setPlantUmlServerUrl);
  const plantUmlConsentOrigins = useSettingsStore((state) => state.plantUmlConsentOrigins);
  const grantPlantUmlConsent = useSettingsStore((state) => state.grantPlantUmlConsent);
  const revokePlantUmlConsent = useSettingsStore((state) => state.revokePlantUmlConsent);
  const rendererOrigin = getRendererOrigin(plantUmlServerUrl);
  const rendererAllowed = Boolean(rendererOrigin && plantUmlConsentOrigins.includes(rendererOrigin));
  const parseResult = useEditorStore((state) => state.parseResult);
  const previewDimensions = parseResult?.svg ? parseSvgDimensions(parseResult.svg) : null;
  const computedPngDimensions = previewDimensions
    ? calculatePngExportDimensions(previewDimensions.width, previewDimensions.height, pngExportSettings)
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      className="max-w-2xl"
      footer={
        <Button
          variant="primary"
          onClick={onClose}
          className="rounded-xl px-4"
        >
          Done
        </Button>
      }
    >
      <div className="divide-y divide-white/8 light:divide-zinc-200/80">
        <SettingGroup title="Appearance" description="Choose the app theme used across the editor and preview.">
          <SegmentedControl
            value={theme}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
            onChange={(value) => setTheme(value as 'dark' | 'light')}
          />
        </SettingGroup>

        <SettingGroup title="Mermaid Class Export" description="Choose the default Draw.io export style for Mermaid class diagrams.">
          <SegmentedControl
            value={mermaidClassExportMode}
            options={[
              { value: 'editable', label: 'Editable' },
              { value: 'visual', label: 'Visual' },
            ]}
            onChange={(value) => setMermaidClassExportMode(value as MermaidClassExportMode)}
          />
        </SettingGroup>

        <SettingGroup title="PNG Export" description="Set lossless output size, border, background, and editable PNG metadata.">
          <div className="space-y-3">
            <SegmentedControl
              value={pngExportSettings.sizingMode}
              options={[
                { value: 'scale', label: 'Scale' },
                { value: 'width', label: 'Width' },
                { value: 'max-dimension', label: 'Max' },
              ]}
              onChange={(value) => setPngExportSettings({ sizingMode: value as PngSizingMode })}
            />

            {pngExportSettings.sizingMode === 'scale' ? (
              <label className="block text-xs font-medium text-zinc-400 light:text-zinc-600">
                Scale
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="range"
                    min="25"
                    max="600"
                    step="25"
                    value={pngExportSettings.scalePercent}
                    onChange={(event) => setPngExportSettings({ scalePercent: Number(event.target.value) })}
                    className="min-w-0 flex-1 accent-blue-500"
                  />
                  <NumberInput
                    value={pngExportSettings.scalePercent}
                    suffix="%"
                    onChange={(value) => setPngExportSettings({ scalePercent: value })}
                  />
                </div>
              </label>
            ) : null}

            {pngExportSettings.sizingMode === 'width' ? (
              <NumberField
                label="Exact width"
                value={pngExportSettings.targetWidth}
                suffix="px"
                onChange={(value) => setPngExportSettings({ targetWidth: value })}
              />
            ) : null}

            {pngExportSettings.sizingMode === 'max-dimension' ? (
              <NumberField
                label="Max dimension"
                value={pngExportSettings.maxDimension}
                suffix="px"
                onChange={(value) => setPngExportSettings({ maxDimension: value })}
              />
            ) : null}

            <NumberField
              label="Border"
              value={pngExportSettings.border}
              suffix="px"
              onChange={(value) => setPngExportSettings({ border: value })}
            />

            <SegmentedControl
              value={pngExportSettings.background}
              options={[
                { value: 'white', label: 'White' },
                { value: 'transparent', label: 'Clear' },
              ]}
              onChange={(value) => setPngExportSettings({ background: value as 'white' | 'transparent' })}
            />

            <SwitchRow
              label="Editable PNG"
              checked={pngExportSettings.embedDrawioXml}
              onChange={(checked) => setPngExportSettings({ embedDrawioXml: checked })}
            />

            <div className={cn(
              'rounded-md border px-3 py-2 text-xs',
              computedPngDimensions?.tooLarge
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 light:text-amber-700'
                : 'border-white/8 bg-black/10 text-zinc-400 light:border-zinc-200 light:bg-zinc-50 light:text-zinc-600'
            )}
            >
              {computedPngDimensions
                ? `${getPngExportDescription(pngExportSettings, previewDimensions)}${computedPngDimensions.tooLarge ? ' exceeds safe export size' : ''}`
                : getPngExportDescription(pngExportSettings)}
            </div>
          </div>
        </SettingGroup>

        <section className="py-4">
          <div className="space-y-2">
            <div>
              <h3 className="text-sm font-medium text-zinc-100 light:text-zinc-900">PlantUML Renderer</h3>
              <p className="mt-1 text-sm leading-5 text-zinc-400 light:text-zinc-600">
                Use the public renderer or an HTTPS-compatible PlantUML server.
              </p>
            </div>
            <input
              type="url"
              aria-label="PlantUML renderer URL"
              value={plantUmlServerUrl}
              onChange={(event) => setPlantUmlServerUrl(event.target.value)}
              placeholder={DEFAULT_PLANTUML_SERVER_URL}
              className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-blue-500 light:border-zinc-300 light:bg-white light:text-zinc-900"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800/70 bg-black/10 px-3 py-2 text-xs light:border-zinc-200 light:bg-zinc-50">
              <span className={rendererAllowed ? 'text-emerald-400 light:text-emerald-700' : 'text-amber-300 light:text-amber-700'}>
                {rendererAllowed
                  ? `Allowed: source may be sent to ${rendererOrigin}`
                  : rendererOrigin
                    ? `Permission required before sending source to ${rendererOrigin}`
                    : 'Enter a valid HTTPS renderer URL'}
              </span>
              {rendererAllowed ? (
                <button type="button" onClick={() => revokePlantUmlConsent()} className="font-medium text-zinc-400 hover:text-zinc-200 light:hover:text-zinc-800">
                  Revoke
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!rendererOrigin}
                  onClick={() => grantPlantUmlConsent()}
                  className="font-medium text-blue-400 disabled:opacity-40"
                >
                  Allow renderer
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPlantUmlServerUrl(DEFAULT_PLANTUML_SERVER_URL)}
              className="text-xs font-medium text-blue-400 hover:text-blue-300"
            >
              Reset to public renderer
            </button>
          </div>
        </section>

        <section className="py-4">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-black/10 px-4 py-3 light:border-zinc-200/80 light:bg-zinc-50/90">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-zinc-100 light:text-zinc-900">Show Welcome Panel</h3>
              <p className="mt-1 text-sm leading-5 text-zinc-400 light:text-zinc-600">
                Display the introductory panel when the app starts.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="Show welcome panel"
              aria-checked={showLanding}
              onClick={() => setShowLanding(!showLanding)}
              className={cn(
                'relative h-6 w-11 shrink-0 overflow-hidden rounded-full border p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
                showLanding
                  ? 'border-blue-500/90 bg-blue-500/90'
                  : 'border-zinc-700/60 bg-zinc-800/80 light:border-zinc-300 light:bg-zinc-300'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.16)] transition-transform',
                  showLanding ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}

interface SettingGroupProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingGroup({ title, description, children }: SettingGroupProps) {
  return (
    <section className="py-4">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-zinc-100 light:text-zinc-900">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-zinc-400 light:text-zinc-600">{description}</p>
        </div>
        <div className="w-full shrink-0 sm:w-[17rem]">{children}</div>
      </div>
    </section>
  );
}

interface SegmentedControlProps {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function SegmentedControl({ value, options, onChange }: SegmentedControlProps) {
  return (
    <div className={cn(
      'grid gap-1 rounded-xl bg-black/10 p-1 ring-1 ring-white/6 light:bg-zinc-100 light:ring-zinc-200/80',
      options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
    )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-lg px-3 py-2 text-sm font-medium transition-all',
            value === option.value
              ? 'bg-white text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.12)] light:bg-white light:text-zinc-900'
              : 'text-zinc-400 hover:bg-white/8 hover:text-zinc-100 light:text-zinc-600 light:hover:bg-white light:hover:text-zinc-900'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  suffix: string;
  onChange: (value: number) => void;
}

function NumberField({ label, value, suffix, onChange }: NumberFieldProps) {
  return (
    <label className="block text-xs font-medium text-zinc-400 light:text-zinc-600">
      {label}
      <NumberInput value={value} suffix={suffix} onChange={onChange} className="mt-1 w-full" />
    </label>
  );
}

interface NumberInputProps {
  value: number;
  suffix: string;
  onChange: (value: number) => void;
  className?: string;
}

function NumberInput({ value, suffix, onChange, className }: NumberInputProps) {
  return (
    <div className={cn('flex h-8 items-center rounded-md border border-zinc-700 bg-zinc-950 px-2 light:border-zinc-300 light:bg-white', className)}>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-zinc-100 outline-none light:text-zinc-900"
      />
      <span className="ml-1 text-xs text-zinc-500">{suffix}</span>
    </div>
  );
}

interface SwitchRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SwitchRow({ label, checked, onChange }: SwitchRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-md border border-white/8 bg-black/10 px-3 py-2 text-left light:border-zinc-200 light:bg-zinc-50"
    >
      <span className="text-xs font-medium text-zinc-300 light:text-zinc-700">{label}</span>
      <span
        className={cn(
          'relative h-5 w-9 rounded-full border p-0.5 transition-colors',
          checked
            ? 'border-blue-500/90 bg-blue-500/90'
            : 'border-zinc-700/60 bg-zinc-800/80 light:border-zinc-300 light:bg-zinc-300'
        )}
      >
        <span
          className={cn(
            'block h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.16)] transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </span>
    </button>
  );
}
