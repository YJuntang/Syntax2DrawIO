export const DRAWIO_XML_PREFIX = `<mxfile host="Syntax2DrawIO" modified="${new Date().toISOString()}" version="22.0.0">
  <diagram id="diagram" name="Page-1">
    <mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>`;

export const DRAWIO_XML_SUFFIX = `      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

export const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '\n': '&#xa;',
};

export function escapeXml(str: string): string {
  if (!str) return '';
  return str.replace(/[&<>"'\n]/g, (char) => XML_ENTITIES[char]);
}
