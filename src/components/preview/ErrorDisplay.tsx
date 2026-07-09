import React, { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, ChevronDown, Copy } from 'lucide-react';
import { ParseError } from '../../store/editorStore';
import { useSettingsStore } from '../../store/settingsStore';

interface ErrorDisplayProps {
  error: ParseError;
}

export function ErrorDisplay({ error }: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);
  const grantPlantUmlConsent = useSettingsStore((state) => state.grantPlantUmlConsent);
  const parsed = useMemo(() => summarizeError(error), [error]);
  const isSyntax = parsed.isSyntax;
  const action = error.action;
  const title = getErrorTitle(isSyntax, Boolean(action));

  const handleAction = () => {
    if (action?.type === 'grant-plantuml-consent') {
      grantPlantUmlConsent(action.rendererUrl);
    }
  };

  return (
    <div role="alert" aria-live="assertive" className="absolute inset-x-4 bottom-4 z-20 flex max-w-xl items-start gap-3 rounded-xl border border-red-500/20 bg-zinc-950/95 p-4 shadow-lg backdrop-blur-md animate-slide-up light:bg-red-50 light:border-red-200">
      <div className="shrink-0">
        {isSyntax ? (
          <AlertCircle className="h-5 w-5 text-red-500" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        )}
      </div>
      
      <div className="flex-1 space-y-1">
        <h4 className={`text-sm font-medium ${isSyntax ? 'text-red-400 light:text-red-800' : 'text-amber-400 light:text-amber-800'}`}>
          {title}
          {parsed.line && ` at line ${parsed.line}${parsed.column ? `:${parsed.column}` : ''}`}
        </h4>
        
        <p className={`text-sm ${isSyntax ? 'text-red-300 light:text-red-700' : 'text-amber-300 light:text-amber-700'} mt-2`}>
          {parsed.summary}
        </p>

        {error.suggestion && (
          <div className="mt-3 rounded bg-black/20 p-2 text-xs text-zinc-300 light:bg-white/50 light:text-zinc-700">
            <span className="font-semibold block mb-1">Suggestion:</span>
            {error.suggestion}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {action ? (
            <button
              type="button"
              onClick={handleAction}
              className="inline-flex items-center gap-1 rounded bg-amber-500 px-2 py-1 text-xs font-semibold text-zinc-950 shadow-sm hover:bg-amber-400 light:bg-amber-500 light:text-white light:hover:bg-amber-600"
            >
              <Check className="h-3 w-3" /> {action.label}
            </button>
          ) : null}
          {parsed.line ? (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('s2d:reveal-line', { detail: { line: parsed.line, column: parsed.column || 1 } }))}
              className="rounded bg-white/5 px-2 py-1 text-xs font-medium text-blue-300 hover:bg-white/10 light:bg-white light:text-blue-700"
            >
              Jump to line
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(error.message)}
            className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-xs text-zinc-300 hover:bg-white/10 light:bg-white light:text-zinc-700"
          >
            <Copy className="h-3 w-3" /> Copy error
          </button>
          <button
            type="button"
            aria-expanded={showDetails}
            onClick={() => setShowDetails((value) => !value)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 light:text-zinc-600"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            Technical details
          </button>
        </div>
        {showDetails ? (
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-[11px] text-zinc-400 light:bg-white/70 light:text-zinc-700">
            {error.message}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

function getErrorTitle(isSyntax: boolean, hasAction: boolean) {
  if (isSyntax) {
    return 'Syntax error';
  }

  return hasAction ? 'Preview paused' : "Couldn't preview diagram";
}

function summarizeError(error: ParseError) {
  const lineMatch = error.message.match(/line\s+(\d+)/i);
  const columnMatch = error.message.match(/column\s+(\d+)/i);
  const line = error.line || (lineMatch ? Number(lineMatch[1]) : undefined);
  const column = columnMatch ? Number(columnMatch[1]) : undefined;
  const isSyntax = /syntax|parse error|expecting/i.test(error.message);
  const firstLine = error.message.split('\n').map((value) => value.trim()).find(Boolean) || 'Conversion failed.';
  const summary = firstLine
    .replace(/^Error:\s*/i, '')
    .replace(/\s*Expecting[\s\S]*$/i, '')
    .slice(0, 220);
  return { line, column, isSyntax, summary };
}
