import { useId } from 'react'
import type { ResourceColor, ResourceIconName } from '../../workspace/resource-contract'

import { ColorPicker } from '../../workspace/sidebar/forms/color-picker'
import { IconPicker } from '../../workspace/sidebar/forms/icon-picker'
import { Label } from '@wizard-archive/ui/shadcn/components/label'
import { getIconByName } from '../../workspace/sidebar/item-icons'

interface SidebarItemMetadataControlsProps {
  color: ResourceColor | null
  defaultIcon: ResourceIconName
  fallbackName: string
  iconName: ResourceIconName | null
  name: string
  onColorChange: (color: ResourceColor | null) => void
  onIconNameChange: (iconName: ResourceIconName | null) => void
}

export function SidebarItemMetadataControls({
  color,
  defaultIcon,
  fallbackName,
  iconName,
  name,
  onColorChange,
  onIconNameChange,
}: SidebarItemMetadataControlsProps) {
  const PreviewIcon = getIconByName(iconName ?? defaultIcon)
  const iconLabelId = useId()
  const colorLabelId = useId()

  return (
    <div className="flex items-end gap-4">
      <div className="space-y-2">
        <Label id={iconLabelId}>Icon</Label>
        <IconPicker
          value={iconName ?? undefined}
          onChange={onIconNameChange}
          defaultIcon={defaultIcon}
          triggerLabelledBy={iconLabelId}
        />
      </div>

      <div className="space-y-2">
        <Label id={colorLabelId}>Color</Label>
        <ColorPicker value={color} onChange={onColorChange} triggerLabelledBy={colorLabelId} />
      </div>

      <div className="flex-1">
        <Label className="text-muted-foreground text-xs">Preview</Label>
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <PreviewIcon className="size-4 flex-shrink-0" />
          <span className="truncate text-sm">{name || fallbackName}</span>
        </div>
      </div>
    </div>
  )
}
