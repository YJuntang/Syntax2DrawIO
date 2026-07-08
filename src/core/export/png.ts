import { deflate } from 'pako';

export type PngBackgroundMode = 'white' | 'transparent';
export type PngSizingMode = 'scale' | 'width' | 'max-dimension';

export interface PngExportSettings {
  sizingMode: PngSizingMode;
  scalePercent: number;
  targetWidth: number;
  maxDimension: number;
  border: number;
  background: PngBackgroundMode;
  embedDrawioXml: boolean;
}

export interface PngExportDimensions {
  contentWidth: number;
  contentHeight: number;
  outputWidth: number;
  outputHeight: number;
  scale: number;
  tooLarge: boolean;
}

export const DEFAULT_PNG_EXPORT_SETTINGS: PngExportSettings = {
  sizingMode: 'scale',
  scalePercent: 200,
  targetWidth: 1200,
  maxDimension: 2400,
  border: 0,
  background: 'white',
  embedDrawioXml: true,
};

export const PNG_EXPORT_LIMITS = {
  minScalePercent: 25,
  maxScalePercent: 600,
  minWidth: 64,
  maxWidth: 12000,
  minMaxDimension: 64,
  maxMaxDimension: 12000,
  minBorder: 0,
  maxBorder: 512,
  maxCanvasSide: 12000,
  maxCanvasPixels: 72_000_000,
};

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const ZTXT_TYPE = asciiBytes('zTXt');
const MXFILE_KEYWORD = asciiBytes('mxfile');
const CRC_TABLE = makeCrcTable();

export function normalizePngExportSettings(settings?: Partial<PngExportSettings> | null): PngExportSettings {
  const merged = { ...DEFAULT_PNG_EXPORT_SETTINGS, ...(settings || {}) };
  const sizingMode: PngSizingMode = ['scale', 'width', 'max-dimension'].includes(merged.sizingMode)
    ? merged.sizingMode
    : DEFAULT_PNG_EXPORT_SETTINGS.sizingMode;

  return {
    sizingMode,
    scalePercent: clampNumber(merged.scalePercent, PNG_EXPORT_LIMITS.minScalePercent, PNG_EXPORT_LIMITS.maxScalePercent),
    targetWidth: clampInteger(merged.targetWidth, PNG_EXPORT_LIMITS.minWidth, PNG_EXPORT_LIMITS.maxWidth),
    maxDimension: clampInteger(merged.maxDimension, PNG_EXPORT_LIMITS.minMaxDimension, PNG_EXPORT_LIMITS.maxMaxDimension),
    border: clampInteger(merged.border, PNG_EXPORT_LIMITS.minBorder, PNG_EXPORT_LIMITS.maxBorder),
    background: merged.background === 'transparent' ? 'transparent' : 'white',
    embedDrawioXml: merged.embedDrawioXml !== false,
  };
}

export function clampPngScalePercent(scalePercent: number) {
  return clampNumber(scalePercent, PNG_EXPORT_LIMITS.minScalePercent, PNG_EXPORT_LIMITS.maxScalePercent);
}

export function calculatePngExportDimensions(
  sourceWidth: number,
  sourceHeight: number,
  settings: PngExportSettings
): PngExportDimensions {
  const safeWidth = Number.isFinite(sourceWidth) && sourceWidth > 0 ? sourceWidth : 1;
  const safeHeight = Number.isFinite(sourceHeight) && sourceHeight > 0 ? sourceHeight : 1;
  const normalized = normalizePngExportSettings(settings);
  const scale = resolveScale(safeWidth, safeHeight, normalized);
  const contentWidth = Math.max(1, Math.round(safeWidth * scale));
  const contentHeight = Math.max(1, Math.round(safeHeight * scale));
  const outputWidth = Math.max(1, contentWidth + normalized.border * 2);
  const outputHeight = Math.max(1, contentHeight + normalized.border * 2);

  return {
    contentWidth,
    contentHeight,
    outputWidth,
    outputHeight,
    scale,
    tooLarge: outputWidth > PNG_EXPORT_LIMITS.maxCanvasSide
      || outputHeight > PNG_EXPORT_LIMITS.maxCanvasSide
      || outputWidth * outputHeight > PNG_EXPORT_LIMITS.maxCanvasPixels,
  };
}

export function parseSvgDimensions(svg: string): { width: number; height: number } | null {
  const svgTag = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!svgTag) return null;

  const width = readSvgLength(svgTag, 'width');
  const height = readSvgLength(svgTag, 'height');
  if (width && height) {
    return { width, height };
  }

  const viewBox = svgTag.match(/\bviewBox=(["'])(.*?)\1/i)?.[2];
  const parts = viewBox?.trim().split(/[\s,]+/).map(Number) || [];
  if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
    return { width: parts[2], height: parts[3] };
  }

  return null;
}

export function getPngExportDescription(
  settings: PngExportSettings,
  sourceDimensions?: { width: number; height: number } | null
) {
  const normalized = normalizePngExportSettings(settings);
  const sizing = getPngSizingLabel(normalized);
  const background = normalized.background === 'transparent' ? 'transparent' : 'white';
  const editable = normalized.embedDrawioXml ? ', editable' : '';

  if (!sourceDimensions) {
    return `${sizing}, ${background}${editable}`;
  }

  const dimensions = calculatePngExportDimensions(sourceDimensions.width, sourceDimensions.height, normalized);
  return `${dimensions.outputWidth}x${dimensions.outputHeight}, ${background}${editable}`;
}

export function getPngSizingLabel(settings: PngExportSettings) {
  const normalized = normalizePngExportSettings(settings);

  if (normalized.sizingMode === 'width') {
    return `${normalized.targetWidth}px wide`;
  }

  if (normalized.sizingMode === 'max-dimension') {
    return `${normalized.maxDimension}px max`;
  }

  return `${normalized.scalePercent}%`;
}

export function embedDrawioXmlInPng(pngBytes: Uint8Array, drawioXml: string): Uint8Array {
  if (!isPng(pngBytes)) {
    throw new Error('Invalid PNG data.');
  }

  const compressedXml = deflate(utf8Bytes(drawioXml));
  const data = concatBytes([MXFILE_KEYWORD, new Uint8Array([0, 0]), compressedXml]);
  const ztxtChunk = makePngChunk(ZTXT_TYPE, data);
  const chunks: Uint8Array[] = [pngBytes.slice(0, PNG_SIGNATURE.length)];
  let offset = PNG_SIGNATURE.length;
  let inserted = false;

  while (offset + 12 <= pngBytes.length) {
    const length = readUint32(pngBytes, offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > pngBytes.length) {
      throw new Error('Invalid PNG chunk length.');
    }

    const type = chunkType(pngBytes, offset);
    const chunk = pngBytes.slice(offset, chunkEnd);

    if (type === 'IEND') {
      chunks.push(ztxtChunk, chunk);
      inserted = true;
      break;
    }

    if (!(type === 'zTXt' && hasKeyword(pngBytes, offset + 8, length, MXFILE_KEYWORD))) {
      chunks.push(chunk);
    }

    offset = chunkEnd;
  }

  if (!inserted) {
    throw new Error('PNG IEND chunk was not found.');
  }

  return concatBytes(chunks);
}

export function readPngZtxtChunks(pngBytes: Uint8Array) {
  const chunks: Array<{ keyword: string; compressedText: Uint8Array }> = [];
  if (!isPng(pngBytes)) return chunks;

  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= pngBytes.length) {
    const length = readUint32(pngBytes, offset);
    const dataStart = offset + 8;
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > pngBytes.length) break;

    if (chunkType(pngBytes, offset) === 'zTXt') {
      const data = pngBytes.slice(dataStart, dataStart + length);
      const zeroIndex = data.indexOf(0);
      if (zeroIndex > 0 && data[zeroIndex + 1] === 0) {
        chunks.push({
          keyword: asciiString(data.slice(0, zeroIndex)),
          compressedText: data.slice(zeroIndex + 2),
        });
      }
    }

    if (chunkType(pngBytes, offset) === 'IEND') break;
    offset = chunkEnd;
  }

  return chunks;
}

function resolveScale(width: number, height: number, settings: PngExportSettings) {
  if (settings.sizingMode === 'width') {
    return Math.max(0.01, settings.targetWidth / width);
  }

  if (settings.sizingMode === 'max-dimension') {
    return Math.max(0.01, settings.maxDimension / Math.max(width, height));
  }

  return settings.scalePercent / 100;
}

function readSvgLength(svgTag: string, attribute: 'width' | 'height') {
  const raw = svgTag.match(new RegExp(`\\b${attribute}=(["'])(.*?)\\1`, 'i'))?.[2];
  if (!raw || raw.endsWith('%')) return null;

  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function isPng(bytes: Uint8Array) {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function makePngChunk(type: Uint8Array, data: Uint8Array) {
  const chunk = new Uint8Array(12 + data.length);
  writeUint32(chunk, 0, data.length);
  chunk.set(type, 4);
  chunk.set(data, 8);
  writeUint32(chunk, 8 + data.length, crc32(concatBytes([type, data])));
  return chunk;
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] * 0x1000000)
    + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  ) >>> 0;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function chunkType(bytes: Uint8Array, offset: number) {
  return asciiString(bytes.slice(offset + 4, offset + 8));
}

function hasKeyword(bytes: Uint8Array, dataOffset: number, length: number, keyword: Uint8Array) {
  if (length <= keyword.length || bytes[dataOffset + keyword.length] !== 0) {
    return false;
  }

  return keyword.every((byte, index) => bytes[dataOffset + index] === byte);
}

function concatBytes(parts: Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function clampInteger(value: number, min: number, max: number) {
  return Math.round(clampNumber(value, min, max));
}

function utf8Bytes(value: string) {
  return new TextEncoder().encode(value);
}

function asciiBytes(value: string) {
  return Uint8Array.from(value, (char) => char.charCodeAt(0));
}

function asciiString(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < table.length; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
