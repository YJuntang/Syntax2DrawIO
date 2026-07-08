export type ParseDiagnosticSeverity = 'info' | 'warning' | 'error';
export type ParseFidelity = 'exact' | 'partial' | 'none';

export interface ParseDiagnostic {
  severity: ParseDiagnosticSeverity;
  code: string;
  message: string;
  line?: number;
  column?: number;
  statement?: string;
  suggestion?: string;
}

export interface ParseCoverage {
  fidelity: ParseFidelity;
  statementsTotal: number;
  statementsParsed: number;
  statementsIgnored: number;
}

export const EMPTY_PARSE_COVERAGE: ParseCoverage = {
  fidelity: 'none',
  statementsTotal: 0,
  statementsParsed: 0,
  statementsIgnored: 0,
};

export function createParseCoverage(
  statementsTotal: number,
  statementsParsed: number,
  statementsIgnored: number
): ParseCoverage {
  const fidelity: ParseFidelity = statementsParsed === 0
    ? 'none'
    : statementsIgnored > 0 || statementsParsed < statementsTotal
      ? 'partial'
      : 'exact';

  return {
    fidelity,
    statementsTotal,
    statementsParsed,
    statementsIgnored,
  };
}
