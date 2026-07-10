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
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

interface ColorPickerContextValue {
  hue: number
  saturation: number
  lightness: number
  setHue: (hue: number) => void
  setSaturation: (saturation: number) => void
  setLightness: (lightness: number) => void
}

const ColorPickerContext = createContext<ColorPickerContextValue | undefined>(undefined)

const useColorPicker = (): ColorPickerContextValue => {
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
  const lastGeneratedHex = useRef<string | undefined>(undefined)

  // Update color when controlled value changes
  useEffect(() => {
    if (value !== undefined && selectedColor) {
      const generatedHex = selectedColor.hex().toLowerCase()

      // Skip if this is the value we just generated (prevents hue recalculation)
      if (lastGeneratedHex.current === generatedHex) {
        lastGeneratedHex.current = undefined
        return
      }

      const nextSaturation = selectedColor.saturationl()
      const nextLightness = selectedColor.lightness()

      setSaturation(Number.isFinite(nextSaturation) ? nextSaturation : 100)
      setLightness(Number.isFinite(nextLightness) ? nextLightness : 50)

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

    const formatted = Color.hsl(hue, saturation, lightness).hex().toLowerCase()

    // Don't call onChange if this matches the current value prop
    if (value !== undefined) {
      try {
        const currentValue = Color(value)
        const currentFormatted = currentValue.hex().toLowerCase()
        if (currentFormatted === formatted) {
          return
        }
      } catch {
        // ignore invalid values
      }
    }

    lastGeneratedHex.current = formatted
    onChange(formatted)
  }, [hue, saturation, lightness, onChange, value])

  return (
    <ColorPickerContext.Provider
      value={{
        hue,
        saturation,
        lightness,
        setHue,
        setSaturation,
        setLightness,
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
