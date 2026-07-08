import DOMPurify from 'dompurify';

export const MAX_SVG_BYTES = 5 * 1024 * 1024;

export const sanitizeInput = (input: string): string => {
  // We use DOMPurify to sanitize HTML that might be inside diagram labels,
  // but we must not strip out the actual syntax of Mermaid or PlantUML.
  // Since both formats are plain text, DOMPurify might aggressively strip things like <T> generics or <<stereotype>>.
  // Thus, for the source code, we only want to ensure no malicious scripts can be parsed if the parser evaluates it.
  // Actually, @mermaid-js/parser and our custom PlantUML parser are safe against XSS because they don't execute JS.
  // The main risk is the *rendered* SVG or HTML labels.
  
  // So we just return the input for the source code, and sanitize the output.
  // We will remove script tags explicitly just in case.
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

export const sanitizeSvg = (svgString: string): string => {
  if (new TextEncoder().encode(svgString).byteLength > MAX_SVG_BYTES) {
    throw new Error('SVG response exceeded the 5 MB safety limit.');
  }
  if (!/<svg(?:\s|>)/i.test(svgString)) {
    throw new Error('Renderer did not return SVG markup.');
  }
  validateSvgXml(svgString, 'Renderer returned malformed SVG markup.');

  // Sanitize to a DOM and serialize the SVG as XML. Asking DOMPurify for a
  // string uses HTML serialization, which turns non-breaking spaces into the
  // HTML-only &nbsp; entity. That entity is invalid when the result is later
  // parsed as image/svg+xml.
  const sanitizedDom = DOMPurify.sanitize(svgString, {
    RETURN_DOM: true,
    // We use the default profile which includes html and svg.
    // This allows Mermaid to render HTML inside <foreignObject> tags (flowcharts, class diagrams).
    ADD_TAGS: ['style', 'foreignObject', 'div', 'span', 'b', 'i', 'br', 'hr', 'p', 'strong', 'em', 'u'], // Allow safe HTML in foreignObject
    ADD_ATTR: ['xmlns', 'viewBox', 'style', 'class', 'transform', 'marker-end', 'marker-start', 'd', 'points', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width', 'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'id', 'color', 'background-color'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['on*'], // Forbid all inline event handlers
    HTML_INTEGRATION_POINTS: { foreignobject: true }, // Crucial for DOMPurify >= 3.1.7 to preserve HTML inside foreignObject
  });

  const sanitizedNode = sanitizedDom as Node & Partial<ParentNode>;
  const svgElement = sanitizedNode instanceof Element && sanitizedNode.tagName.toLowerCase() === 'svg'
    ? sanitizedNode
    : sanitizedNode.querySelector?.('svg');
  if (!svgElement) {
    throw new Error('SVG markup was rejected by the sanitizer.');
  }

  const sanitized = new XMLSerializer().serializeToString(svgElement);
  validateSvgXml(sanitized, 'Sanitized SVG markup was malformed.');
  return sanitized;
};

function validateSvgXml(svg: string, message: string) {
  if (typeof DOMParser === 'undefined') {
    return;
  }

  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (document.querySelector('parsererror') || document.documentElement.tagName.toLowerCase() !== 'svg') {
    throw new Error(message);
  }
}
