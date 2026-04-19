import React from 'react'
import { Toggle, RadioSwitch, RadioSwitchOption } from './ui-elements'
import { ExecutorAvailability, ExecutorType } from '../engine/types'
import { EXECUTOR_DESCRIPTORS, USER_SELECTABLE_EXECUTOR_ORDER } from '../engine/executor-strategy'
import { generateShareUrl } from '../utils/url-code'
import { RiShareLine, RiCheckLine } from '@remixicon/react'

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
  const [shareStatus, setShareStatus] = React.useState<'idle' | 'copied' | 'too-long'>('idle')
  const shareTimerRef = React.useRef<ReturnType<typeof setTimeout>>(null)
  const sharedCodeRef = React.useRef<string | null>(null)
  const hasShareableCode = code.trim().length > 0

  // Derive effective status: auto-reset to idle when code diverges from what was shared
  const effectiveShareStatus = shareStatus !== 'idle' && code !== sharedCodeRef.current ? 'idle' : shareStatus

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

  const handleShare = React.useCallback(async () => {
    if (shareTimerRef.current) {
      clearTimeout(shareTimerRef.current)
      shareTimerRef.current = null
    }

    const url = generateShareUrl(code)

    if (!url) {
      setShareStatus('too-long')
      shareTimerRef.current = setTimeout(() => setShareStatus('idle'), 3000)
      return
    }

    // Update URL without creating history entry and track the shared code
    history.replaceState(null, '', url)
    sharedCodeRef.current = code

    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard API may fail in insecure contexts; URL is still in address bar
    }

    setShareStatus('copied')
    shareTimerRef.current = setTimeout(() => setShareStatus('idle'), 2500)
  }, [code])

  const executorOptions: RadioSwitchOption[] = USER_SELECTABLE_EXECUTOR_ORDER.map(type => ({
    value: type,
    label: EXECUTOR_DESCRIPTORS[type].label,
    disabled: !executorAvailability[type].ready,
    title: executorAvailability[type].reason,
    hint: `${EXECUTOR_DESCRIPTORS[type].summary} ${EXECUTOR_DESCRIPTORS[type].hint}`,
  }))

  const shareButtonTitle =
    effectiveShareStatus === 'copied'
      ? 'Link copied to clipboard!'
      : effectiveShareStatus === 'too-long'
        ? 'Code is too long to share via URL'
        : 'Copy shareable link to clipboard'

  return (
    <div className={`editor-panel ${hasShareableCode ? 'has-shareable-code' : ''}`}>
      <div className="editor-block">
        <button
          onClick={handleShare}
          disabled={!hasShareableCode}
          className={`editor-share-button ${effectiveShareStatus !== 'idle' ? `share-${effectiveShareStatus}` : ''}`}
          title={shareButtonTitle}
          aria-label={shareButtonTitle}
          type="button"
        >
          {effectiveShareStatus === 'copied' ? (
            <RiCheckLine className="remixicon" />
          ) : (
            <RiShareLine className="remixicon" />
          )}
        </button>
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
