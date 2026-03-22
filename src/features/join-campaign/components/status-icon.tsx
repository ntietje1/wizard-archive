import { Shield } from '~/lib/icons'

type StatusIconVariant = 'loading' | 'success' | 'error' | 'warning'

interface StatusIconProps {
  variant: StatusIconVariant
}

export function StatusIcon({ variant }: StatusIconProps) {
  const configs = {
    loading: {
      bg: 'bg-accent',
      icon: 'text-primary',
      ring: 'ring-ring/50',
    },
    success: {
      bg: 'bg-accent',
      icon: 'text-primary',
      ring: 'ring-ring/50',
    },
    error: {
      bg: 'bg-destructive/15',
      icon: 'text-destructive',
      ring: 'ring-destructive/30',
    },
    warning: {
      bg: 'bg-accent',
      icon: 'text-primary',
      ring: 'ring-ring/50',
    },
  }

  const config = configs[variant]

  return (
    <div
      className={`relative p-4 ${config.bg} ${config.ring} ring-2 rounded-xl w-20 h-20 mx-auto mb-6 flex items-center justify-center`}
    >
      <Shield className={`h-10 w-10 ${config.icon}`} />
      <div className="absolute inset-0 bg-card/20 rounded-xl" />
    </div>
  )
}
