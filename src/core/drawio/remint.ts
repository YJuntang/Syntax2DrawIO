let exportCounter = 0;

export function remintDrawioXmlIds(xml: string, prefixFactory: () => string = defaultPrefixFactory) {
  if (!xml.trim() || typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return xml;
  }

  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) {
    return xml;
  }

  const prefix = prefixFactory();
  const idMap = new Map<string, string>();
  const diagrams = Array.from(document.querySelectorAll('diagram'));
  const cells = Array.from(document.querySelectorAll('mxCell'));

  diagrams.forEach((diagram, index) => {
    const previousId = diagram.getAttribute('id');
    if (!previousId) {
      return;
    }

    const nextId = `${prefix}-diagram-${index}`;
    idMap.set(previousId, nextId);
    diagram.setAttribute('id', nextId);
  });

  cells.forEach((cell) => {
    const previousId = cell.getAttribute('id');
    if (!previousId || previousId === '0' || previousId === '1') {
      return;
    }

    const nextId = `${prefix}-${previousId}`;
    idMap.set(previousId, nextId);
    cell.setAttribute('id', nextId);
  });

  cells.forEach((cell) => {
    ['parent', 'source', 'target'].forEach((attribute) => {
      const current = cell.getAttribute(attribute);
      if (!current) {
        return;
      }

      const reminted = idMap.get(current);
      if (reminted) {
        cell.setAttribute(attribute, reminted);
      }
    });
  });

  return new XMLSerializer().serializeToString(document);
}

function defaultPrefixFactory() {
  exportCounter += 1;
  return `s2d-${Date.now().toString(36)}-${exportCounter.toString(36)}`;
}
