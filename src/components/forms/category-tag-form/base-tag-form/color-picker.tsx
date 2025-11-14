import Color from 'color'
import { PipetteIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
  ColorPicker as AdvancedColorPicker,
  ColorPickerHue,
  ColorPickerSelection,
} from '~/components/shadcn/ui/color-picker'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/shadcn/ui/popover'
import { Check } from '~/lib/icons'
import { cn } from '~/lib/utils'

const DEFAULT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#64748b', // slate
  '#78716c', // stone
]

interface ColorPickerProps {
  selectedColor: string | null
  onColorChange: (color: string | null) => void
  colors?: string[]
  disabled?: boolean
  allowDeselect?: boolean
}

export function ColorPicker({
  selectedColor,
  onColorChange,
  colors = DEFAULT_COLORS,
  disabled = false,
  allowDeselect = true,
}: ColorPickerProps) {
  const isPresetSelected =
    selectedColor !== null && colors.includes(selectedColor)
  // Initialize customColor with selectedColor if it's a custom color, otherwise use a default gray
  const DEFAULT_CUSTOM_COLOR = '#808080'
  const [customColor, setCustomColor] = useState<string>(() => {
    if (selectedColor !== null && !colors.includes(selectedColor)) {
      try {
        return Color(selectedColor).hex()
      } catch {
        return selectedColor
      }
    }
    return DEFAULT_CUSTOM_COLOR
  })
  const [isCustomOpen, setIsCustomOpen] = useState(false)

  useEffect(() => {
    // Only update customColor when a custom color is selected (not a preset)
    if (selectedColor !== null && !isPresetSelected) {
      try {
        setCustomColor(Color(selectedColor).hex())
      } catch {
        setCustomColor(selectedColor)
      }
    }
    // When selectedColor is null or a preset is selected, keep the customColor as is
  }, [isPresetSelected, selectedColor])

  const handlePresetClick = (color: string) => {
    if (disabled) return
    if (color === selectedColor && allowDeselect) {
      onColorChange(null)
      return
    }
    // If allowDeselect is false, don't allow toggling off
    if (color === selectedColor && !allowDeselect) {
      return
    }
    onColorChange(color)
    setIsCustomOpen(false)
  }

  const handleCustomChange = (color: string) => {
    if (disabled) return
    try {
      const normalized = Color(color).hex()
      setCustomColor(normalized)
      onColorChange(normalized)
    } catch {
      setCustomColor(color)
      onColorChange(color)
    }
  }

  const isCustomSelected = selectedColor !== null && !isPresetSelected

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-slate-200 p-3">
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Color options"
          aria-disabled={disabled}
        >
          {colors.map((color) => {
            const isSelected = color === selectedColor
            return (
              <button
                id={`color-picker-${color.replace('#', '')}`}
                key={color}
                type="button"
                onClick={() => handlePresetClick(color)}
                disabled={disabled}
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-200 transition hover:scale-110 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 disabled:cursor-not-allowed disabled:opacity-50',
                  isSelected && 'border-slate-300',
                )}
                style={{ backgroundColor: color }}
                role="radio"
                aria-checked={isSelected}
                aria-label={`Select ${color} color`}
              >
                {isSelected && (
                  <Check className="h-4 w-4 text-white drop-shadow" />
                )}
              </button>
            )
          })}

          <Popover
            open={isCustomOpen}
            onOpenChange={(open) => {
              setIsCustomOpen(open)
              if (open) {
                onColorChange(customColor)
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-200 transition hover:scale-110 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 disabled:cursor-not-allowed disabled:opacity-50',
                  isCustomSelected && 'border-slate-300',
                )}
                style={{ backgroundColor: customColor }}
                role="radio"
                aria-checked={isCustomSelected}
                aria-label="Open custom color picker"
              >
                {isCustomSelected ? (
                  <Check className="h-4 w-4 text-white drop-shadow" />
                ) : (
                  <PipetteIcon className="h-4 w-4 text-white drop-shadow" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              sideOffset={8}
              className={cn(
                'w-[340px] p-5',
                disabled && 'pointer-events-none opacity-60',
              )}
            >
              <AdvancedColorPicker
                value={customColor ?? undefined}
                onChange={handleCustomChange}
              >
                <div className="flex flex-col gap-4">
                  <div className="relative h-64 w-full overflow-hidden rounded-lg">
                    <ColorPickerSelection className="h-full w-full" />
                  </div>

                  <div className="space-y-3">
                    <ColorPickerHue />
                  </div>
                </div>
              </AdvancedColorPicker>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}

export { DEFAULT_COLORS }
