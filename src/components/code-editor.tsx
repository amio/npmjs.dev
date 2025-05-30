import React, { useRef } from 'react'
import { Toggle } from './ui-elements'

export interface CodeEditorProps {
  code: string
  onChange: (code: string) => void
  onExecute: () => void
  isLoading: boolean
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, onExecute, isLoading }) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = e.target as HTMLTextAreaElement
      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      // Insert two spaces as indentation
      const newValue = code.substring(0, start) + '  ' + code.substring(end)
      onChange(newValue)

      // Set cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2
          textareaRef.current.selectionEnd = start + 2
          textareaRef.current.focus()
        }
      }, 0)
    }

    // Handle CMD+Enter (macOS) or Ctrl+Enter (Windows) to execute code
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (!isLoading) {
        onExecute()
      }
    }
  }

  return (
    <div className="editor-panel">
      <textarea
        className="code-textarea"
        ref={textareaRef}
        autoFocus
        value={code}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write your JavaScript code here..."
        spellCheck={false}
      />
      <div className="editor-footer">
        <span className="editor-info">
          Lines: {code.split('\n').length} | Characters: {code.length}
        </span>

        <div className="editor-controls">
          <Toggle active={!isLoading} fallback={<span className='running'>Running</span>}>
            <button onClick={onExecute} disabled={isLoading} className="ghost-button">
              <span><kbd>⌘</kbd><kbd>⏎</kbd></span>Run
            </button>
          </Toggle>
        </div>
      </div>
    </div>
  )
}
