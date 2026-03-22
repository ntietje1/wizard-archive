import { CheckIcon, Monitor, Moon, Sun } from '~/lib/icons'
import { useTheme } from '~/hooks/useTheme'
import { cn } from '~/lib/shadcn/utils'
import { Separator } from '~/components/shadcn/ui/separator'

type ThemeOption = {
  value: 'light' | 'dark' | 'system'
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

const themeOptions: Array<ThemeOption> = [
  {
    value: 'light',
    label: 'Light',
    icon: Sun,
    description: 'A clean, bright interface',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: Moon,
    description: 'Easy on the eyes in low light',
  },
  {
    value: 'system',
    label: 'System',
    icon: Monitor,
    description: 'Follows your OS setting',
  },
]

export function PreferencesTab() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
          Account
        </p>
        <h2 className="text-lg font-semibold">Preferences</h2>
        <p className="text-sm text-muted-foreground">
          Customize the look and feel of the app
        </p>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-medium mb-3">Theme</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themeOptions.map(({ value, label, icon: Icon, description }) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer',
                'hover:bg-accent/50',
                theme === value
                  ? 'border-primary bg-accent/30'
                  : 'border-border',
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center rounded-lg p-2.5',
                  theme === value
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="size-5" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{label}</span>
                {theme === value && (
                  <CheckIcon className="size-3.5 text-primary" />
                )}
              </div>
              <span className="text-xs text-muted-foreground text-center">
                {description}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
