import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import Color from 'color'
import {
  ColorPicker,
  ColorPickerHue,
  ColorPickerSelection,
} from '~/features/shadcn/components/color-picker'
import { Popover, PopoverContent, PopoverTrigger } from '~/features/shadcn/components/popover'
import { logger } from '~/shared/utils/logger'
import { normalizePickerColor } from '~/shared/utils/color'

const CHECKERBOARD_PATTERN = [
  'linear-gradient(45deg, currentColor 25%, transparent 25%, transparent 75%, currentColor 75%, currentColor)',
  'linear-gradient(45deg, currentColor 25%, transparent 25%, transparent 75%, currentColor 75%, currentColor)',
].join(', ')
const STRIPE_PATTERN =
  'repeating-linear-gradient(135deg, var(--muted-foreground) 0 2px, transparent 2px 6px)'

interface PaintPickerValue {
  color: string
  opacity: number
}

interface ColorPickerPopoverProps {
  value: PaintPickerValue
  onChange: (value: PaintPickerValue) => void
  mixed?: boolean
  showOpacity?: boolean
}

export function ColorPickerPopover({
  value,
  onChange,
  mixed = false,
  showOpacity = true,
}: ColorPickerPopoverProps) {
  const normalizedValue = normalizePickerColor(value.color)

  let opacityGradient = 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 100%)'
  try {
    const parsed = Color(normalizedValue)
    const [r, g, b] = parsed.rgb().array()
    opacityGradient = `linear-gradient(90deg, rgba(${r}, ${g}, ${b}, 0) 0%, rgba(${r}, ${g}, ${b}, 1) 100%)`
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.warn('Failed to build opacity gradient for color picker', {
        normalizedValue,
        error,
      })
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        render={(props) => (
          <span
            {...props}
            role="button"
            aria-label={`Open color picker${mixed ? ' (mixed values)' : ''}`}
            className="inline-block h-6 w-6 rounded-sm border border-border text-foreground/15 transition-transform hover:scale-110"
            style={{
              backgroundColor: 'var(--background)',
              backgroundImage: CHECKERBOARD_PATTERN,
              backgroundPosition: '0 0, 4px 4px',
              backgroundSize: '8px 8px',
            }}
          >
            <span
              data-testid="color-preview"
              className="block h-full w-full rounded-sm"
              style={{
                backgroundColor: mixed ? 'transparent' : value.color,
                backgroundImage: mixed ? STRIPE_PATTERN : undefined,
                opacity: mixed ? 1 : value.opacity / 100,
              }}
            />
          </span>
        )}
      />
      <PopoverContent side="bottom" align="end" className="w-56 p-3 allow-motion">
        {mixed && <p className="mb-2 text-xs text-muted-foreground">Mixed values</p>}
        <ColorPicker
          value={normalizedValue}
          onChange={(color) => {
            onChange({
              color,
              opacity: value.opacity,
            })
          }}
        >
          <ColorPickerSelection className="h-32 rounded-md" />
          <ColorPickerHue />
          {showOpacity ? (
            <SliderPrimitive.Root
              className="relative flex h-4 w-full touch-none"
              aria-label="Opacity"
              min={0}
              max={100}
              step={1}
              value={[value.opacity]}
              onValueChange={(val) => {
                const nextOpacity = Array.isArray(val) ? val[0] : val
                onChange({
                  color: value.color,
                  opacity: nextOpacity,
                })
              }}
            >
              <SliderPrimitive.Control className="relative flex w-full touch-none items-center">
                <SliderPrimitive.Track
                  data-testid="opacity-track"
                  className="relative my-0.5 h-3 w-full grow overflow-hidden rounded-full text-foreground/15"
                  style={{
                    backgroundColor: 'var(--background)',
                    backgroundImage: `${opacityGradient}, ${CHECKERBOARD_PATTERN}`,
                    backgroundPosition: '0 0, 0 0, 4px 4px',
                    backgroundSize: '100% 100%, 8px 8px, 8px 8px',
                  }}
                />
                <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </SliderPrimitive.Control>
            </SliderPrimitive.Root>
          ) : null}
        </ColorPicker>
      </PopoverContent>
    </Popover>
  )
}
