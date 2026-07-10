import { assertResourceItemColor } from '../../items'
import type { ResourceColor } from '../../resource-contract'
import {
  DEFAULT_SIDEBAR_ITEM_COLOR,
  normalizeSidebarItemColorOrDefault,
} from '../../items/appearance'
import { useState } from 'react'
import { Palette } from 'lucide-react'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@wizard-archive/ui/shadcn/components/popover'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

const COLOR_OPTIONS: ReadonlyArray<{
  name: string
  hex: ResourceColor
  value: ResourceColor | null
}> = [
  {
    name: 'Default',
    hex: assertResourceItemColor(DEFAULT_SIDEBAR_ITEM_COLOR),
    value: null,
  },
  createColorOption('Red', assertResourceItemColor('#ef4444')),
  createColorOption('Orange', assertResourceItemColor('#f97316')),
  createColorOption('Yellow', assertResourceItemColor('#eab308')),
  createColorOption('Green', assertResourceItemColor('#22c55e')),
  createColorOption('Blue', assertResourceItemColor('#3b82f6')),
  createColorOption('Purple', assertResourceItemColor('#a855f7')),
  createColorOption('Pink', assertResourceItemColor('#ec4899')),
  createColorOption('Gray', assertResourceItemColor('#6b7280')),
]

function createColorOption(name: string, hex: ResourceColor) {
  return { name, hex, value: hex }
}

interface ColorPickerProps {
  value: ResourceColor | undefined | null
  onChange: (color: ResourceColor | null) => void
  triggerLabelledBy?: string
}

export function ColorPicker({ value, onChange, triggerLabelledBy }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const currentColorHex = normalizeSidebarItemColorOrDefault(value, DEFAULT_SIDEBAR_ITEM_COLOR)
  const selectedColorValue = value ?? null

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
              aria-label={triggerLabelledBy ? undefined : 'Select color'}
              aria-labelledby={triggerLabelledBy}
            >
              <div className="relative flex items-center justify-center w-full h-full">
                <Palette className="h-4 w-4" />
                <div
                  className="absolute bottom-1 right-1 h-2 w-2 rounded-full ring-1 ring-background"
                  style={{ backgroundColor: currentColorHex }}
                />
              </div>
            </Button>
          }
        />
        <PopoverContent className="w-48 p-2" align="start" sideOffset={4}>
          <div className="grid grid-cols-3 gap-2">
            {COLOR_OPTIONS.map((color) => {
              const isSelected = selectedColorValue === color.value

              return (
                <button
                  key={color.name}
                  type="button"
                  aria-label={`Select ${color.name.toLowerCase()} color`}
                  aria-pressed={isSelected}
                  className={cn(
                    'relative flex h-8 items-center justify-center rounded-md px-2 text-xs',
                    'hover:ring-2 hover:ring-ring hover:ring-offset-1',
                    isSelected && 'ring-2 ring-ring ring-offset-1',
                  )}
                  onClick={() => {
                    onChange(color.value)
                    setOpen(false)
                  }}
                  title={color.name}
                >
                  <div className="h-5 w-5 rounded-full" style={{ backgroundColor: color.hex }} />
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
