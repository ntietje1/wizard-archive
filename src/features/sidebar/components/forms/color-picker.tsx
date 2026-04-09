import { useState } from 'react'
import { Palette } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '~/features/shadcn/components/popover'
import { cn } from '~/features/shadcn/lib/utils'
import {
  DEFAULT_ITEM_COLOR,
  validateHexColorOrDefault,
} from '~/features/sidebar/utils/sidebar-item-utils'

const COLOR_OPTIONS = [
  { name: 'Default', hex: DEFAULT_ITEM_COLOR },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Gray', hex: '#6b7280' },
] as const

interface ColorPickerProps {
  value: string | undefined | null
  onChange: (color: string | null) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const currentColorHex = validateHexColorOrDefault(value, DEFAULT_ITEM_COLOR)

  return (
    <div className="h-9 w-9 flex-shrink-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          nativeButton
          render={
            <Button variant="outline" size="sm" className="h-9 w-9 p-0 min-w-9">
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
              const isSelected = currentColorHex === color.hex

              return (
                <button
                  key={color.name}
                  type="button"
                  className={cn(
                    'relative flex h-8 items-center justify-center rounded-md px-2 text-xs',
                    'hover:ring-2 hover:ring-ring hover:ring-offset-1',
                    isSelected && 'ring-2 ring-ring ring-offset-1',
                  )}
                  onClick={() => {
                    onChange(color.hex)
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
