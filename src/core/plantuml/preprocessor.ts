export interface PlantUMLStatement {
  text: string;
  line: number;
}

export function preprocessPlantUML(code: string): PlantUMLStatement[] {
  const normalized = code.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const sourceLines = normalized.split('\n');
  const lines: PlantUMLStatement[] = [];

  for (let index = 0; index < sourceLines.length; index += 1) {
    const line = sourceLines[index].trim();
    if (!line || line.startsWith("'") || /^@(?:start|end)uml\b/i.test(line)) {
      continue;
    }

    const noteStart = line.match(/^note\s+((?:left|right|top|bottom)\s+of|over)\s+(.+)$/i);
    if (noteStart && !line.includes(':')) {
      const noteLine = index + 1;
      const body: string[] = [];
      index += 1;
      while (index < sourceLines.length && !/^end\s*note$/i.test(sourceLines[index].trim())) {
        const bodyLine = sourceLines[index].trim();
        if (bodyLine) body.push(bodyLine);
        index += 1;
      }
      lines.push({
        text: `note ${noteStart[1]} ${noteStart[2]}: ${body.join('\n')}`,
        line: noteLine,
      });
      continue;
    }

    lines.push({ text: line, line: index + 1 });
  }

  return lines;
}

export function addPlantUMLTransparentBackground(code: string) {
  const normalized = code.replace(/\r\n?/g, '\n');
  const directive = 'skinparam backgroundcolor transparent';
  if (new RegExp(`^\\s*${directive}\\s*$`, 'im').test(normalized)) {
    return normalized;
  }

  const endMarker = /^(\s*)@enduml\b.*$/im;
  if (endMarker.test(normalized)) {
    return normalized.replace(endMarker, `${directive}\n$&`);
  }

  return `${normalized.replace(/\s+$/, '')}\n${directive}\n`;
}
