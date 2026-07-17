import type { KeyboardEvent, SyntheticEvent } from 'react'
import { BASE_STROKE_COLORS } from '@wizard-archive/ui/utils/color'
import { CheckerboardSwatch } from '@wizard-archive/ui/components/checkerboard-swatch'
import { ColorPickerPopover } from '@wizard-archive/ui/components/color-picker-popover'
import type {
  CanvasInteractionController,
  CanvasInteractionSnapshot,
} from './interaction-controller'
import type { CanvasToolSettings } from './interaction-types'

const EDGE_TYPE_OPTIONS = [
  { type: 'bezier', label: 'Bezier' },
  { type: 'straight', label: 'Straight' },
  { type: 'step', label: 'Step' },
] as const

export function CanvasToolProperties({
  canEdit,
  interaction,
  interactionController,
}: {
  canEdit: boolean
  interaction: CanvasInteractionSnapshot
  interactionController: CanvasInteractionController
}) {
  const hasSelection =
    interaction.selection.nodeIds.size > 0 || interaction.selection.edgeIds.size > 0
  if (
    !canEdit ||
    hasSelection ||
    (interaction.tool !== 'draw' && interaction.tool !== 'edge') ||
    interaction.interaction.type === 'selecting'
  ) {
    return null
  }

  const setSettings = (settings: Partial<CanvasToolSettings>) =>
    interactionController.setToolSettings({
      ...interactionController.get().toolSettings,
      ...settings,
    })

  return (
    <div
      className="absolute top-4 left-4 z-10 flex cursor-default select-none flex-col gap-1 rounded-lg border bg-background/80 p-2 shadow-sm backdrop-blur-sm"
      role="toolbar"
      aria-label="Canvas conditional toolbar"
    >
      <div className="flex flex-col gap-1" role="group" aria-label="Stroke">
        <p className="text-[11px] font-medium text-muted-foreground">Stroke</p>
        <div className="flex items-center gap-1">
          {BASE_STROKE_COLORS.map((preset) => (
            <button
              key={preset.color}
              type="button"
              className="h-6 w-6 cursor-pointer rounded-sm border border-border transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              style={{
                outline:
                  interaction.toolSettings.strokeColor === preset.color
                    ? '2px solid var(--primary)'
                    : 'none',
                outlineOffset: '1px',
              }}
              aria-label={`Select ${preset.label} color`}
              aria-pressed={interaction.toolSettings.strokeColor === preset.color}
              title={preset.label}
              onPointerDown={preventToolbarFocus}
              onClick={() => setSettings({ strokeColor: preset.color })}
            >
              <CheckerboardSwatch className="h-full w-full rounded-sm">
                <span
                  className="block h-full w-full rounded-sm"
                  style={{
                    backgroundColor: preset.color,
                    opacity: interaction.toolSettings.strokeOpacity / 100,
                  }}
                />
              </CheckerboardSwatch>
            </button>
          ))}
          <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
          <div onPointerDown={preventToolbarFocus}>
            <ColorPickerPopover
              value={{
                color: interaction.toolSettings.strokeColor,
                opacity: interaction.toolSettings.strokeOpacity,
              }}
              onChange={({ color, opacity }) =>
                setSettings({ strokeColor: color, strokeOpacity: opacity })
              }
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1" role="group" aria-label="Stroke size">
        <p className="text-[11px] font-medium text-muted-foreground">Stroke size</p>
        <StrokeSizeControl settings={interaction.toolSettings} onChange={setSettings} />
      </div>

      {interaction.tool === 'edge' ? (
        <>
          <div className="my-1 h-px w-full bg-border" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-medium text-muted-foreground">Edge type</p>
            <div className="flex items-center gap-1">
              {EDGE_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  className={`flex h-8 cursor-pointer items-center justify-center rounded-md px-2 text-xs font-medium hover:bg-accent ${
                    interaction.toolSettings.edgeType === option.type ? 'bg-accent' : ''
                  }`}
                  aria-label={`Change edge type to ${option.label}`}
                  aria-pressed={interaction.toolSettings.edgeType === option.type}
                  title={option.label}
                  onClick={() => setSettings({ edgeType: option.type })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function StrokeSizeControl({
  onChange,
  settings,
}: {
  onChange: (settings: Partial<CanvasToolSettings>) => void
  settings: CanvasToolSettings
}) {
  return (
    <div className="flex min-w-[19.8125rem] items-center gap-1">
      <input
        aria-label="Stroke size"
        className="h-6 min-w-0 grow cursor-pointer accent-primary"
        max={50}
        min={1}
        step={1}
        type="range"
        value={Math.min(settings.strokeSize, 50)}
        onChange={(event) => onChange({ strokeSize: Number(event.currentTarget.value) })}
      />
      <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
      <div className="flex size-6 shrink-0 items-center justify-center rounded-sm border border-border focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1">
        <input
          key={settings.strokeSize}
          aria-label="Stroke size input"
          className="block h-full w-full appearance-none bg-transparent p-0 text-center text-xs leading-6 tabular-nums outline-none"
          defaultValue={settings.strokeSize}
          inputMode="decimal"
          maxLength={5}
          type="text"
          onBlur={commitStrokeSize(onChange)}
          onKeyDown={(event) => handleStrokeSizeKey(event, onChange)}
        />
      </div>
    </div>
  )
}

function commitStrokeSize(onChange: (settings: Partial<CanvasToolSettings>) => void) {
  return (event: { currentTarget: HTMLInputElement }) => {
    const next = Number(event.currentTarget.value)
    if (Number.isFinite(next) && next >= 1 && next <= 99) {
      onChange({ strokeSize: next })
      return
    }
    event.currentTarget.value = event.currentTarget.defaultValue
  }
}

function handleStrokeSizeKey(
  event: KeyboardEvent<HTMLInputElement>,
  onChange: (settings: Partial<CanvasToolSettings>) => void,
) {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitStrokeSize(onChange)(event)
    event.currentTarget.blur()
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    event.currentTarget.value = event.currentTarget.defaultValue
    event.currentTarget.blur()
  }
}

function preventToolbarFocus(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}
