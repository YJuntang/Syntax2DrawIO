import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export interface DrawioDocument {
  fileXml: string;
  graphModelXml: string;
}

export function parseDrawioDocument(fileXml: string): DrawioDocument | null {
  if (!fileXml.trim()) {
    return null;
  }

  const { document, errors } = parseXml(fileXml);
  const root = document.documentElement;
  if (!root || root.tagName !== 'mxfile' || errors.length > 0) {
    return null;
  }

  const graphModel = document.getElementsByTagName('mxGraphModel').item(0);
  if (!graphModel || !hasDrawioContent(graphModel)) {
    return null;
  }

  return {
    fileXml: new XMLSerializer().serializeToString(root),
    graphModelXml: new XMLSerializer().serializeToString(graphModel),
  };
}

export function parseXml(xml: string) {
  const errors: string[] = [];
  const document = new DOMParser({
    errorHandler: (level, message) => {
      if (level === 'error' || level === 'fatalError') {
        errors.push(String(message));
      }
    },
  }).parseFromString(xml, 'application/xml');
  return { document, errors };
}

export function hasDrawioContent(graphModel: Element) {
  return Array.from(graphModel.getElementsByTagName('mxCell')).some((cell) =>
    cell.getAttribute('vertex') === '1' || cell.getAttribute('edge') === '1'
  );
}

export function createDrawioHtmlFragment(graphModelXml: string) {
  return `<pre data-type="text/plain">${escapeHtml(graphModelXml)}</pre>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
