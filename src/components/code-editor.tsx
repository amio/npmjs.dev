import React from 'react'
import { Toggle, RadioSwitch, RadioSwitchOption, HoverHint } from './ui-elements'
import { ExecutorAvailability, ExecutorType } from '../engine/types'
import { EXECUTOR_DESCRIPTORS } from '../engine/executor-strategy'
import { RiInformationLine } from '@remixicon/react'

import CodeMirror from '@uiw/react-codemirror'
import { githubLight } from '@uiw/codemirror-theme-github'
import { javascript } from '@codemirror/lang-javascript'

// Detect if user is on Mac
const isMac = (() => {
  if (typeof navigator !== 'undefined') {
    // Use modern API if available
    if ('userAgentData' in navigator && navigator.userAgentData) {
      const userAgentData = navigator.userAgentData as any
      return userAgentData.platform?.toLowerCase().includes('mac') || false
    }
    // Fallback to userAgent
    return navigator.userAgent.toLowerCase().includes('mac')
  }
  return false
})()

export interface CodeEditorProps {
  code: string
  onChange: (code: string) => void
  onExecute: () => void
  isLoading: boolean
  executorType: ExecutorType
  onExecutorTypeChange: (type: ExecutorType) => void
  executorAvailability: Record<ExecutorType, ExecutorAvailability>
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  onChange,
  onExecute,
  isLoading,
  executorType,
  onExecutorTypeChange,
  executorAvailability,
}) => {
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

  const executorOptions: RadioSwitchOption[] = [
    {
      value: 'quickjs',
      label: EXECUTOR_DESCRIPTORS.quickjs.label,
      disabled: !executorAvailability.quickjs.ready,
      title: executorAvailability.quickjs.reason,
    },
    {
      value: 'browser',
      label: EXECUTOR_DESCRIPTORS.browser.label,
      disabled: !executorAvailability.browser.ready,
      title: executorAvailability.browser.reason,
    },
    {
      value: 'cloudflare',
      label: EXECUTOR_DESCRIPTORS.cloudflare.label,
      disabled: !executorAvailability.cloudflare.ready,
      title: executorAvailability.cloudflare.reason,
    },
  ]

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
        <div className="editor-controls">
          <div className="executor-switch-group">
            <div className="executor-switch" title="Select execution engine">
              <RadioSwitch
                options={executorOptions}
                value={executorType}
                onChange={value => onExecutorTypeChange(value as ExecutorType)}
              />
            </div>
            <HoverHint
              label={<RiInformationLine size={15} />}
              title="Runtime guide"
              className="executor-hint"
            >
              <div className="executor-hint-content">
                <p>Automatic mode picks a default runtime, but you can still switch anytime.</p>
                <div className="executor-hint-list" role="list">
                  {(['quickjs', 'browser', 'cloudflare'] as ExecutorType[]).map(type => (
                    <section key={type} className="executor-hint-item" role="listitem">
                      <h4>{EXECUTOR_DESCRIPTORS[type].label}</h4>
                      <p>
                        {EXECUTOR_DESCRIPTORS[type].summary} {EXECUTOR_DESCRIPTORS[type].hint}
                      </p>
                    </section>
                  ))}
                </div>
              </div>
            </HoverHint>
          </div>
          <Toggle active={isLoading}>
            <div className="spinner" />
          </Toggle>
          <button onClick={onExecute} disabled={isLoading} className="ghost-button">
            <span>
              <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd>
              <kbd>{isMac ? '⏎' : 'Enter'}</kbd>
            </span>
            Run
          </button>
        </div>
      </div>
    </div>
  )
}
