import { useCallback, useEffect, useMemo, useState } from 'react'
import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import Color from 'color'
import {
  ColorPicker,
  ColorPickerHue,
  ColorPickerSelection,
} from '~/features/shadcn/components/color-picker'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/features/shadcn/components/popover'

const CHECKERBOARD_PATTERN =
  'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==") left center'

interface ColorPickerPopoverProps {
  value: string
  onChange: (color: string) => void
  opacity?: number
  onOpacityChange?: (opacity: number) => void
}

export function ColorPickerPopover({
  value,
  onChange,
  opacity,
  onOpacityChange,
}: ColorPickerPopoverProps) {
  const [localOpacity, setLocalOpacity] = useState(opacity ?? 100)

  useEffect(() => {
    setLocalOpacity(opacity ?? 100)
  }, [opacity])

  const handleOpacitySlider = useCallback(
    (val: number | ReadonlyArray<number>) => {
      const v = Array.isArray(val) ? val[0] : val
      setLocalOpacity(v)
      onOpacityChange?.(v)
    },
    [onOpacityChange],
  )

  const opacityGradient = useMemo(() => {
    try {
      const parsed = Color(value)
      const [r, g, b] = parsed.rgb().array()
      return `linear-gradient(90deg, rgba(${r}, ${g}, ${b}, 0) 0%, rgba(${r}, ${g}, ${b}, 1) 100%)`
    } catch {
      return 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 100%)'
    }
  }, [value])

  return (
    <Popover>
      <PopoverTrigger
        nativeButton
        render={(props) => (
          <span
            {...props}
            role="button"
            aria-label="Open color picker"
            className="h-6 w-6 rounded-sm border border-border transition-transform hover:scale-110 inline-block"
            style={{ background: CHECKERBOARD_PATTERN }}
          >
            <span
              className="block h-full w-full rounded-sm"
              style={{
                backgroundColor: value,
                opacity: localOpacity / 100,
              }}
            />
          </span>
        )}
      />
      <PopoverContent
        side="bottom"
        align="end"
        className="w-56 p-3 allow-motion"
      >
        <ColorPicker value={value} onChange={onChange}>
          <ColorPickerSelection className="h-32 rounded-md" />
          <ColorPickerHue />

          {onOpacityChange && (
            <SliderPrimitive.Root
              className="relative flex h-4 w-full touch-none"
              aria-label="Opacity"
              min={0}
              max={100}
              step={1}
              value={[localOpacity]}
              onValueChange={handleOpacitySlider}
            >
              <SliderPrimitive.Control className="relative flex w-full touch-none items-center">
                <SliderPrimitive.Track
                  className="relative my-0.5 h-3 w-full grow overflow-hidden rounded-full"
                  style={{
                    background: CHECKERBOARD_PATTERN,
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: opacityGradient }}
                  />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </SliderPrimitive.Control>
            </SliderPrimitive.Root>
          )}
        </ColorPicker>
      </PopoverContent>
    </Popover>
  )
}
