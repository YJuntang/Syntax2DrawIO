import React, { useRef, useEffect } from 'react';
import Editor, { loader, useMonaco } from '@monaco-editor/react';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { useEditorStore } from '../../store/editorStore';
import { useTheme } from '../../hooks/useTheme';

loader.config({ monaco: monacoEditor });

const monacoEnvironmentTarget = globalThis as typeof globalThis & {
  MonacoEnvironment?: {
    getWorker?: (_moduleId: unknown, label: string) => Worker;
  };
};

if (typeof globalThis !== 'undefined' && !monacoEnvironmentTarget.MonacoEnvironment) {
  monacoEnvironmentTarget.MonacoEnvironment = {
    getWorker(_: unknown, _label: string) {
      return new editorWorker();
    },
  };
}

export function CodeEditor() {
  const sourceCode = useEditorStore((state) => state.sourceCode);
  const setSourceCode = useEditorStore((state) => state.setSourceCode);
  const parseError = useEditorStore((state) => state.parseError);
  const { theme } = useTheme();
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);

  // Configure custom Monarch syntax highlighting and theme
  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('s2d-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#09090b', // zinc-950
          'editor.foreground': '#e4e4e7', // zinc-200
        }
      });
      monaco.editor.setTheme(theme === 'dark' ? 's2d-dark' : 'light');
    }
  }, [monaco, theme]);

  // Handle errors (squiggly lines)
  useEffect(() => {
    if (monaco && editorRef.current) {
      const model = editorRef.current.getModel();
      if (!model) return;

      if (parseError && parseError.line) {
        monaco.editor.setModelMarkers(model, 'syntax2drawio', [
          {
            startLineNumber: parseError.line,
            startColumn: 1,
            endLineNumber: parseError.line,
            endColumn: 1000,
            message: parseError.message,
            severity: monaco.MarkerSeverity.Error,
          },
        ]);
      } else {
        monaco.editor.setModelMarkers(model, 'syntax2drawio', []);
      }
    }
  }, [parseError, monaco]);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  useEffect(() => {
    const revealLine = (event: Event) => {
      const detail = (event as CustomEvent<{ line: number; column: number }>).detail;
      if (!detail || !editorRef.current) return;
      editorRef.current.setPosition({ lineNumber: detail.line, column: detail.column || 1 });
      editorRef.current.revealLineInCenter(detail.line);
      editorRef.current.focus();
    };
    window.addEventListener('s2d:reveal-line', revealLine);
    return () => window.removeEventListener('s2d:reveal-line', revealLine);
  }, []);

  return (
    <div className="flex-1 overflow-hidden bg-zinc-950 light:bg-zinc-50 relative">
      <Editor
        height="100%"
        defaultLanguage="plaintext"
        theme={theme === 'dark' ? 's2d-dark' : 'light'}
        value={sourceCode}
        onChange={(val) => setSourceCode(val || '')}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.6,
          padding: { top: 16, bottom: 16 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          formatOnPaste: true,
          wordWrap: 'on',
          renderLineHighlight: 'all',
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
        className="monaco-custom-theme"
      />
    </div>
  );
}
