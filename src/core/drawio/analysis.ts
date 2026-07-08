import { DrawioConversionResult, DrawioExportMetadata, DrawioMode } from './output';
import { addHiddenVisualReferenceLayer, generateImageFallbackXml } from './fallback';
import { normalizeDrawioId } from './builder';
import {
  DrawioSupportAnalysis,
  EMPTY_SUPPORT_ANALYSIS,
  mergeSupportAnalysis,
} from './support';
import type { ParseCoverage, ParseDiagnostic } from '../../types/diagnostics';
import { parseXml } from './document';

interface AnalyzeExportInput {
  drawioXml: string;
  drawioMode: DrawioMode;
  svg: string;
  unsupportedFeatures?: string[];
  diagnostics?: Array<string | ParseDiagnostic>;
  supportAnalysis?: DrawioSupportAnalysis;
  coverage?: ParseCoverage;
  expectedContent?: {
    vertexIds: string[];
    edgeIds: string[];
  };
}

interface XmlValidationResult {
  isValid: boolean;
  diagnostics: string[];
}

export function analyzeDrawioExport(input: AnalyzeExportInput): DrawioConversionResult & DrawioExportMetadata {
  const unsupportedFeatures = uniqueStrings(input.unsupportedFeatures || []);
  const parseDiagnostics = (input.diagnostics || []).filter(
    (diagnostic): diagnostic is ParseDiagnostic => typeof diagnostic !== 'string'
  );
  const diagnostics = uniqueStrings((input.diagnostics || []).map((diagnostic) =>
    typeof diagnostic === 'string' ? diagnostic : diagnostic.message
  ));
  const supportAnalysis = mergeSupportAnalysis(EMPTY_SUPPORT_ANALYSIS, input.supportAnalysis);

  if (input.drawioMode === 'visual-full' || input.drawioMode === 'fallback-url') {
    return {
      drawioXml: input.drawioXml,
      drawioMode: input.drawioMode,
      editabilityLabel: 'Visual only',
      exportDiagnostics: uniqueStrings([
        ...diagnostics,
        ...(unsupportedFeatures.length > 0 ? unsupportedFeatures : ['Unsupported diagram family for editable draw.io export.']),
      ]),
      unsupportedFeatures,
      supportAnalysis,
    };
  }

  const validation = validateDrawioXml(input.drawioXml, input.expectedContent);
  if (!validation.isValid) {
    const fallback = generateImageFallbackXml(input.svg);
    return {
      ...fallback,
      editabilityLabel: 'Visual only',
      exportDiagnostics: uniqueStrings([
        ...diagnostics,
        ...validation.diagnostics,
        'Validation failed, so the export was downgraded to a visual fallback.',
      ]),
      unsupportedFeatures: uniqueStrings([...unsupportedFeatures, 'validation failed']),
      supportAnalysis,
    };
  }

  const hasHybridFeatures =
    unsupportedFeatures.length > 0
    || supportAnalysis.partialFeatures.length > 0
    || supportAnalysis.fallbackRegions.length > 0
    || input.coverage?.fidelity === 'partial'
    || parseDiagnostics.some((diagnostic) => diagnostic.severity !== 'info');
  const drawioMode: DrawioMode = hasHybridFeatures ? 'native-hybrid' : input.drawioMode;
  const needsVisualReference = supportAnalysis.fallbackRegions.length > 0;
  const drawioXml = needsVisualReference
    ? addHiddenVisualReferenceLayer(input.drawioXml, input.svg)
    : input.drawioXml;
  return {
    drawioXml,
    drawioMode,
    editabilityLabel: hasHybridFeatures ? 'Editable with visual fallbacks' : 'Editable',
    exportDiagnostics: uniqueStrings([
      ...diagnostics,
      ...unsupportedFeatures,
      ...supportAnalysis.partialFeatures,
      ...supportAnalysis.fallbackRegions.map((region) => region.reason || `${region.label} preserved visually.`),
    ]),
    unsupportedFeatures,
    supportAnalysis,
  };
}

export function validateDrawioXml(
  xml: string,
  expectedContent?: { vertexIds: string[]; edgeIds: string[] }
): XmlValidationResult {
  const diagnostics: string[] = [];

  if (!xml.trim()) {
    return { isValid: false, diagnostics: ['Generated draw.io XML was empty.'] };
  }

  if (/(?:\b|["'>])(NaN|Infinity)(?:\b|["'<])/.test(xml)) {
    diagnostics.push('Generated draw.io XML contained invalid geometry values.');
  }

  const { document, errors } = parseXml(xml);
  if (
    errors.length > 0
    || document.documentElement?.tagName !== 'mxfile'
  ) {
    diagnostics.push('Generated draw.io XML was not well-formed.');
    return { isValid: false, diagnostics };
  }

  const cells = Array.from(document.getElementsByTagName('mxCell'));
  if (cells.length <= 2) {
    diagnostics.push('Generated draw.io XML did not contain any diagram content.');
  }

  const cellIds = cells.map((cell) => cell.getAttribute('id')).filter((value): value is string => Boolean(value));
  const uniqueCellIds = new Set(cellIds);
  if (uniqueCellIds.size !== cellIds.length) {
    diagnostics.push('Generated draw.io XML contained duplicate cell ids.');
  }

  if (cells.some((cell) => !cell.getAttribute('id'))) {
    diagnostics.push('Generated draw.io XML contained cells without ids.');
  }

  const contentCells = cells.filter((cell) => cell.getAttribute('vertex') === '1' || cell.getAttribute('edge') === '1');
  if (contentCells.length === 0) {
    diagnostics.push('Generated draw.io XML did not contain editable vertices or edges.');
  }
  if (contentCells.some((cell) => (cell.getAttribute('style') || '').includes('shape=image'))) {
    diagnostics.push('Generated native draw.io XML contained image fallback cells.');
  }
  if (!contentCells.some((cell) => cell.getAttribute('parent') === '1')) {
    diagnostics.push('Generated draw.io XML did not contain top-level diagram content.');
  }

  for (const cell of contentCells) {
    const geometry = cell.getElementsByTagName('mxGeometry').item(0);
    if (!geometry) {
      diagnostics.push('Generated draw.io XML contained cells without geometry.');
      break;
    }

    for (const attribute of ['x', 'y', 'width', 'height']) {
      const rawValue = geometry.getAttribute(attribute);
      if (!rawValue) {
        continue;
      }

      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue) || Math.abs(numericValue) > 1_000_000) {
        diagnostics.push('Generated draw.io XML contained out-of-range geometry.');
        break;
      }
    }

    const parent = cell.getAttribute('parent');
    if (parent && parent !== '0' && parent !== '1' && !uniqueCellIds.has(parent)) {
      diagnostics.push('Generated draw.io XML contained cells with missing parents.');
      break;
    }

    if (cell.getAttribute('edge') === '1') {
      const source = cell.getAttribute('source');
      const target = cell.getAttribute('target');
      if (!source || !target || !uniqueCellIds.has(source) || !uniqueCellIds.has(target)) {
        diagnostics.push('Generated draw.io XML contained edges with missing endpoints.');
        break;
      }
    }
  }
  validateExpectedContent(diagnostics, cells, expectedContent);

  return {
    isValid: diagnostics.length === 0,
    diagnostics,
  };
}

function validateExpectedContent(
  diagnostics: string[],
  cells: Element[],
  expected?: { vertexIds: string[]; edgeIds: string[] }
) {
  if (!expected) return;
  const vertices = new Set(cells
    .filter((cell) => cell.getAttribute('vertex') === '1')
    .map((cell) => cell.getAttribute('id'))
    .filter((id): id is string => Boolean(id)));
  const edges = new Set(cells
    .filter((cell) => cell.getAttribute('edge') === '1')
    .map((cell) => cell.getAttribute('id'))
    .filter((id): id is string => Boolean(id)));
  const missingVertices = expected.vertexIds.filter((id) => !vertices.has(normalizeDrawioId(id)));
  const missingEdges = expected.edgeIds.filter((id) => !edges.has(normalizeDrawioId(id)));
  if (missingVertices.length > 0) {
    diagnostics.push(`Generated draw.io XML was missing expected vertices: ${missingVertices.join(', ')}.`);
  }
  if (missingEdges.length > 0) {
    diagnostics.push(`Generated draw.io XML was missing expected edges: ${missingEdges.join(', ')}.`);
  }
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
