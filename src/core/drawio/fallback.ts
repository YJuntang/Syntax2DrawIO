import { DrawioXmlBuilder } from './builder';
import { DrawioConversionResult } from './output';
import { EMPTY_SUPPORT_ANALYSIS } from './support';
import { XMLSerializer } from '@xmldom/xmldom';
import { parseXml } from './document';

export function generateImageFallbackXml(svg: string): DrawioConversionResult {
  const builder = new DrawioXmlBuilder();
  
  if (!svg) {
    return {
      drawioXml: builder.toXml(),
      drawioMode: 'visual-full',
      supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
    };
  }

  // Calculate approximate width/height by parsing SVG
  let width = 800;
  let height = 600;
  
  const widthMatch = svg.match(/width="([\d.]+)"/);
  const heightMatch = svg.match(/height="([\d.]+)"/);
  const viewBoxMatch = svg.match(/viewBox="([\d.\s]+)"/);
  
  if (widthMatch) width = parseFloat(widthMatch[1]);
  if (heightMatch) height = parseFloat(heightMatch[1]);
  
  if (!widthMatch && viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/\s+/);
    if (parts.length === 4) {
      width = parseFloat(parts[2]);
      height = parseFloat(parts[3]);
    }
  }

  // Ensure reasonable minimums
  if (isNaN(width) || width < 10) width = 800;
  if (isNaN(height) || height < 10) height = 600;

  // Ensure SVG has XML namespace
  let safeSvg = svg;
  if (!safeSvg.includes('xmlns=')) {
    safeSvg = safeSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // URL-encode the SVG and use comma data URI format instead of base64.
  // This avoids semicolons which would break Draw.io's style string parser!
  const encodedSvg = encodeURIComponent(safeSvg);
  
  // Create an image shape containing the SVG
  const style = `shape=image;image=data:image/svg+xml,${encodedSvg};html=1;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=1;aspect=fixed;`;
  
  builder.addVertex(
    builder.generateId(),
    '',
    0,
    0,
    width,
    height,
    style
  );

  return {
    drawioXml: builder.toXml(),
    drawioMode: 'visual-full',
    supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
  };
}

export function generateUrlFallbackXml(url: string, width = 800, height = 600): DrawioConversionResult {
  const builder = new DrawioXmlBuilder();
  
  if (!url) {
    return {
      drawioXml: builder.toXml(),
      drawioMode: 'fallback-url',
      supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
    };
  }

  // Escape XML characters so the URL doesn't break the XML attribute
  const escapedUrl = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // Create an image shape containing the URL
  const style = `shape=image;image=${escapedUrl};html=1;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=1;aspect=fixed;`;
  
  builder.addVertex(
    builder.generateId(),
    '',
    0,
    0,
    width,
    height,
    style
  );

  return {
    drawioXml: builder.toXml(),
    drawioMode: 'fallback-url',
    supportAnalysis: EMPTY_SUPPORT_ANALYSIS,
  };
}

export function addHiddenVisualReferenceLayer(drawioXml: string, svg: string) {
  if (!drawioXml || !svg) {
    return drawioXml;
  }

  const { document, errors } = parseXml(drawioXml);
  const root = document.getElementsByTagName('root').item(0);
  if (!root || errors.length > 0) {
    return drawioXml;
  }

  const { width, height } = readSvgDimensions(svg);
  let safeSvg = svg;
  if (!safeSvg.includes('xmlns=')) {
    safeSvg = safeSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const style = [
    'shape=image',
    `image=data:image/svg+xml,${encodeURIComponent(safeSvg)}`,
    'html=1',
    'imageAspect=1',
    'aspect=fixed',
    'opacity=0',
    'noLabel=1',
    'locked=1',
    'movable=0',
    'resizable=0',
    'rotatable=0',
    'deletable=0',
  ].join(';') + ';';

  const image = document.createElement('mxCell');
  image.setAttribute('id', 's2d-original-reference');
  image.setAttribute('value', 'Original visual reference');
  image.setAttribute('style', style);
  image.setAttribute('vertex', '1');
  image.setAttribute('parent', '1');
  image.setAttribute('visible', '0');
  image.setAttribute('locked', '1');

  const geometry = document.createElement('mxGeometry');
  geometry.setAttribute('x', '0');
  geometry.setAttribute('y', '0');
  geometry.setAttribute('width', String(width));
  geometry.setAttribute('height', String(height));
  geometry.setAttribute('as', 'geometry');
  image.appendChild(geometry);
  root.appendChild(image);

  return new XMLSerializer().serializeToString(document.documentElement);
}

function readSvgDimensions(svg: string) {
  const widthMatch = svg.match(/\bwidth="([\d.]+)(?:px)?"/i);
  const heightMatch = svg.match(/\bheight="([\d.]+)(?:px)?"/i);
  const viewBoxMatch = svg.match(/\bviewBox="[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)"/i);
  const width = Number(widthMatch?.[1] || viewBoxMatch?.[1] || 800);
  const height = Number(heightMatch?.[1] || viewBoxMatch?.[2] || 600);
  return {
    width: Number.isFinite(width) && width >= 10 ? width : 800,
    height: Number.isFinite(height) && height >= 10 ? height : 600,
  };
}
