import { ChevronDown, Highlighter } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@wizard-archive/ui/shadcn/components/popover'
import { CheckerboardSwatch } from '@wizard-archive/ui/components/checkerboard-swatch'
import { ColorIcon } from './color-icon'
import {
  RICH_TEXT_COLOR_PRESETS,
  RICH_TEXT_HIGHLIGHT_PRESETS,
} from '../blocknote/rich-text-selection-colors'
import { paintColorValuesEqual } from '@wizard-archive/ui/utils/paint-color-values'
import { preventEditorBlur, stopPropagation } from './formatting-toolbar-events'
import type { CSSProperties } from 'react'
import type { ToolbarSnapshot } from './formatting-toolbar-model'

const FLOATING_FORMATTING_COLOR_PALETTE_Z_INDEX = 70
const TEXT_COLOR_OPTIONS = RICH_TEXT_COLOR_PRESETS.map(({ label, surfaceColor, value }) => ({
  label,
  surfaceColor,
  value: value.color,
}))

type FormattingColorKind = 'background' | 'text'
type FormattingColorOption = {
  displayColor?: string
  label: string
  surfaceColor?: string
  value: string
}
type ActiveTextColorValue = Extract<ToolbarSnapshot['activeTextColor'], { kind: 'value' }>['value']
type ColorControlsProps =
  | {
      activeColor: ToolbarSnapshot['activeTextColor'] | string
      disabled: boolean
      kind: 'text'
      label: string
      onColorChange: (color: string) => void
    }
  | {
      activeColor: string
      disabled: boolean
      kind: 'background'
      label: string
      onColorChange: (color: string) => void
    }

export function ColorControls({
  activeColor,
  disabled,
  kind,
  label,
  onColorChange,
}: ColorControlsProps) {
  const [open, setOpen] = useState(false)
  const activeTextValue =
    typeof activeColor === 'string'
      ? undefined
      : activeColor.kind === 'value'
        ? activeColor.value
        : undefined
  const activeValue = typeof activeColor === 'string' ? activeColor : activeTextValue?.color
  const mixed = typeof activeColor !== 'string' && activeColor.kind === 'mixed'
  const triggerLabel = mixed ? `${label} (mixed values)` : label
  const options: ReadonlyArray<FormattingColorOption> =
    kind === 'text' ? TEXT_COLOR_OPTIONS : RICH_TEXT_HIGHLIGHT_PRESETS

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2"
            aria-label={triggerLabel}
            disabled={disabled}
            title={triggerLabel}
            onMouseDown={preventEditorBlur}
          >
            <ColorControlIcon
              activeValue={activeValue}
              kind={kind}
              mixed={mixed}
              options={options}
            />
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        }
      />
      <ColorPalette
        activeTextValue={activeTextValue}
        activeValue={activeValue}
        disabled={disabled}
        kind={kind}
        label={label}
        onColorChange={onColorChange}
        options={options}
      />
    </Popover>
  )
}

function ColorControlIcon({
  activeValue,
  kind,
  mixed,
  options,
}: {
  activeValue: string | undefined
  kind: FormattingColorKind
  mixed: boolean
  options: ReadonlyArray<FormattingColorOption>
}) {
  if (kind === 'background') {
    return (
      <Highlighter
        className="size-4"
        style={{ color: getHighlighterIconColor(activeValue, options) }}
      />
    )
  }

  return <ColorIcon textColor={!mixed ? activeValue : undefined} size={18} />
}

function ColorPalette({
  activeTextValue,
  activeValue,
  disabled,
  kind,
  label,
  onColorChange,
  options,
}: {
  activeTextValue: ActiveTextColorValue | undefined
  activeValue: string | undefined
  disabled: boolean
  kind: FormattingColorKind
  label: string
  onColorChange: (color: string) => void
  options: ReadonlyArray<FormattingColorOption>
}) {
  return (
    <PopoverContent
      align="center"
      className="w-auto min-w-0 overflow-visible p-2"
      style={{ zIndex: FLOATING_FORMATTING_COLOR_PALETTE_Z_INDEX }}
      aria-label={`${label} palette`}
      data-formatting-color-palette=""
      initialFocus={false}
      finalFocus={false}
      onMouseDownCapture={preventEditorBlur}
      onPointerDownCapture={preventEditorBlur}
      onPointerUpCapture={stopPropagation}
      onClick={stopPropagation}
    >
      <div className="grid grid-cols-5 gap-1">
        {options.map((preset) => (
          <ColorOptionButton
            key={`${preset.label}-${preset.value}`}
            activeTextValue={activeTextValue}
            activeValue={activeValue}
            disabled={disabled}
            kind={kind}
            onColorChange={onColorChange}
            preset={preset}
          />
        ))}
      </div>
    </PopoverContent>
  )
}

function ColorOptionButton({
  activeTextValue,
  activeValue,
  disabled,
  kind,
  onColorChange,
  preset,
}: {
  activeTextValue: ActiveTextColorValue | undefined
  activeValue: string | undefined
  disabled: boolean
  kind: FormattingColorKind
  onColorChange: (color: string) => void
  preset: FormattingColorOption
}) {
  const isActive = colorOptionIsActive({
    activeTextValue,
    activeValue,
    kind,
    preset,
  })

  return (
    <button
      type="button"
      aria-pressed={isActive}
      aria-label={getColorOptionAriaLabel(kind, preset)}
      disabled={disabled}
      title={preset.label}
      className="group/formatting-color-option flex size-10 items-center justify-center overflow-hidden rounded-md border p-0 outline-none hover:bg-(--formatting-color-surface) focus:bg-(--formatting-color-surface) focus:text-foreground active:bg-(--formatting-color-pressed) aria-pressed:bg-(--formatting-color-surface) focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1"
      style={getColorOptionStyle(kind, preset, isActive)}
      onMouseDown={preventEditorBlur}
      onPointerDown={preventEditorBlur}
      onClick={(event) => {
        stopPropagation(event)
        onColorChange(preset.value)
      }}
    >
      <ColorOptionPreview kind={kind} preset={preset} />
    </button>
  )
}

function getHighlighterIconColor(
  activeValue: string | undefined,
  options: ReadonlyArray<FormattingColorOption>,
) {
  if (!activeValue || activeValue === 'default') {
    return 'var(--muted-foreground)'
  }

  const activeOption = options.find((option) => option.value === activeValue)
  return activeOption ? getColorOptionDisplayColor(activeOption) : activeValue
}

function colorOptionIsActive({
  activeTextValue,
  activeValue,
  kind,
  preset,
}: {
  activeTextValue: ActiveTextColorValue | undefined
  activeValue: string | undefined
  kind: FormattingColorKind
  preset: FormattingColorOption
}) {
  if (kind === 'text' && activeTextValue) {
    return paintColorValuesEqual(activeTextValue, {
      color: preset.value,
      opacity: 100,
    })
  }

  return activeValue === preset.value
}

function getColorOptionAriaLabel(kind: FormattingColorKind, preset: FormattingColorOption) {
  if (isClearHighlightOption(kind, preset)) {
    return 'Select No highlight'
  }

  return `Select ${preset.label} ${kind === 'text' ? 'text' : 'highlight'} color`
}

function getColorOptionStyle(
  kind: FormattingColorKind,
  preset: FormattingColorOption,
  isActive: boolean,
): CSSProperties {
  const borderColor = getColorOptionBorderColor(kind, preset)

  return {
    borderColor,
    ...getColorOptionStateVariables(kind, preset),
    boxShadow: isActive ? `0 0 0 2px ${borderColor}` : 'none',
  }
}

function getColorOptionStateVariables(
  kind: FormattingColorKind,
  preset: FormattingColorOption,
): CSSProperties {
  if (isClearHighlightOption(kind, preset)) {
    return {
      '--formatting-color-pressed': 'color-mix(in srgb, var(--border) 40%, transparent)',
      '--formatting-color-surface': 'color-mix(in srgb, var(--border) 24%, transparent)',
    } as CSSProperties
  }

  return {
    '--formatting-color-pressed': getTransparentColor(getColorOptionSurfaceColor(kind, preset), 52),
    '--formatting-color-surface': getTransparentColor(getColorOptionSurfaceColor(kind, preset), 40),
  } as CSSProperties
}

function getColorOptionBorderColor(kind: FormattingColorKind, preset: FormattingColorOption) {
  const borderColor = isClearHighlightOption(kind, preset)
    ? 'var(--border)'
    : getColorOptionDisplayColor(preset)

  return `color-mix(in srgb, ${borderColor} 70%, transparent)`
}

function getColorOptionDisplayColor(preset: FormattingColorOption) {
  return preset.displayColor ?? preset.value
}

function getColorOptionSurfaceColor(kind: FormattingColorKind, preset: FormattingColorOption) {
  return kind === 'background' ? preset.value : (preset.surfaceColor ?? preset.value)
}

function ColorOptionPreview({
  kind,
  preset,
}: {
  kind: FormattingColorKind
  preset: FormattingColorOption
}) {
  if (isClearHighlightOption(kind, preset)) {
    return <CheckerboardSwatch className="size-full" />
  }

  if (kind === 'background') {
    return (
      <span
        className="flex size-full items-center justify-center"
        style={{ backgroundColor: getTransparentColor(preset.value, 28) }}
      >
        <Highlighter
          className="size-4"
          stroke={getColorOptionDisplayColor(preset)}
          style={{ color: getColorOptionDisplayColor(preset) }}
        />
      </span>
    )
  }

  return (
    <span className="text-lg font-semibold leading-none" style={{ color: preset.value }}>
      A
    </span>
  )
}

function getTransparentColor(color: string, intensity: number) {
  return `color-mix(in srgb, ${color} ${intensity}%, transparent)`
}

function isClearHighlightOption(kind: FormattingColorKind, preset: FormattingColorOption) {
  return kind === 'background' && preset.value === 'default'
}
