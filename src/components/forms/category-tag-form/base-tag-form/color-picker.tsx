import Color from 'color'
import { PipetteIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
  ColorPicker as AdvancedColorPicker,
  ColorPickerAlpha,
  ColorPickerHue,
  ColorPickerFormat,
  ColorPickerOutput,
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

const normalizeColor = (hex: string) => {
  try {
    return Color(hex).hex().toLowerCase()
  } catch {
    return hex.toLowerCase()
  }
}

interface ColorPickerProps {
  selectedColor: string
  onColorChange: (color: string) => void
  colors?: string[]
  disabled?: boolean
}

export function ColorPicker({
  selectedColor,
  onColorChange,
  colors = DEFAULT_COLORS,
  disabled = false,
}: ColorPickerProps) {
  const normalizedColors = useMemo(
    () => colors.map((color) => normalizeColor(color)),
    [colors],
  )
  const normalizedSelectedColor = useMemo(
    () => normalizeColor(selectedColor),
    [selectedColor],
  )
  const isPresetSelected = normalizedColors.includes(normalizedSelectedColor)
  const [customColor, setCustomColor] = useState(selectedColor)
  const [isCustomOpen, setIsCustomOpen] = useState(false)

  useEffect(() => {
    if (!isPresetSelected) {
      try {
        setCustomColor(Color(selectedColor).hex())
      } catch {
        setCustomColor(selectedColor)
      }
    }
  }, [isPresetSelected, selectedColor])

  const handlePresetClick = (color: string) => {
    if (disabled) return
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

  const isCustomSelected = !isPresetSelected

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-slate-200 p-3">
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Color options"
          aria-disabled={disabled}
        >
          {colors.map((color, index) => {
            const normalizedColor =
              normalizedColors[index] ?? normalizeColor(color)
            const isSelected = normalizedSelectedColor === normalizedColor
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

          <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
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
                value={customColor}
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
