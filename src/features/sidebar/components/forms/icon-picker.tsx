import { useState } from 'react'
import type { SidebarItemIconName } from 'convex/sidebarItems/validation/icon'
import { Button } from '~/features/shadcn/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '~/features/shadcn/components/popover'
import { getAvailableIconNames, getIconByName } from '~/shared/utils/category-icons'
import { cn } from '~/features/shadcn/lib/utils'

interface IconPickerProps {
  value: SidebarItemIconName | undefined
  onChange: (iconName: SidebarItemIconName | null) => void
  defaultIcon?: SidebarItemIconName
}

export function IconPicker({ value, onChange, defaultIcon }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const iconNames = getAvailableIconNames()
  const CurrentIcon = getIconByName(value ?? defaultIcon)

  return (
    <div className="h-9 w-9 flex-shrink-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          nativeButton
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 min-w-9"
              aria-label="Select icon"
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
                    'relative flex h-8 w-8 items-center justify-center rounded-md',
                    'hover:bg-accent hover:text-accent-foreground',
                    (isSelected || isDefault) && 'bg-accent ring-2 ring-ring',
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
