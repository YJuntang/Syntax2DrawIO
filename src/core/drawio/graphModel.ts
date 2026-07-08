import { parseDrawioDocument } from './document';

export function extractDrawioGraphModelXml(drawioXml: string): string | null {
  return parseDrawioDocument(drawioXml)?.graphModelXml || null;
}
