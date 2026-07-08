import { expect, test } from 'vitest';
import { inflate } from 'pako';
import {
  DEFAULT_PNG_EXPORT_SETTINGS,
  calculatePngExportDimensions,
  embedDrawioXmlInPng,
  getPngExportDescription,
  parseSvgDimensions,
  readPngZtxtChunks,
} from './png';

const ONE_PIXEL_PNG = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lw0KxAAAAABJRU5ErkJggg==',
  'base64'
));

test('calculates scale, width, max dimension, and safe-size limits', () => {
  expect(calculatePngExportDimensions(320, 200, {
    ...DEFAULT_PNG_EXPORT_SETTINGS,
    scalePercent: 200,
    border: 10,
  })).toMatchObject({
    contentWidth: 640,
    contentHeight: 400,
    outputWidth: 660,
    outputHeight: 420,
    tooLarge: false,
  });

  expect(calculatePngExportDimensions(400, 200, {
    ...DEFAULT_PNG_EXPORT_SETTINGS,
    sizingMode: 'width',
    targetWidth: 800,
  })).toMatchObject({
    contentWidth: 800,
    contentHeight: 400,
  });

  expect(calculatePngExportDimensions(10, 10, {
    ...DEFAULT_PNG_EXPORT_SETTINGS,
    sizingMode: 'width',
    targetWidth: 12000,
  }).tooLarge).toBe(true);
});

test('describes PNG settings with computed output dimensions', () => {
  expect(getPngExportDescription({
    ...DEFAULT_PNG_EXPORT_SETTINGS,
    scalePercent: 150,
    background: 'transparent',
  }, { width: 200, height: 100 })).toBe('300x150, transparent, editable');
});

test('parses SVG dimensions from width/height or viewBox', () => {
  expect(parseSvgDimensions('<svg width="640px" height="480px"></svg>')).toEqual({ width: 640, height: 480 });
  expect(parseSvgDimensions('<svg viewBox="0 0 320 180"></svg>')).toEqual({ width: 320, height: 180 });
});

test('embeds draw.io XML into a PNG zTXt mxfile chunk', () => {
  const drawioXml = '<mxfile><diagram><mxGraphModel><root><mxCell id="0"/></root></mxGraphModel></diagram></mxfile>';
  const embedded = embedDrawioXmlInPng(ONE_PIXEL_PNG, drawioXml);
  const chunks = readPngZtxtChunks(embedded).filter((chunk) => chunk.keyword === 'mxfile');

  expect(chunks).toHaveLength(1);
  expect(new TextDecoder().decode(inflate(chunks[0].compressedText))).toBe(drawioXml);
});

test('replaces an existing draw.io PNG metadata chunk', () => {
  const first = embedDrawioXmlInPng(ONE_PIXEL_PNG, '<mxfile>old</mxfile>');
  const second = embedDrawioXmlInPng(first, '<mxfile>new</mxfile>');
  const chunks = readPngZtxtChunks(second).filter((chunk) => chunk.keyword === 'mxfile');

  expect(chunks).toHaveLength(1);
  expect(new TextDecoder().decode(inflate(chunks[0].compressedText))).toBe('<mxfile>new</mxfile>');
});
