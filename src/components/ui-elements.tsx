import React from 'react'
import ReactDOM from 'react-dom'

interface ToggleProps {
  active: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function Toggle({ active, children, fallback }: ToggleProps): React.ReactElement | null {
  return active ? <>{children}</> : <>{fallback}</>
}

export interface RadioSwitchOption {
  value: string
  label: string
  hint?: string
  disabled?: boolean
  title?: string
}

interface RadioSwitchProps {
  options: RadioSwitchOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

interface TooltipState {
  text: string
  x: number
  y: number
}

function PortalTooltip({ text, x, y }: TooltipState): React.ReactElement {
  return ReactDOM.createPortal(
    <div className="portal-tooltip" style={{ left: x, top: y }} role="tooltip">
      {text}
    </div>,
    document.body,
  )
}

export function RadioSwitch({ options, value, onChange, className = '' }: RadioSwitchProps): React.ReactElement {
  const [tooltip, setTooltip] = React.useState<TooltipState | null>(null)
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout>>(null)

  const showTooltip = React.useCallback((e: React.MouseEvent<HTMLLabelElement>, hint: string) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({
      text: hint,
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
  }, [])

  const hideTooltip = React.useCallback(() => {
    hideTimerRef.current = setTimeout(() => {
      setTooltip(null)
    }, 80)
  }, [])

  React.useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  return (
    <div className={`radio-switch ${className}`}>
      {options.map(option => (
        <label
          key={option.value}
          className={`radio-switch-option ${value === option.value ? 'active' : ''} ${option.disabled ? 'disabled' : ''}`}
          title={option.title}
          onMouseEnter={option.hint ? e => showTooltip(e, option.hint!) : undefined}
          onMouseLeave={option.hint ? hideTooltip : undefined}
        >
          <input
            type="radio"
            name="radio-switch"
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={e => onChange(e.target.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
      {tooltip && <PortalTooltip {...tooltip} />}
    </div>
  )
}
