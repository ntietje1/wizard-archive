import { describe, expect, it, vi } from 'vitest'
import { edgeToolSpec } from '../edge-tool-module'
import type { CanvasToolPropertyContext } from '../../canvas-tool-types'
import type {
  CanvasPaintPropertyBinding,
  CanvasPropertyBinding,
  CanvasStrokeSizePropertyBinding,
} from '../../../properties/canvas-property-types'

describe('edgeToolSpec', () => {
  it('binds line paint to the current edge tool settings', () => {
    const setStrokeColor = vi.fn()
    const setStrokeOpacity = vi.fn()
    const properties = edgeToolSpec.properties?.(
      createPropertyContext({
        strokeColor: '#2563eb',
        strokeOpacity: 40,
        setStrokeColor,
        setStrokeOpacity,
      }),
    )
    const paint = properties?.bindings.find(isPaintBinding)

    expect(paint?.getValue()).toEqual({ color: '#2563eb', opacity: 40 })

    paint?.setValue({ color: '#ef4444', opacity: 80 })

    expect(setStrokeColor).toHaveBeenCalledWith('#ef4444')
    expect(setStrokeOpacity).toHaveBeenCalledWith(80)
  })

  it('clamps line stroke size reads and writes', () => {
    const setStrokeSize = vi.fn()
    const properties = edgeToolSpec.properties?.(
      createPropertyContext({
        strokeSize: 0,
        setStrokeSize,
      }),
    )
    const strokeSize = properties?.bindings.find(isStrokeSizeBinding)

    expect(strokeSize?.getValue()).toBe(1)

    strokeSize?.setValue(0)

    expect(setStrokeSize).toHaveBeenCalledWith(1)
  })
})

function createPropertyContext({
  strokeColor = 'var(--foreground)',
  strokeOpacity = 100,
  strokeSize = 4,
  setStrokeColor = () => undefined,
  setStrokeOpacity = () => undefined,
  setStrokeSize = () => undefined,
}: {
  strokeColor?: string
  strokeOpacity?: number
  strokeSize?: number
  setStrokeColor?: (color: string) => void
  setStrokeOpacity?: (opacity: number) => void
  setStrokeSize?: (size: number) => void
}): CanvasToolPropertyContext {
  return {
    toolState: {
      getSettings: () => ({
        edgeType: 'bezier',
        strokeColor,
        strokeOpacity,
        strokeSize,
      }),
      setEdgeType: () => undefined,
      setStrokeColor,
      setStrokeOpacity,
      setStrokeSize,
    },
  }
}

function isPaintBinding(binding: CanvasPropertyBinding): binding is CanvasPaintPropertyBinding {
  return binding.definition.kind === 'paint'
}

function isStrokeSizeBinding(
  binding: CanvasPropertyBinding,
): binding is CanvasStrokeSizePropertyBinding {
  return binding.definition.kind === 'strokeSize'
}
