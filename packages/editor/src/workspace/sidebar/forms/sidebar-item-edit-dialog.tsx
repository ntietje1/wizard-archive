import { useId, useState } from 'react'
import type { AnyItem } from '../../items'
import type { ResourceColor, ResourceIconName } from '../../resource-contract'

import {
  DEFAULT_SIDEBAR_ITEM_COLOR,
  DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE,
} from '../../items/appearance'
import { toast } from 'sonner'
import { FileEdit, Loader } from 'lucide-react'
import { ColorPicker } from './color-picker'
import { IconPicker } from './icon-picker'
import { handleError } from '../../../errors/handle-error'
import { getSidebarItemTypeLabel } from '../item-type-label'
import { FormDialog } from '@wizard-archive/ui/components/form-dialog'
import { useNameValidation } from '../../../filesystem/use-name-validation'
import type { EditFileSystemItemFn } from '../../../filesystem/edit-item'
import { Label } from '@wizard-archive/ui/shadcn/components/label'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { getIconByName } from '../item-icons'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@wizard-archive/ui/shadcn/components/input-group'
import { useSidebarNameValidator } from '../hooks/use-sidebar-name-validator'

interface SidebarItemEditFormValues {
  name: string
  iconName: ResourceIconName | null
  color: ResourceColor | null
}

interface SidebarItemEditDialogProps {
  item: AnyItem
  isOpen: boolean
  onClose: () => void
  editItem: EditFileSystemItemFn
}

export function SidebarItemEditDialog({
  item,
  isOpen,
  onClose,
  editItem,
}: SidebarItemEditDialogProps) {
  if (!isOpen) return null

  return (
    <OpenSidebarItemEditDialog key={item.id} item={item} onClose={onClose} editItem={editItem} />
  )
}

function OpenSidebarItemEditDialog({
  item,
  onClose,
  editItem,
}: Omit<SidebarItemEditDialogProps, 'isOpen'>) {
  const iconLabelId = useId()
  const colorLabelId = useId()
  const [values, setValues] = useState(() => getSidebarItemEditFormValues(item))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const validateName = useSidebarNameValidator()

  const nameValidation = useNameValidation({
    name: values.name,
    initialName: item.name ?? '',
    isActive: true,
    parentId: item.parentId,
    excludeId: item.id,
    validateName,
  })

  const handleClose = () => {
    if (isSubmitting) return
    onClose()
  }

  const typeName = getSidebarItemTypeLabel(item.type)
  const defaultIconName = DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE[item.type]
  const nameErrors = nameValidation.validationError ? [nameValidation.validationError] : []
  const isNameValidating = values.name.trim() !== nameValidation.debouncedName
  const PreviewIcon = getIconByName(values.iconName ?? defaultIconName)

  function updateValues(nextValues: Partial<SidebarItemEditFormValues>) {
    setValues((current) => ({ ...current, ...nextValues }))
  }

  async function saveChanges() {
    if (nameErrors.length > 0 || isNameValidating || isSubmitting) return

    try {
      setIsSubmitting(true)
      await editItem({
        item,
        name: values.name.trim() || undefined,
        iconName: values.iconName,
        color: values.color,
      })

      toast.success(`${typeName} updated`)
      onClose()
    } catch (error) {
      handleError(error, 'Failed to save changes')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <FormDialog
      isOpen
      onClose={handleClose}
      title={`Edit ${typeName}`}
      description={`Update ${typeName.toLowerCase()} appearance and settings`}
      icon={FileEdit}
    >
      <form action={() => void saveChanges()} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="item-name">Name</Label>
          <InputGroup>
            <InputGroupInput
              id="item-name"
              value={values.name}
              onChange={(event) => updateValues({ name: event.target.value })}
              placeholder={`Enter ${typeName.toLowerCase()} name`}
              autoFocus
              aria-invalid={nameErrors.length > 0}
            />
            {isNameValidating && (
              <InputGroupAddon align="inline-end">
                <span
                  role="status"
                  aria-label="Validating name"
                  className="flex size-6 items-center justify-center rounded-full"
                >
                  <Loader className="size-4 animate-spin" />
                </span>
              </InputGroupAddon>
            )}
          </InputGroup>
          {nameErrors[0] && <p className="text-sm text-destructive">{nameErrors[0]}</p>}
        </div>

        <div className="flex items-end gap-4">
          <div className="space-y-2">
            <Label id={iconLabelId}>Icon</Label>
            <IconPicker
              value={values.iconName ?? undefined}
              onChange={(iconName) => updateValues({ iconName })}
              defaultIcon={defaultIconName}
              triggerLabelledBy={iconLabelId}
            />
          </div>

          <div className="space-y-2">
            <Label id={colorLabelId}>Color</Label>
            <ColorPicker
              value={values.color}
              onChange={(color) => updateValues({ color })}
              triggerLabelledBy={colorLabelId}
            />
          </div>

          <div className="flex-1">
            <Label className="text-muted-foreground text-xs">Preview</Label>
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
              <PreviewIcon
                className="size-4 flex-shrink-0"
                style={{ color: values.color ?? DEFAULT_SIDEBAR_ITEM_COLOR }}
              />
              <span className="truncate text-sm">{values.name || `Untitled ${typeName}`}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isNameValidating || nameErrors.length > 0}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </FormDialog>
  )
}

function getSidebarItemEditFormValues(item: AnyItem): SidebarItemEditFormValues {
  return {
    name: item.name ?? '',
    iconName: item.iconName ?? null,
    color: item.color ?? null,
  }
}
