// @vitest-environment jsdom

import { expect, test } from 'vitest';
import { DrawioXmlBuilder } from './builder';
import { getDrawioCellIds, getDrawioEdges, parseDrawioXml } from './testUtils';

test('builder keeps XML well formed for unsafe ids and style values', () => {
  const builder = new DrawioXmlBuilder();
  builder.addVertex('node "A" & <B>', 'Label & <safe>', 0, 0, 100, 60, 'rounded=1;fillColor=#fff;');
  builder.addVertex('node-2', 'Target', 180, 0, 100, 60, 'rounded=1;');
  builder.addEdge('edge "1"', 'node "A" & <B>', 'node-2', 'go', 'endArrow=block;html=1;');

  const xml = builder.toXml();

  expect(() => parseDrawioXml(xml)).not.toThrow();
  expect(new Set(getDrawioCellIds(xml)).size).toBe(getDrawioCellIds(xml).length);
  expect(getDrawioEdges(xml)).toHaveLength(1);
});

test('builder normalizes invalid geometry instead of emitting NaN or Infinity', () => {
  const builder = new DrawioXmlBuilder();
  builder.addVertex('bad-geometry', 'Bad', Number.NaN, Number.POSITIVE_INFINITY, 100, 60, 'rounded=1;');

  const xml = builder.toXml();

  expect(xml).not.toMatch(/NaN|Infinity/);
  expect(() => parseDrawioXml(xml)).not.toThrow();
});
