import { Moon, Sun, Monitor, CheckIcon } from '~/lib/icons'
import { Button } from '~/components/shadcn/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/shadcn/ui/popover'
import { useTheme } from '~/hooks/useTheme'
import { cn } from '~/lib/shadcn/utils'

const themeOptions = [
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon">
            <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        }
      />
      <PopoverContent align="end" className="w-36 p-1 gap-0">
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none cursor-default',
              'hover:bg-accent hover:text-accent-foreground',
              theme === value && 'bg-accent text-accent-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
            {theme === value && <CheckIcon className="size-3.5 ml-auto" />}
          </button>
        ))}
        <div className="bg-border my-1 h-px -mx-1" />
        <button
          onClick={() => setTheme('system')}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none cursor-default',
            'hover:bg-accent hover:text-accent-foreground',
            theme === 'system' ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <Monitor className="size-4" />
          System
          {theme === 'system' && <CheckIcon className="size-3.5 ml-auto" />}
        </button>
      </PopoverContent>
    </Popover>
  )
}
