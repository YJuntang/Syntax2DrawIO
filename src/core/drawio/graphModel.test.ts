// @vitest-environment jsdom

import { expect, test } from 'vitest';
import { extractDrawioGraphModelXml } from './graphModel';

test('extracts the first graph model from a drawio file', () => {
  const xml = `<mxfile>
  <diagram id="a" name="Page-1">
    <mxGraphModel dx="1" dy="2"><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="node" vertex="1" parent="1"><mxGeometry width="80" height="40" as="geometry"/></mxCell></root></mxGraphModel>
  </diagram>
</mxfile>`;

  const graphModel = extractDrawioGraphModelXml(xml);

  expect(graphModel).toContain('<mxGraphModel');
  expect(graphModel).toContain('id="node"');
  expect(graphModel).not.toContain('<mxfile');
});

test('rejects empty and malformed graph models', () => {
  expect(extractDrawioGraphModelXml('')).toBeNull();
  expect(extractDrawioGraphModelXml('<mxfile><diagram>')).toBeNull();
  expect(extractDrawioGraphModelXml('<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>')).toBeNull();
});
