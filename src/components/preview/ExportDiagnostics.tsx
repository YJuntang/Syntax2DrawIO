import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Info } from 'lucide-react';
import { getDrawioSupportMatrixRows, type DrawioSupportLevel, type DrawioSupportMatrixRow } from '../../core/drawio/support';
import { useEditorStore } from '../../store/editorStore';
import { cn } from '../../lib/utils';

export function ExportDiagnostics() {
  const parseResult = useEditorStore((state) => state.parseResult);
  const diagramType = useEditorStore((state) => state.diagramType);
  const [isOpen, setIsOpen] = useState(false);

  if (!parseResult) {
    return null;
  }

  const fallbackCount = parseResult.supportAnalysis.fallbackRegions.length;
  const partialCount = parseResult.supportAnalysis.partialFeatures.length;
  const unsupportedCount = parseResult.unsupportedFeatures.length;
  const hasWarnings = fallbackCount > 0 || partialCount > 0 || unsupportedCount > 0 || parseResult.exportDiagnostics.length > 0;
  const icon = parseResult.drawioMode === 'native-full' && !hasWarnings
    ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
    : <AlertTriangle className="h-4 w-4 text-amber-400" />;
  const supportRows = getDrawioSupportMatrixRows(diagramType.override || diagramType.detected, diagramType.subtype);

  return (
    <div className="border-b border-zinc-800/50 bg-zinc-950/70 light:border-zinc-200/70 light:bg-white/70">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={`${parseResult.editabilityLabel} export diagnostics`}
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-xs text-zinc-300 light:text-zinc-700"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="font-medium">{parseResult.editabilityLabel}</span>
          <span className="truncate text-zinc-500">{getSummary(parseResult.drawioMode, hasWarnings)}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', isOpen ? 'rotate-180' : '')} />
      </button>

      {isOpen ? (
        <div className="grid gap-3 px-4 pb-3 text-xs text-zinc-400 light:text-zinc-600 md:grid-cols-2">
          <DiagnosticList
            title="Native Export"
            items={parseResult.supportAnalysis.supportedFeatures}
            empty="No native features were reported."
            positive
          />
          <DiagnosticList
            title="Limitations"
            items={[
              ...parseResult.supportAnalysis.partialFeatures,
              ...parseResult.unsupportedFeatures,
              ...parseResult.exportDiagnostics,
              ...parseResult.supportAnalysis.fallbackRegions.map((region) => `${region.label}: ${region.reason ?? 'visual fallback'}`),
            ]}
            empty="No export limitations detected."
          />
          <SupportMatrix rows={supportRows} />
        </div>
      ) : null}
    </div>
  );
}

function SupportMatrix({ rows }: { rows: DrawioSupportMatrixRow[] }) {
  return (
    <div className="rounded-md border border-zinc-800/70 bg-zinc-900/60 p-3 light:border-zinc-200 light:bg-zinc-50 md:col-span-2">
      <div className="mb-2 flex items-center gap-2 font-medium text-zinc-200 light:text-zinc-800">
        <Info className="h-3.5 w-3.5 text-blue-400" />
        Support Matrix
      </div>
      <div className="grid gap-1">
        {rows.slice(0, 8).map((row) => (
          <div
            key={`${row.family}-${row.feature}`}
            className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 rounded bg-black/10 px-2 py-1.5 light:bg-white"
          >
            <span className="truncate font-medium text-zinc-300 light:text-zinc-700">{row.family}</span>
            <span className="truncate">{row.feature}</span>
            <SupportBadge level={row.level} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SupportBadge({ level }: { level: DrawioSupportLevel }) {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-[11px] font-medium capitalize',
        level === 'native high fidelity'
          ? 'bg-emerald-500/15 text-emerald-300 light:text-emerald-700'
          : level === 'native basic'
            ? 'bg-sky-500/15 text-sky-300 light:text-sky-700'
            : level === 'partial'
              ? 'bg-amber-500/15 text-amber-300 light:text-amber-700'
              : 'bg-zinc-500/15 text-zinc-300 light:text-zinc-600'
      )}
    >
      {level}
    </span>
  );
}

function DiagnosticList({
  title,
  items,
  empty,
  positive = false,
}: {
  title: string;
  items: string[];
  empty: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-md border border-zinc-800/70 bg-zinc-900/60 p-3 light:border-zinc-200 light:bg-zinc-50">
      <div className="mb-2 flex items-center gap-2 font-medium text-zinc-200 light:text-zinc-800">
        <Info className={cn('h-3.5 w-3.5', positive ? 'text-emerald-400' : 'text-amber-400')} />
        {title}
      </div>
      {items.length ? (
        <ul className="space-y-1">
          {items.slice(0, 6).map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </div>
  );
}

function getSummary(mode: string, hasWarnings: boolean) {
  if (mode === 'native-full' && !hasWarnings) {
    return 'All detected content is editable in Draw.io.';
  }

  if (mode === 'native-hybrid') {
    return 'Some regions export as editable shapes and some as visual fallbacks.';
  }

  if (hasWarnings) {
    return 'Review export notes before relying on editability.';
  }

  return 'Diagram exports as a visual Draw.io artifact.';
}
