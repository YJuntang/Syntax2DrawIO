// @vitest-environment jsdom

import { expect, test } from 'vitest';
import { remintDrawioXmlIds } from './remint';

const SOURCE_XML = `
<mxfile host="Syntax2DrawIO">
  <diagram id="diagram" name="Page-1">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="container" value="Container" vertex="1" parent="1">
          <mxGeometry x="0" y="0" width="300" height="200" as="geometry"/>
        </mxCell>
        <mxCell id="node-a" value="A" vertex="1" parent="container">
          <mxGeometry x="10" y="10" width="100" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="node-b" value="B" vertex="1" parent="1">
          <mxGeometry x="180" y="10" width="100" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="edge-0" edge="1" parent="1" source="node-a" target="node-b">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`.trim();

test('remintDrawioXmlIds produces fresh ids for repeated exports', () => {
  const first = remintDrawioXmlIds(SOURCE_XML, () => 'export-a');
  const second = remintDrawioXmlIds(SOURCE_XML, () => 'export-b');

  expect(first).toContain('id="export-a-node-a"');
  expect(first).toContain('parent="export-a-container"');
  expect(first).toContain('source="export-a-node-a"');
  expect(first).toContain('target="export-a-node-b"');
  expect(first).toContain('id="export-a-diagram-0"');
  expect(first).not.toContain('id="node-a"');

  expect(second).toContain('id="export-b-node-a"');
  expect(second).not.toEqual(first);
});

test('remintDrawioXmlIds preserves root cell ids', () => {
  const result = remintDrawioXmlIds(SOURCE_XML, () => 'export-root');

  expect(result).toContain('<mxCell id="0"/>');
  expect(result).toContain('<mxCell id="1" parent="0"/>');
});
