interface ToggleProps {
  active: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function Toggle({ active, children, fallback }: ToggleProps): React.ReactElement | null {
  return active ? <>{children}</> : <>{fallback}</>
}
