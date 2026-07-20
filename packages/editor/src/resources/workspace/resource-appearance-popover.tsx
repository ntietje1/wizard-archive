import { useState } from 'react'
import type { ReactElement } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@wizard-archive/ui/shadcn/components/popover'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import type { WorkspaceActions } from './resource-operations'
import { RESOURCE_ICONS } from './resource-icon'
import { resourceKindIcon } from './resource-presentation'

const COLORS = [
  { label: 'Default', value: null },
  { label: 'Gray', value: '#94a3b8' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Cyan', value: '#22b8cf' },
  { label: 'Green', value: '#4fbf8f' },
  { label: 'Yellow', value: '#f5c400' },
  { label: 'Orange', value: '#fb923c' },
  { label: 'Pink', value: '#f5b7b1' },
  { label: 'Red', value: '#f15b64' },
] as const

export function ResourceAppearancePopover({
  actions,
  align = 'start',
  resource,
  side = 'right',
  trigger,
}: {
  actions: WorkspaceActions
  align?: 'center' | 'end' | 'start'
  resource: AuthorizedResourceSummary
  side?: 'bottom' | 'left' | 'right' | 'top'
  trigger: ReactElement
}) {
  const [pending, setPending] = useState(false)
  const update = async (values: { color?: string | null; icon?: string | null }) => {
    setPending(true)
    await actions.update(resource.id, {
      ...(values.icon === undefined ? {} : { icon: values.icon ?? '' }),
      ...(values.color === undefined ? {} : { color: values.color ?? '' }),
    })
    setPending(false)
  }
  const DefaultIcon = resourceKindIcon(resource.kind)
  return (
    <Popover>
      <PopoverTrigger nativeButton render={trigger} />
      <PopoverContent
        data-resource-appearance
        role="dialog"
        aria-label={`Edit icon and color for ${resource.title}`}
        align={align}
        side={side}
        sideOffset={4}
        className="w-72 gap-3 p-3"
      >
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Color</p>
          <div className="flex gap-2">
            {COLORS.map((color) => (
              <button
                key={color.label}
                type="button"
                aria-label={`${color.label} resource color`}
                aria-pressed={(resource.color ?? null) === color.value}
                disabled={pending}
                className="flex size-7 items-center justify-center rounded-full ring-offset-2 hover:ring-2 hover:ring-ring aria-pressed:ring-2 aria-pressed:ring-ring disabled:opacity-50"
                onClick={() => void update({ color: color.value })}
              >
                <span
                  className="size-5 rounded-full border border-border"
                  style={{ backgroundColor: color.value ?? 'var(--muted-foreground)' }}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Icon</p>
          <div className="grid grid-cols-7 gap-1">
            <button
              type="button"
              aria-label="Default resource icon"
              aria-pressed={resource.icon === null}
              disabled={pending}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground disabled:opacity-50"
              onClick={() => void update({ icon: null })}
            >
              <DefaultIcon className="size-4" />
            </button>
            {Object.entries(RESOURCE_ICONS).map(([name, Icon]) => (
              <button
                key={name}
                type="button"
                aria-label={`${name} resource icon`}
                aria-pressed={resource.icon === name}
                disabled={pending}
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground disabled:opacity-50"
                onClick={() => void update({ icon: name })}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
