import { createDrawioHtmlFragment, parseDrawioDocument, type DrawioDocument } from './document';
import { remintDrawioXmlIds } from './remint';

export interface DrawioTransfer extends DrawioDocument {
  htmlFragment: string;
}

export function prepareDrawioTransfer(drawioXml: string): DrawioTransfer | null {
  const remintedXml = remintDrawioXmlIds(drawioXml);
  const document = parseDrawioDocument(remintedXml);
  if (!document) {
    return null;
  }

  return {
    ...document,
    htmlFragment: createDrawioHtmlFragment(document.graphModelXml),
  };
}

export async function writeDrawioTransferToClipboard(transfer: DrawioTransfer) {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      const item = new ClipboardItem({
        'text/plain': new Blob([transfer.graphModelXml], { type: 'text/plain' }),
        'text/html': new Blob([transfer.htmlFragment], { type: 'text/html' }),
      });
      await navigator.clipboard.write([item]);
      return;
    } catch {
      // WebKit and some desktop webviews expose ClipboardItem but reject
      // multi-MIME writes. The plain graph model remains directly pasteable.
    }
  }

  await navigator.clipboard.writeText(transfer.graphModelXml);
}
