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
