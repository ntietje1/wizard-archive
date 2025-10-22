import { Check } from '~/lib/icons'

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
  return (
    <div className="space-y-2">
      <div className="p-3 border border-slate-200 rounded-lg">
        <div
          className="flex flex-wrap gap-2 justify-between"
          role="radiogroup"
          aria-label="Color options"
          aria-disabled={disabled}
        >
          {colors.map((color) => (
            <button
              id={`color-picker-${color}`}
              key={color}
              type="button"
              onClick={() => onColorChange(color)}
              disabled={disabled}
              className="w-8 h-8 rounded-full border-2 border-slate-200 hover:border-slate-300 transition-colors relative flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50 hover:scale-110 transform duration-150"
              style={{ backgroundColor: color }}
              role="radio"
              aria-checked={selectedColor === color}
              aria-label={`Select ${color} color`}
            >
              {selectedColor === color && (
                <Check className="h-4 w-4 text-white drop-shadow" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export { DEFAULT_COLORS }
