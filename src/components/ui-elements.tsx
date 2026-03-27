import React from 'react'

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
  disabled?: boolean
  title?: string
}

interface RadioSwitchProps {
  options: RadioSwitchOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function RadioSwitch({ options, value, onChange, className = '' }: RadioSwitchProps): React.ReactElement {
  return (
    <div className={`radio-switch ${className}`}>
      {options.map(option => (
        <label
          key={option.value}
          className={`radio-switch-option ${value === option.value ? 'active' : ''} ${option.disabled ? 'disabled' : ''}`}
          title={option.title}
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
    </div>
  )
}

interface HoverHintProps {
  label: React.ReactNode
  title: string
  children: React.ReactNode
  className?: string
}

export function HoverHint({ label, title, children, className = '' }: HoverHintProps): React.ReactElement {
  return (
    <div className={`hover-hint ${className}`}>
      <button type="button" className="hover-hint-trigger" aria-label={title}>
        {label}
      </button>
      <div className="hover-hint-panel" role="tooltip">
        <div className="hover-hint-title">{title}</div>
        <div className="hover-hint-body">{children}</div>
      </div>
    </div>
  )
}
