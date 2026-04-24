'use client'

import Color from 'color'
import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ComponentProps, HTMLAttributes } from 'react'
import { Input } from '~/features/shadcn/components/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/features/shadcn/components/select'
import { cn } from '~/features/shadcn/lib/utils'

type ColorMode = 'hex' | 'rgb' | 'css' | 'hsl'

interface ColorPickerContextValue {
  hue: number
  saturation: number
  lightness: number
  alpha: number
  mode: ColorMode
  setHue: (hue: number) => void
  setSaturation: (saturation: number) => void
  setLightness: (lightness: number) => void
  setAlpha: (alpha: number) => void
  setMode: (mode: ColorMode) => void
}

const ColorPickerContext = createContext<ColorPickerContextValue | undefined>(undefined)

export const useColorPicker = (): ColorPickerContextValue => {
  const context = useContext(ColorPickerContext)

  if (!context) {
    throw new Error('useColorPicker must be used within a ColorPickerProvider')
  }

  return context
}

export type ColorPickerProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  value?: Parameters<typeof Color>[0]
  defaultValue?: Parameters<typeof Color>[0]
  onChange?: (value: string) => void
}

export const ColorPicker = ({
  value,
  defaultValue = '#000000',
  onChange,
  className,
  children,
  ...props
}: ColorPickerProps) => {
  const selectedColor = useMemo(() => {
    if (value !== undefined) {
      try {
        return Color(value)
      } catch {
        return Color(defaultValue)
      }
    }
    return null
  }, [value, defaultValue])

  const defaultColor = useMemo(() => {
    try {
      return Color(defaultValue)
    } catch {
      return Color('#000000')
    }
  }, [defaultValue])

  const [hue, setHue] = useState(() => {
    const h = selectedColor?.hue() ?? defaultColor.hue()
    return Number.isFinite(h) ? h : 0
  })
  const [saturation, setSaturation] = useState(() => {
    const s = selectedColor?.saturationl() ?? defaultColor.saturationl()
    return Number.isFinite(s) ? s : 100
  })
  const [lightness, setLightness] = useState(() => {
    const l = selectedColor?.lightness() ?? defaultColor.lightness()
    return Number.isFinite(l) ? l : 50
  })
  const [alpha, setAlpha] = useState(() => {
    const a = selectedColor?.alpha() ?? defaultColor.alpha()
    return Math.round(a * 100)
  })
  const [mode, setMode] = useState<ColorMode>('hex')
  const lastGeneratedHex = useRef<string | undefined>(undefined)

  // Update color when controlled value changes
  useEffect(() => {
    if (value !== undefined && selectedColor) {
      const generatedHex = (
        selectedColor.alpha() >= 1 ? selectedColor.hex() : selectedColor.hexa()
      ).toLowerCase()

      // Skip if this is the value we just generated (prevents hue recalculation)
      if (lastGeneratedHex.current === generatedHex) {
        lastGeneratedHex.current = undefined
        return
      }

      const nextSaturation = selectedColor.saturationl()
      const nextLightness = selectedColor.lightness()
      const nextAlpha = Math.round(selectedColor.alpha() * 100)

      setSaturation(Number.isFinite(nextSaturation) ? nextSaturation : 100)
      setLightness(Number.isFinite(nextLightness) ? nextLightness : 50)
      setAlpha(Number.isFinite(nextAlpha) ? nextAlpha : 100)

      // Only update hue if saturation is meaningful (hue is unstable at low saturation)
      const currentSaturation = Number.isFinite(nextSaturation) ? nextSaturation : 0
      if (currentSaturation >= 1) {
        const nextHue = selectedColor.hue()
        if (Number.isFinite(nextHue)) {
          setHue(nextHue)
        }
      }
    }
  }, [value, selectedColor])

  // Notify parent of changes
  useEffect(() => {
    if (!onChange) {
      return
    }

    const color = Color.hsl(hue, saturation, lightness).alpha(alpha / 100)
    const formatted = (alpha === 100 ? color.hex() : color.hexa()).toLowerCase()

    // Don't call onChange if this matches the current value prop
    if (value !== undefined) {
      try {
        const currentValue = Color(value)
        const currentFormatted = (
          currentValue.alpha() >= 1 ? currentValue.hex() : currentValue.hexa()
        ).toLowerCase()
        if (currentFormatted === formatted) {
          return
        }
      } catch {
        // ignore invalid values
      }
    }

    lastGeneratedHex.current = formatted
    onChange(formatted)
  }, [hue, saturation, lightness, alpha, onChange, value])

  return (
    <ColorPickerContext.Provider
      value={{
        hue,
        saturation,
        lightness,
        alpha,
        mode,
        setHue,
        setSaturation,
        setLightness,
        setAlpha,
        setMode,
      }}
    >
      <div className={cn('flex size-full flex-col gap-4', className)} {...props}>
        {children}
      </div>
    </ColorPickerContext.Provider>
  )
}

export type ColorPickerSelectionProps = HTMLAttributes<HTMLDivElement>

export const ColorPickerSelection = memo(({ className, ...props }: ColorPickerSelectionProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [positionX, setPositionX] = useState(0)
  const [positionY, setPositionY] = useState(0)
  const { hue, saturation, lightness, setSaturation, setLightness } = useColorPicker()

  const backgroundGradient = useMemo(() => {
    return `linear-gradient(0deg, rgba(0,0,0,1), rgba(0,0,0,0)),
            linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0)),
            hsl(${hue}, 100%, 50%)`
  }, [hue])

  const updateColorFromPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) {
        return
      }
      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
      setPositionX(x)
      setPositionY(y)
      setSaturation(x * 100)
      const topLightness = x < 0.01 ? 100 : 50 + 50 * (1 - x)
      const newLightness = topLightness * (1 - y)

      setLightness(newLightness)
    },
    [setSaturation, setLightness],
  )

  const handlePointerMove = useCallback(
    (event: globalThis.PointerEvent) => {
      if (!isDragging) {
        return
      }
      updateColorFromPosition(event.clientX, event.clientY)
    },
    [isDragging, updateColorFromPosition],
  )

  useEffect(() => {
    if (isDragging) {
      return
    }

    const x = Math.max(0, Math.min(1, Number.isFinite(saturation) ? saturation / 100 : 0))
    setPositionX(x)

    const topLightness = x < 0.01 ? 100 : 50 + 50 * (1 - x)
    const ratio = topLightness === 0 ? 0 : lightness / topLightness
    const y = 1 - Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0))
    setPositionY(y)
  }, [saturation, lightness, isDragging])

  useEffect(() => {
    const handlePointerUp = () => setIsDragging(false)

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDragging, handlePointerMove])

  return (
    <div
      className={cn('relative size-full cursor-crosshair rounded', className)}
      onPointerDown={(e) => {
        e.preventDefault()
        setIsDragging(true)
        updateColorFromPosition(e.clientX, e.clientY)
      }}
      ref={containerRef}
      style={{
        background: backgroundGradient,
      }}
      {...props}
    >
      <div
        className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute h-4 w-4 rounded-full border-2 border-white"
        style={{
          left: `${positionX * 100}%`,
          top: `${positionY * 100}%`,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
        }}
      />
    </div>
  )
})

ColorPickerSelection.displayName = 'ColorPickerSelection'

export type ColorPickerHueProps = ComponentProps<typeof SliderPrimitive.Root>

export const ColorPickerHue = ({ className, ...props }: ColorPickerHueProps) => {
  const { hue, setHue } = useColorPicker()

  return (
    <SliderPrimitive.Root
      className={cn('relative flex h-4 w-full touch-none', className)}
      min={0}
      max={360}
      onValueChange={(value) => {
        const newHue = Array.isArray(value) ? value[0] : value
        if (typeof newHue === 'number' && Number.isFinite(newHue)) {
          setHue(newHue)
        }
      }}
      step={1}
      value={[hue]}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center">
        <SliderPrimitive.Track className="relative my-0.5 h-3 w-full grow rounded-full bg-[linear-gradient(90deg,#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF,#FF0000)]" />
        <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export type ColorPickerAlphaProps = ComponentProps<typeof SliderPrimitive.Root>

export const ColorPickerAlpha = ({ className, ...props }: ColorPickerAlphaProps) => {
  const { alpha, setAlpha, hue, saturation, lightness } = useColorPicker()

  const gradient = useMemo(() => {
    const base = Color.hsl(hue, saturation, lightness)
    const [r, g, b] = base.rgb().array()
    return `linear-gradient(90deg, rgba(${r}, ${g}, ${b}, 0) 0%, rgba(${r}, ${g}, ${b}, 1) 100%)`
  }, [hue, saturation, lightness])

  return (
    <SliderPrimitive.Root
      className={cn('relative flex h-4 w-full touch-none', className)}
      min={0}
      max={100}
      onValueChange={(value) => {
        const newAlpha = Array.isArray(value) ? value[0] : value
        if (typeof newAlpha === 'number' && Number.isFinite(newAlpha)) {
          setAlpha(newAlpha)
        }
      }}
      step={1}
      value={[alpha]}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center">
        <SliderPrimitive.Track
          className="relative my-0.5 h-3 w-full grow rounded-full"
          style={{
            background:
              'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==") left center',
          }}
        >
          <div className="absolute inset-0 rounded-full" style={{ background: gradient }} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export type ColorPickerOutputProps = ComponentProps<typeof SelectTrigger>

const formats: Array<ColorMode> = ['hex', 'rgb', 'css', 'hsl']

export const ColorPickerOutput = ({ className: _className, ...props }: ColorPickerOutputProps) => {
  const { mode, setMode } = useColorPicker()

  return (
    <Select
      onValueChange={(value) => {
        if (value && (value === 'hex' || value === 'rgb' || value === 'css' || value === 'hsl')) {
          setMode(value)
        }
      }}
      value={mode}
    >
      <SelectTrigger className="h-8 w-20 shrink-0 text-xs" {...props}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {formats.map((format) => (
          <SelectItem className="text-xs" key={format} value={format}>
            {format.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

type PercentageInputProps = ComponentProps<typeof Input>

const PercentageInput = ({ className, ...props }: PercentageInputProps) => {
  return (
    <div className="relative">
      <Input
        readOnly
        type="text"
        {...props}
        className={cn(
          'h-8 w-[3.25rem] rounded-l-none bg-secondary px-2 text-xs shadow-none',
          className,
        )}
      />
      <span className="-translate-y-1/2 absolute top-1/2 right-2 text-muted-foreground text-xs">
        %
      </span>
    </div>
  )
}

export type ColorPickerFormatProps = HTMLAttributes<HTMLDivElement>

export const ColorPickerFormat = ({ className, ...props }: ColorPickerFormatProps) => {
  const { hue, saturation, lightness, alpha, mode } = useColorPicker()
  const color = Color.hsl(hue, saturation, lightness, alpha / 100)

  if (mode === 'hex') {
    const hex = color.hex()

    return (
      <div
        className={cn(
          '-space-x-px relative flex w-full items-center rounded-md shadow-sm',
          className,
        )}
        {...props}
      >
        <Input
          className="h-8 rounded-r-none bg-secondary px-2 text-xs shadow-none"
          readOnly
          type="text"
          value={hex}
        />
        <PercentageInput value={alpha} />
      </div>
    )
  }

  if (mode === 'rgb') {
    const rgb = color
      .rgb()
      .array()
      .map((value) => Math.round(value))

    return (
      <div
        className={cn('-space-x-px flex items-center rounded-md shadow-sm', className)}
        {...props}
      >
        {rgb.map((value, index) => (
          <Input
            className={cn(
              'h-8 rounded-r-none bg-secondary px-2 text-xs shadow-none',
              index && 'rounded-l-none',
              className,
            )}
            key={index}
            readOnly
            type="text"
            value={value}
          />
        ))}
        <PercentageInput value={alpha} />
      </div>
    )
  }

  if (mode === 'css') {
    const rgb = color
      .rgb()
      .array()
      .map((value) => Math.round(value))

    return (
      <div className={cn('w-full rounded-md shadow-sm', className)} {...props}>
        <Input
          className="h-8 w-full bg-secondary px-2 text-xs shadow-none"
          readOnly
          type="text"
          value={`rgba(${rgb.join(', ')}, ${alpha}%)`}
          {...props}
        />
      </div>
    )
  }

  // mode === 'hsl' (last remaining option)
  const hsl = color
    .hsl()
    .array()
    .map((value) => Math.round(value))

  return (
    <div className={cn('-space-x-px flex items-center rounded-md shadow-sm', className)} {...props}>
      {hsl.map((value, index) => (
        <Input
          className={cn(
            'h-8 rounded-r-none bg-secondary px-2 text-xs shadow-none',
            index && 'rounded-l-none',
            className,
          )}
          key={index}
          readOnly
          type="text"
          value={value}
        />
      ))}
      <PercentageInput value={alpha} />
    </div>
  )
}
