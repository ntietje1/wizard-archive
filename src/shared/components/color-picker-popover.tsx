import { useCallback, useState } from 'react'
import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import { Check, Copy } from 'lucide-react'
import type { ReactElement } from 'react'
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
import { Button } from '~/features/shadcn/components/button'

interface ColorPickerPopoverProps {
  value: string
  onChange: (color: string) => void
  opacity?: number
  onOpacityChange?: (opacity: number) => void
  trigger?: ReactElement
}

export function ColorPickerPopover({
  value,
  onChange,
  opacity,
  onOpacityChange,
  trigger,
}: ColorPickerPopoverProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [value])

  const handleOpacitySlider = useCallback(
    (val: number | ReadonlyArray<number>) => {
      onOpacityChange?.(Array.isArray(val) ? val[0] : val)
    },
    [onOpacityChange],
  )

  const defaultTrigger = (
    <button
      className="h-6 w-6 rounded-sm border border-border transition-transform hover:scale-110"
      style={{ backgroundColor: value }}
      aria-label="Custom color"
    />
  )

  return (
    <Popover>
      <PopoverTrigger nativeButton render={trigger ?? defaultTrigger} />
      <PopoverContent
        side="bottom"
        align="end"
        className="w-56 p-3 allow-motion"
      >
        <ColorPicker value={value} onChange={onChange}>
          <ColorPickerSelection className="h-32 rounded-md" />
          <ColorPickerHue />
        </ColorPicker>

        {onOpacityChange && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground shrink-0">
              Opacity
            </span>
            <SliderPrimitive.Root
              className="relative flex h-4 w-full touch-none"
              min={0}
              max={100}
              step={1}
              value={[opacity ?? 100]}
              onValueChange={handleOpacitySlider}
            >
              <SliderPrimitive.Control className="relative flex w-full touch-none items-center">
                <SliderPrimitive.Track className="relative my-0.5 h-1 w-full grow rounded-full bg-muted">
                  <SliderPrimitive.Indicator className="bg-primary h-full rounded-full" />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb className="block h-3 w-3 rounded-full border border-primary/50 bg-background shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </SliderPrimitive.Control>
            </SliderPrimitive.Root>
            <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
              {opacity ?? 100}%
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs text-muted-foreground font-mono flex-1 truncate">
            {value}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleCopy}
            aria-label="Copy color"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
