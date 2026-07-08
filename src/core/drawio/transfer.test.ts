// @vitest-environment jsdom

import { afterEach, expect, test, vi } from 'vitest';
import { DrawioXmlBuilder } from './builder';
import { prepareDrawioTransfer, writeDrawioTransferToClipboard } from './transfer';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('prepares separate file and insertion payloads for draw.io', () => {
  const builder = new DrawioXmlBuilder();
  builder.addVertex('User', 'User', 20, 20, 160, 80, 'rounded=0;whiteSpace=wrap;html=1;');

  const transfer = prepareDrawioTransfer(builder.toXml());

  expect(transfer).not.toBeNull();
  expect(transfer!.fileXml).toContain('<mxfile');
  expect(transfer!.graphModelXml).toMatch(/^<mxGraphModel\b/);
  expect(transfer!.graphModelXml).not.toContain('<mxfile');
  expect(transfer!.htmlFragment).toContain('&lt;mxGraphModel');
  expect(transfer!.htmlFragment).not.toContain('data:');
  expect(transfer!.graphModelXml).toContain('vertex="1"');
});

test('rejects empty draw.io documents before clipboard or drag transfer', () => {
  expect(prepareDrawioTransfer(
    '<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>'
  )).toBeNull();
});

test('writes rich Draw.io clipboard MIME without URL or file payloads', async () => {
  const builder = new DrawioXmlBuilder();
  builder.addVertex('UseCase', 'Checkout', 20, 20, 180, 80, 'ellipse;whiteSpace=wrap;html=1;');
  const transfer = prepareDrawioTransfer(builder.toXml())!;
  const write = vi.fn().mockResolvedValue(undefined);
  let clipboardPayload: Record<string, Blob> | undefined;

  class ClipboardItemMock {
    constructor(payload: Record<string, Blob>) {
      clipboardPayload = payload;
    }
  }

  vi.stubGlobal('ClipboardItem', ClipboardItemMock);
  vi.stubGlobal('navigator', {
    clipboard: {
      write,
      writeText: vi.fn(),
    },
  });

  await writeDrawioTransferToClipboard(transfer);

  expect(write).toHaveBeenCalledTimes(1);
  expect(Object.keys(clipboardPayload || {}).sort()).toEqual(['text/html', 'text/plain']);
  expect(await clipboardPayload!['text/plain'].text()).toMatch(/^<mxGraphModel\b/);
  expect(await clipboardPayload!['text/html'].text()).toContain('&lt;mxGraphModel');
  expect(JSON.stringify(Object.keys(clipboardPayload || {}))).not.toMatch(/uri|file/i);
});

test('falls back to plain graph-model text when rich clipboard writes fail', async () => {
  const builder = new DrawioXmlBuilder();
  builder.addVertex('Actor', 'Customer', 20, 20, 100, 100, 'shape=umlActor;html=1;');
  const transfer = prepareDrawioTransfer(builder.toXml())!;
  const writeText = vi.fn().mockResolvedValue(undefined);

  vi.stubGlobal('ClipboardItem', class ClipboardItemMock {
    constructor(_payload: Record<string, Blob>) {}
  });
  vi.stubGlobal('navigator', {
    clipboard: {
      write: vi.fn().mockRejectedValue(new Error('rich clipboard unavailable')),
      writeText,
    },
  });

  await writeDrawioTransferToClipboard(transfer);

  expect(writeText).toHaveBeenCalledWith(transfer.graphModelXml);
  expect(writeText.mock.calls[0][0]).not.toContain('<mxfile');
});
