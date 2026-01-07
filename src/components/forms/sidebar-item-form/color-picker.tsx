import { useState } from 'react'
import { Palette } from 'lucide-react'
import { Button } from '~/components/shadcn/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/shadcn/ui/popover'
import { cn } from '~/lib/shadcn/utils'

const COLOR_OPTIONS = [
  { name: 'Default', value: 'teal', className: 'bg-teal-500' },
  { name: 'Red', value: 'red', className: 'bg-red-500' },
  { name: 'Orange', value: 'orange', className: 'bg-orange-500' },
  { name: 'Yellow', value: 'yellow', className: 'bg-yellow-500' },
  { name: 'Green', value: 'green', className: 'bg-green-500' },
  { name: 'Blue', value: 'blue', className: 'bg-blue-500' },
  { name: 'Purple', value: 'purple', className: 'bg-purple-500' },
  { name: 'Pink', value: 'pink', className: 'bg-pink-500' },
  { name: 'Gray', value: 'gray', className: 'bg-gray-500' },
] as const

function getColorClassName(color: string | undefined | null): string {
  if (!color) return 'bg-teal-500'
  const found = COLOR_OPTIONS.find((c) => c.value === color)
  return found?.className ?? 'bg-teal-500'
}

interface ColorPickerProps {
  value: string | undefined | null
  onChange: (color: string | null) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const currentColorClass = getColorClassName(value)

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
              <div className="relative flex items-center justify-center w-full h-full">
                <Palette className="h-4 w-4" />
                <div
                  className={cn(
                    'absolute bottom-1 right-1 h-2 w-2 rounded-full ring-1 ring-background',
                    currentColorClass,
                  )}
                />
              </div>
            </Button>
          }
        />
        <PopoverContent className="w-48 p-2" align="start" sideOffset={4}>
          <div className="grid grid-cols-3 gap-2">
            {COLOR_OPTIONS.map((color) => {
              const isSelected = value === color.value

              return (
                <button
                  key={color.name}
                  type="button"
                  className={cn(
                    'relative flex h-8 items-center justify-center rounded-md px-2 text-xs transition-colors',
                    'hover:ring-2 hover:ring-ring hover:ring-offset-1',
                    isSelected &&
                      'ring-2 ring-amber-500 dark:ring-amber-400 ring-offset-1',
                  )}
                  onClick={() => {
                    onChange(color.value)
                    setOpen(false)
                  }}
                  title={color.name}
                >
                  <div
                    className={cn('h-5 w-5 rounded-full', color.className)}
                  />
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
