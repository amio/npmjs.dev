import React from 'react'
import { Toggle } from './ui-elements'

import CodeMirror from '@uiw/react-codemirror'
import { githubLight, githubDark } from '@uiw/codemirror-theme-github'
import { javascript } from '@codemirror/lang-javascript'

export interface CodeEditorProps {
  code: string
  onChange: (code: string) => void
  onExecute: () => void
  isLoading: boolean
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, onExecute, isLoading }) => {
  // register keydown listener on window to handle CMD+Enter globally
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (!isLoading) {
          onExecute()
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true })
    }
  }, [onExecute, isLoading])

  return (
    <div className="editor-panel">
      <div className="editor-block">
        <CodeMirror
          autoFocus
          height="36vh"
          value={code}
          theme={githubLight}
          extensions={[javascript()]}
          onChange={onChange}
          basicSetup={{
            highlightActiveLine: false,
            lineNumbers: false,
            foldGutter: false,
            searchKeymap: false,
            autocompletion: false,
          }}
        />
      </div>
      <div className="editor-footer">
        <span className="editor-info">
          Lines: {code.split('\n').length} | Characters: {code.length}
        </span>

        <div className="editor-controls">
          <Toggle active={!isLoading} fallback={<span className="running">Running</span>}>
            <button onClick={onExecute} disabled={isLoading} className="ghost-button">
              <span>
                <kbd>⌘</kbd>
                <kbd>⏎</kbd>
              </span>
              Run
            </button>
          </Toggle>
        </div>
      </div>
    </div>
  )
}
