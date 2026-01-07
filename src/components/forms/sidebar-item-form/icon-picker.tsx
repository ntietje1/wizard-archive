import { useState } from 'react'
import { Button } from '~/components/shadcn/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/shadcn/ui/popover'
import { getAvailableIconNames, getIconByName } from '~/lib/category-icons'
import { cn } from '~/lib/shadcn/utils'

interface IconPickerProps {
  value: string | undefined
  onChange: (iconName: string | null) => void
  defaultIcon?: string
}

export function IconPicker({ value, onChange, defaultIcon }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const iconNames = getAvailableIconNames()
  const CurrentIcon = getIconByName(value ?? defaultIcon)

  return (
    <div className="h-9 w-9 flex-shrink-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 min-w-9"
              type="button"
            >
              <CurrentIcon className="h-4 w-4" />
            </Button>
          }
        />
        <PopoverContent className="w-64 p-2" align="start" sideOffset={4}>
          <div className="grid grid-cols-6 gap-1">
            {iconNames.map((iconName) => {
              const IconComponent = getIconByName(iconName)
              const isSelected = value === iconName
              const isDefault = !value && iconName === defaultIcon

              return (
                <button
                  key={iconName}
                  type="button"
                  className={cn(
                    'relative flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    (isSelected || isDefault) &&
                      'bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-500 dark:ring-amber-400',
                  )}
                  onClick={() => {
                    onChange(iconName === defaultIcon ? null : iconName)
                    setOpen(false)
                  }}
                  title={iconName}
                >
                  <IconComponent className="h-4 w-4" />
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
