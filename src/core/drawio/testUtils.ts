export function parseDrawioXml(xml: string): Document {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const parserError = document.querySelector('parsererror');
  if (parserError) {
    throw new Error(parserError.textContent || 'Generated draw.io XML is not well-formed.');
  }
  return document;
}

export function getDrawioCells(xml: string): Element[] {
  return Array.from(parseDrawioXml(xml).querySelectorAll('mxCell'));
}

export function getDrawioCellIds(xml: string): string[] {
  return getDrawioCells(xml)
    .map((cell) => cell.getAttribute('id'))
    .filter((id): id is string => Boolean(id));
}

export function getDrawioEdges(xml: string): Element[] {
  return getDrawioCells(xml).filter((cell) => cell.getAttribute('edge') === '1');
}
