import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ParseResult, useEditorStore } from '../store/editorStore';
import { useHistoryStore } from '../store/historyStore';
import { detectDiagramType } from '../core/detector';
import { sanitizeInput, sanitizeSvg } from '../core/sanitizer';
import { extractSvgEdges, extractSvgLayout } from '../core/drawio/svgLayout';
import { EMPTY_SUPPORT_ANALYSIS } from '../core/drawio/support';
import { parseMermaidAst } from '../core/mermaid/parser';
import { renderMermaidSvg } from '../core/mermaid/renderer';
import { DrawioMode } from '../core/drawio/output';
import { parsePlantUML } from '../core/plantuml/parser';
import { addPlantUMLTransparentBackground, preprocessPlantUML } from '../core/plantuml/preprocessor';
import { applyWorkerError, applyWorkerResult } from '../workers/messageState';
import { WorkerMessage } from '../workers/types';
import { DEFAULT_PLANTUML_SERVER_URL, getRendererOrigin, useSettingsStore } from '../store/settingsStore';
import { isDesktopApp } from '../lib/platform';

const MAX_CONVERSION_CACHE_ENTRIES = 20;
const PLANTUML_RENDER_TIMEOUT_MS = 12000;

type ConversionCacheEntry = {
  key: string;
  result: ParseResult;
  diagramType: {
    detected: 'mermaid' | 'plantuml' | null;
    subtype: string;
    confidence: number;
    override: 'mermaid' | 'plantuml' | null;
  };
};

const conversionCache = new Map<string, ConversionCacheEntry>();

export function useConverter() {
  const sourceCode = useEditorStore((state) => state.sourceCode);
  const diagramTypeOverride = useEditorStore((state) => state.diagramType.override);
  const setDetectedType = useEditorStore((state) => state.setDetectedType);
  const setParseResult = useEditorStore((state) => state.setParseResult);
  const setParseError = useEditorStore((state) => state.setParseError);
  const setIsConverting = useEditorStore((state) => state.setIsConverting);
  const theme = useSettingsStore((state) => state.theme);
  const mermaidClassExportMode = useSettingsStore((state) => state.mermaidClassExportMode);
  const plantUmlServerUrl = useSettingsStore((state) => state.plantUmlServerUrl);
  const plantUmlConsentOrigins = useSettingsStore((state) => state.plantUmlConsentOrigins);
  const addHistoryEntry = useHistoryStore((state) => state.addEntry);
  const sourceFilePath = useEditorStore((state) => state.sourceFilePath);

  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingContextRef = useRef<{
    cacheKey: string;
    sourceCode: string;
    sourceFilePath: string | null;
    diagramType: ConversionCacheEntry['diagramType'];
  } | null>(null);

  // Initialize Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/converter.worker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.type === 'result') {
        const prev = useEditorStore.getState().parseResult;
        const next = applyWorkerResult(prev, msg, requestIdRef.current);
        if (!next) {
          return;
        }

        setParseResult(next);
        setParseError(null);
        setIsConverting(false);

        const context = pendingContextRef.current;
        if (context) {
          pendingContextRef.current = null;
          rememberConversion(context.cacheKey, {
            key: context.cacheKey,
            result: next,
            diagramType: context.diagramType,
          });
          addHistoryEntry({
            title: getHistoryTitle(context.sourceCode, context.sourceFilePath),
            sourceCode: context.sourceCode,
            sourcePath: context.sourceFilePath,
            diagramType: context.diagramType,
            exportMode: next.drawioMode,
          });
        }
      } else if (msg.type === 'error') {
        const prev = useEditorStore.getState().parseResult;
        const next = applyWorkerError(prev, msg, requestIdRef.current);
        if (!next) {
          return;
        }

        pendingContextRef.current = null;
        setParseResult(next);
        setParseError(msg.error);
        setIsConverting(false);
      }
    };

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      abortControllerRef.current?.abort();
      workerRef.current?.terminate();
    };
  }, [addHistoryEntry, setParseResult, setParseError, setIsConverting]);

  // Handle conversion on sourceCode change with debounce
  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    pendingContextRef.current = null;

    if (!sourceCode.trim()) {
      setParseResult(null);
      setParseError(null);
      setIsConverting(false);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsConverting(true);
    const existingResult = useEditorStore.getState().parseResult;
    if (existingResult?.svg) {
      setParseResult(createStalePreview(existingResult));
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        const detection = detectDiagramType(sourceCode);
        setDetectedType(detection.detected, detection.subtype, detection.confidence);
        setParseError(null);
        
        const typeToUse = diagramTypeOverride || detection.detected;
        if (!typeToUse) {
          pendingContextRef.current = null;
          throw new Error("Could not detect diagram type. Please select one manually.");
        }

        const diagramType = {
          detected: detection.detected,
          subtype: detection.subtype,
          confidence: detection.confidence,
          override: diagramTypeOverride,
        };
        const cacheKey = getConversionCacheKey({
          sourceCode,
          typeToUse,
          diagramTypeOverride,
          theme,
          mermaidClassExportMode,
          plantUmlServerUrl,
        });
        const cached = conversionCache.get(cacheKey);
        if (cached) {
          pendingContextRef.current = null;
          setDetectedType(cached.diagramType.detected, cached.diagramType.subtype, cached.diagramType.confidence);
          setParseResult(cached.result);
          setParseError(null);
          setIsConverting(false);
          return;
        }

        pendingContextRef.current = {
          cacheKey,
          sourceCode,
          sourceFilePath,
          diagramType,
        };

        const safeSource = sanitizeInput(sourceCode);

        if (typeToUse === 'mermaid') {
          // 1. Parse AST
          const ast = await parseMermaidAst(safeSource);
          const drawioMode = getMermaidDrawioMode(ast.type, mermaidClassExportMode);
          
          // 2. Render SVG (Main thread)
          const renderResult = await renderMermaidSvg(safeSource, theme);
          if (requestId !== requestIdRef.current) {
            return;
          }
          
          // 3. Temporarily update SVG immediately for responsive feel
          setParseResult({
            svg: renderResult.svg,
            drawioXml: '',
            drawioMode,
            editabilityLabel: drawioMode === 'native-full' ? 'Editable' : 'Visual only',
            exportDiagnostics: [],
            unsupportedFeatures: [],
            diagnostics: ast.diagnostics || [],
            coverage: ast.coverage,
            supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
            xmlStatus: 'pending',
            isStale: false,
          });

          // 4. Send to worker for XML generation
          workerRef.current?.postMessage({
            type: 'convert-mermaid',
            requestId,
            ast,
            positions: renderResult.nodes,
            edges: renderResult.edges,
            code: safeSource,
            svg: renderResult.svg,
            classExportMode: mermaidClassExportMode,
          } as WorkerMessage);
        } else if (typeToUse === 'plantuml') {
          const rendererOrigin = getRendererOrigin(plantUmlServerUrl);
          if (!rendererOrigin) {
            throw new Error('PlantUML renderer must be a valid HTTPS URL.');
          }
          if (!plantUmlConsentOrigins.includes(rendererOrigin)) {
            throw Object.assign(
              new Error(`PlantUML preview is paused until you allow source transmission to ${rendererOrigin}.`),
              {
                suggestion: 'Allow this renderer to preview PlantUML diagrams. Your diagram source will be sent to this origin.',
                action: {
                  type: 'grant-plantuml-consent',
                  rendererUrl: plantUmlServerUrl,
                  rendererOrigin,
                  label: 'Allow renderer',
                },
              }
            );
          }
          const lines = preprocessPlantUML(safeSource);
          const ast = parsePlantUML(lines);
          setDetectedType('plantuml', ast.type, detection.confidence);
          if (pendingContextRef.current) {
            pendingContextRef.current = {
              ...pendingContextRef.current,
              diagramType: {
                ...pendingContextRef.current.diagramType,
                detected: 'plantuml',
                subtype: ast.type,
              },
            };
          }
          const pumlWithTransparentBg = addPlantUMLTransparentBackground(safeSource);
          const abortController = new AbortController();
          abortControllerRef.current = abortController;
          import('plantuml-encoder').then(async (plantumlEncoder) => {
            if (requestId !== requestIdRef.current) {
              return;
            }

            const encoded = plantumlEncoder.encode(pumlWithTransparentBg);
            const plantUmlUrl = buildPlantUmlSvgUrl(plantUmlServerUrl, encoded);
            const plantUmlSvg = await withTimeout(
              fetchPlantUmlSvgMarkup(plantUmlUrl, abortController.signal),
              PLANTUML_RENDER_TIMEOUT_MS,
              'PlantUML renderer timed out. Check the renderer endpoint or try again.',
              abortController
            );
            if (requestId !== requestIdRef.current) {
              return;
            }

            const safePlantUmlSvg = sanitizeSvg(plantUmlSvg);
            const positions = extractSvgLayout(
              safePlantUmlSvg,
              ['g[id^="elem_"]', 'g[id^="cluster_"]', 'g.entity', 'g.cluster']
            );
            const edges = extractSvgEdges(safePlantUmlSvg, ['g[id^="link_"]', 'g.link']);
            const drawioMode = getPlantUmlDrawioMode(ast.type);
            setParseResult({ 
              svg: safePlantUmlSvg,
              drawioXml: '',
              drawioMode,
              editabilityLabel: drawioMode === 'native-full' ? 'Editable' : 'Visual only',
              exportDiagnostics: [],
              unsupportedFeatures: ast.unsupportedFeatures,
              diagnostics: ast.diagnostics || [],
              coverage: ast.coverage,
              supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
              xmlStatus: 'pending',
              isStale: false,
            });
            
            // Send to worker for XML generation
            workerRef.current?.postMessage({
              type: 'convert-plantuml',
              requestId,
              ast,
              svg: safePlantUmlSvg,
              positions,
              edges,
            } as WorkerMessage);
          }).catch((error: any) => {
            if (requestId !== requestIdRef.current) {
              return;
            }

            pendingContextRef.current = null;
            preserveLastPreviewAsStale();
            setParseError({
              message: error.message || 'Unknown error during conversion',
              suggestion: error.suggestion,
              action: error.action,
            });
            setIsConverting(false);
          });
        }
      } catch (error: any) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        pendingContextRef.current = null;
        preserveLastPreviewAsStale();
        setParseError({
          message: error.message || 'Unknown error during conversion',
          line: getErrorLine(error),
          suggestion: error.suggestion,
          action: error.action,
        });
        setIsConverting(false);
      }
    }, 500); // 500ms debounce

  }, [
    sourceCode,
    sourceFilePath,
    diagramTypeOverride,
    theme,
    mermaidClassExportMode,
    plantUmlServerUrl,
    plantUmlConsentOrigins,
    setDetectedType,
    setParseResult,
    setParseError,
    setIsConverting,
  ]);
}

function getMermaidDrawioMode(type: string, classExportMode: 'visual' | 'editable'): DrawioMode {
  if (type === 'flowchart' || type === 'sequence' || type === 'er') {
    return 'native-full';
  }

  if (type === 'class') {
    return classExportMode === 'editable' ? 'native-full' : 'visual-full';
  }

  return 'visual-full';
}

function getPlantUmlDrawioMode(type: 'sequence' | 'class' | 'usecase' | 'unsupported'): DrawioMode {
  if (type === 'sequence' || type === 'class' || type === 'usecase') {
    return 'native-full';
  }

  return 'visual-full';
}

async function fetchPlantUmlSvgMarkup(url: string, signal?: AbortSignal): Promise<string> {
  const svg = isDesktopApp()
    ? await invoke<string>('fetch_plantuml_svg', { url })
    : await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`PlantUML renderer returned ${response.status}`);
        }
        return response.text();
      });

  if (!svg.includes('<svg')) {
    throw new Error('PlantUML renderer did not return valid SVG markup.');
  }

  return svg;
}

function rememberConversion(key: string, entry: ConversionCacheEntry) {
  conversionCache.delete(key);
  conversionCache.set(key, entry);

  while (conversionCache.size > MAX_CONVERSION_CACHE_ENTRIES) {
    const oldestKey = conversionCache.keys().next().value;
    if (!oldestKey) {
      return;
    }
    conversionCache.delete(oldestKey);
  }
}

function getConversionCacheKey(input: {
  sourceCode: string;
  typeToUse: 'mermaid' | 'plantuml';
  diagramTypeOverride: 'mermaid' | 'plantuml' | null;
  theme: 'dark' | 'light';
  mermaidClassExportMode: string;
  plantUmlServerUrl: string;
}) {
  return JSON.stringify(input);
}

function buildPlantUmlSvgUrl(serverUrl: string, encodedDiagram: string) {
  const trimmed = (serverUrl || DEFAULT_PLANTUML_SERVER_URL).trim().replace(/\/+$/, '');
  const base = trimmed.endsWith('/svg') ? trimmed : `${trimmed}/svg`;
  return `${base}/${encodedDiagram}`;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
  abortController?: AbortController
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      abortController?.abort();
      reject(new Error(message));
    }, timeoutMs);
    promise
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

function preserveLastPreviewAsStale() {
  const previous = useEditorStore.getState().parseResult;
  if (previous?.svg) {
    useEditorStore.getState().setParseResult(createStalePreview(previous));
  } else {
    useEditorStore.getState().setParseResult(null);
  }
}

export function createStalePreview(previous: ParseResult): ParseResult {
  return {
    ...previous,
    drawioXml: '',
    drawioMode: 'visual-full',
    editabilityLabel: 'Visual only',
    exportDiagnostics: [],
    unsupportedFeatures: [],
    supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
    xmlStatus: 'pending',
    isStale: true,
  };
}

function getErrorLine(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/line\s+(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

function getHistoryTitle(sourceCode: string, sourceFilePath: string | null) {
  if (sourceFilePath) {
    return sourceFilePath.split(/[\\/]/).pop();
  }

  return sourceCode
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
}
