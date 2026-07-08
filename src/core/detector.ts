interface DetectionResult {
  detected: 'mermaid' | 'plantuml' | null;
  subtype: string;
  confidence: number;
}

export function detectDiagramType(sourceCode: string): DetectionResult {
  const code = normalizeDiagramSource(sourceCode);
  if (!code) {
    return { detected: null, subtype: '', confidence: 0 };
  }

  const nonEmptyLines = getMeaningfulLines(code);
  const firstLine = nonEmptyLines[0] || '';
  const lastLine = nonEmptyLines[nonEmptyLines.length - 1] || '';

  // PlantUML explicit markers
  if (/^@startuml(?:\s+.*)?$/i.test(firstLine)) {
    return { detected: 'plantuml', subtype: 'auto', confidence: 1 };
  }

  if (/^@start[A-Za-z0-9_-]+$/i.test(firstLine) && /^@end[A-Za-z0-9_-]+$/i.test(lastLine)) {
    return { detected: 'plantuml', subtype: 'auto', confidence: 1 };
  }

  // Mermaid explicit graph types
  if (/^(graph|flowchart)(?:\s+(TD|BT|RL|LR|TB))?\b/i.test(firstLine)) {
    return { detected: 'mermaid', subtype: 'flowchart', confidence: 1 };
  }
  if (/^sequenceDiagram\b/i.test(firstLine)) {
    return { detected: 'mermaid', subtype: 'sequence', confidence: 1 };
  }
  if (/^classDiagram\b/i.test(firstLine)) {
    return { detected: 'mermaid', subtype: 'classDiagram', confidence: 1 };
  }
  if (/^erDiagram\b/i.test(firstLine)) {
    return { detected: 'mermaid', subtype: 'erDiagram', confidence: 1 };
  }

  // Fallback heuristics
  let plantUmlScore = 0;
  let mermaidScore = 0;

  // PlantUML keywords
  if (/\b(?:participant|actor|boundary|control|entity|database)\b/.test(code)) plantUmlScore += 2;
  if (/\b(?:usecase|rectangle|package|node|cloud)\b/.test(code)) plantUmlScore += 1;
  if (/--\|>|\.\.\|>|--\*|--o/.test(code)) plantUmlScore += 2; // PlantUML relationships

  // Mermaid keywords
  if (/-->|\.\.>/g.test(code)) mermaidScore += 1; // Arrows can be both, but very common in mermaid
  if (/subgraph\s+/.test(code)) mermaidScore += 2;

  if (plantUmlScore > mermaidScore && plantUmlScore > 1) {
    return { detected: 'plantuml', subtype: 'auto', confidence: 0.8 };
  } else if (mermaidScore > plantUmlScore && mermaidScore > 1) {
    return { detected: 'mermaid', subtype: 'auto', confidence: 0.8 };
  }

  return { detected: null, subtype: '', confidence: 0 };
}

export function normalizeDiagramSource(sourceCode: string) {
  return sourceCode.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
}

export function getMeaningfulLines(sourceCode: string) {
  const lines = normalizeDiagramSource(sourceCode).split('\n');
  const meaningful: string[] = [];
  let inFrontmatter = false;
  let frontmatterSeen = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (!frontmatterSeen && line === '---') {
      inFrontmatter = true;
      frontmatterSeen = true;
      continue;
    }
    if (inFrontmatter) {
      if (line === '---') {
        inFrontmatter = false;
      }
      continue;
    }
    if (line.startsWith('%%') || line.startsWith("'")) {
      continue;
    }
    if (/^%%\{[\s\S]*\}%%$/.test(line)) {
      continue;
    }

    meaningful.push(line);
  }

  return meaningful;
}
