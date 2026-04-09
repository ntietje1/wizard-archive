import { Button } from '~/features/shadcn/components/button'

export function SettingsRow({
  label,
  value,
  buttonLabel,
  buttonVariant: variant = 'outline',
  onAction,
  children,
}: {
  label: string
  value: string
  buttonLabel: string
  buttonVariant?: 'outline' | 'default' | 'destructive'
  onAction: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground truncate">{value}</p>
      </div>
      <Button variant={variant} size="sm" onClick={onAction} className="shrink-0">
        {buttonLabel}
      </Button>
      {children}
    </div>
  )
}
