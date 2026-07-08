import { isTauri } from '@tauri-apps/api/core';
import { requestConfirmation } from './confirmation';

const SKIP_REPLACE_UNSAVED_SOURCE_CONFIRM_KEY = 'syntax2drawio.skipReplaceUnsavedSourceConfirm';

const DIAGRAM_FILE_FILTERS = [
  {
    name: 'Diagram Source',
    extensions: ['txt', 'md', 'mermaid', 'mmd', 'puml', 'plantuml'],
  },
];

const DRAWIO_FILTERS = [
  {
    name: 'Draw.io',
    extensions: ['drawio'],
  },
];

const SVG_FILTERS = [
  {
    name: 'Editable SVG',
    extensions: ['svg'],
  },
];

const PNG_FILTERS = [
  {
    name: 'PNG Image',
    extensions: ['png'],
  },
];

export type OpenedTextFile = {
  path: string;
  name: string;
  content: string;
};

export type SaveFileResult = {
  path: string | null;
  saved: boolean;
  error?: string;
};

export type ExportKind = 'drawio' | 'svg' | 'png';
export type NormalizedDesktopPath = {
  target: string | URL;
  displayPath: string;
};

export function isDesktopApp() {
  return isTauri();
}

export function getPlatformCapabilities() {
  const desktop = isDesktopApp();
  const macos = typeof navigator !== 'undefined' && /Mac|Darwin/.test(navigator.userAgent);
  return {
    isDesktop: desktop,
    isMacOS: macos,
    usesNativeDialogs: desktop,
    supportsNativeCloseGuard: desktop,
    supportsExternalUri: false,
    supportsDragDropPaths: desktop,
    supportsEditableDragOut: desktop && macos,
  };
}

export async function openTextFileDesktop(): Promise<OpenedTextFile | null> {
  if (!isDesktopApp()) {
    return null;
  }

  const [{ open }, { readTextFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);

  const selected = await open({
    title: 'Open Diagram Source',
    multiple: false,
    directory: false,
    filters: DIAGRAM_FILE_FILTERS,
  });

  if (typeof selected !== 'string') {
    return null;
  }

  const normalized = normalizeDesktopPath(selected);
  const content = await readTextFile(normalized.target);
  return {
    path: normalized.displayPath,
    name: basename(normalized.displayPath),
    content,
  };
}

export async function readTextFileDesktop(path: string): Promise<OpenedTextFile> {
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const normalized = normalizeDesktopPath(path);
  const content = await readTextFile(normalized.target);
  return {
    path: normalized.displayPath,
    name: basename(normalized.displayPath),
    content,
  };
}

export async function saveTextFileDesktop(
  data: string,
  options: {
    defaultPath?: string;
    title: string;
    filters: { name: string; extensions: string[] }[];
  }
): Promise<SaveFileResult> {
  if (!isDesktopApp()) {
    return { path: null, saved: false };
  }

  const [{ save }, { exists, writeTextFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);

  const targetPath = await save({
    title: options.title,
    defaultPath: options.defaultPath,
    filters: options.filters,
  });

  if (!targetPath) {
    return { path: null, saved: false };
  }

  const normalized = normalizeDesktopPath(targetPath);

  try {
    await writeTextFile(normalized.target, data);
    const didSave = await exists(normalized.target);

    if (!didSave) {
      return {
        path: normalized.displayPath,
        saved: false,
        error: 'Save completed, but the file was not created.',
      };
    }

    return { path: normalized.displayPath, saved: true };
  } catch (error) {
    return {
      path: normalized.displayPath,
      saved: false,
      error: getDesktopSaveErrorMessage(error, 'Failed to save file.'),
    };
  }
}

export async function saveBinaryFileDesktop(
  data: Uint8Array,
  options: {
    defaultPath?: string;
    title: string;
    filters: { name: string; extensions: string[] }[];
  }
): Promise<SaveFileResult> {
  if (!isDesktopApp()) {
    return { path: null, saved: false };
  }

  const [{ save }, { exists, writeFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);

  const targetPath = await save({
    title: options.title,
    defaultPath: options.defaultPath,
    filters: options.filters,
  });

  if (!targetPath) {
    return { path: null, saved: false };
  }

  const normalized = normalizeDesktopPath(targetPath);

  try {
    await writeFile(normalized.target, data);
    const didSave = await exists(normalized.target);

    if (!didSave) {
      return {
        path: normalized.displayPath,
        saved: false,
        error: 'Save completed, but the file was not created.',
      };
    }

    return { path: normalized.displayPath, saved: true };
  } catch (error) {
    return {
      path: normalized.displayPath,
      saved: false,
      error: getDesktopSaveErrorMessage(error, 'Failed to save file.'),
    };
  }
}

export async function openExternalUrl(url: string) {
  if (!isAllowedExternalUrl(url)) {
    throw new Error('Blocked unsafe external URL');
  }

  if (isDesktopApp()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function confirmUnsavedChanges(options: {
  message?: string;
  title?: string;
  okLabel?: string;
  cancelLabel?: string;
  tone?: 'warning' | 'danger';
  dontAskAgainLabel?: string;
  skipConfirmationStorageKey?: string;
} = {}) {
  const message = options.message ?? 'You have unsaved source changes. Close the app anyway?';
  const title = options.title ?? 'Unsaved Changes';
  const okLabel = options.okLabel ?? 'Close Anyway';
  const cancelLabel = options.cancelLabel ?? 'Keep Editing';

  if (isDesktopApp()) {
    const { confirm } = await import('@tauri-apps/plugin-dialog');
    return confirm(message, {
      title,
      kind: 'warning',
      okLabel,
      cancelLabel,
    });
  }

  if (options.skipConfirmationStorageKey && getStoredBoolean(options.skipConfirmationStorageKey)) {
    return true;
  }

  const customConfirmation = await requestConfirmation({
    title,
    message,
    confirmLabel: okLabel,
    cancelLabel,
    tone: options.tone ?? 'warning',
    dontAskAgainLabel: options.dontAskAgainLabel,
  });
  if (customConfirmation !== null) {
    if (
      customConfirmation.confirmed
      && customConfirmation.dontAskAgain
      && options.skipConfirmationStorageKey
    ) {
      setStoredBoolean(options.skipConfirmationStorageKey, true);
    }

    return customConfirmation.confirmed;
  }

  return window.confirm(message);
}

export async function confirmReplaceUnsavedSource() {
  return confirmUnsavedChanges({
    title: 'Replace current diagram?',
    message: 'You have unsaved source changes. Replacing the diagram will discard them.',
    okLabel: 'Replace diagram',
    cancelLabel: 'Keep Editing',
    tone: 'danger',
    dontAskAgainLabel: "Don't ask again",
    skipConfirmationStorageKey: SKIP_REPLACE_UNSAVED_SOURCE_CONFIRM_KEY,
  });
}

function getStoredBoolean(key: string) {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function setStoredBoolean(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? 'true' : 'false');
  } catch {
    // Ignore storage failures; the confirmation can still proceed normally.
  }
}

export function getExportSaveLabel(kind: ExportKind) {
  if (!isDesktopApp()) {
    switch (kind) {
      case 'drawio':
        return '.drawio (Editable)';
      case 'svg':
        return '.drawio.svg (Editable SVG)';
      case 'png':
        return '.png (Image)';
    }
  }

  switch (kind) {
    case 'drawio':
      return 'Save .drawio';
    case 'svg':
      return 'Save As .drawio.svg';
    case 'png':
      return 'Save As .png';
  }
}

export function getPrimaryExportActionLabel() {
  return 'Export';
}

export function getSourceSaveLabel() {
  return isDesktopApp() ? 'Save Source' : 'Download Source';
}

export function getImportActionLabel() {
  return isDesktopApp() ? 'Open File' : 'Import File';
}

export function getDefaultExportPath(filePath: string | null, kind: ExportKind) {
  const base = stripExtension(filePath ? basename(filePath) : 'diagram');
  switch (kind) {
    case 'drawio':
      return `${base}.drawio`;
    case 'svg':
      return `${base}.drawio.svg`;
    case 'png':
      return `${base}.png`;
  }
}

export function getDefaultSourcePath(filePath: string | null, detectedType?: 'mermaid' | 'plantuml' | null) {
  if (filePath) {
    return filePath;
  }

  switch (detectedType) {
    case 'plantuml':
      return 'diagram.puml';
    case 'mermaid':
      return 'diagram.mmd';
    default:
      return 'diagram.txt';
  }
}

export function getDocumentDisplayName(filePath: string | null) {
  return filePath ? basename(filePath) : 'Untitled Diagram';
}

export function getDrawioFilters() {
  return DRAWIO_FILTERS;
}

export function getSourceFilters() {
  return DIAGRAM_FILE_FILTERS;
}

export function getSvgFilters() {
  return SVG_FILTERS;
}

export function getPngFilters() {
  return PNG_FILTERS;
}

export function normalizeDesktopPath(path: string): NormalizedDesktopPath {
  if (path.startsWith('file://')) {
    try {
      const url = new URL(path);
      if (url.protocol === 'file:') {
        return {
          target: url,
          displayPath: fileUrlToDisplayPath(url),
        };
      }
    } catch {
      return {
        target: path,
        displayPath: path,
      };
    }
  }

  return {
    target: path,
    displayPath: path,
  };
}

export function getDesktopSaveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

function basename(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, '');
}

function fileUrlToDisplayPath(url: URL) {
  const pathname = decodeURIComponent(url.pathname);

  if (/^\/[A-Za-z]:\//.test(pathname)) {
    return pathname.slice(1);
  }

  return pathname;
}

function isAllowedExternalUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return false;
    }

    return [
      'github.com',
      'www.github.com',
      'mermaid.js.org',
      'plantuml.com',
      'www.plantuml.com',
    ].includes(parsed.hostname);
  } catch {
    return false;
  }
}
