import { useCallback, useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { FormDialog } from '../base-form/form-dialog'
import { IconPicker } from './icon-picker'
import { ColorPicker } from './color-picker'
import type { AnySidebarItem, SidebarItemType } from 'convex/sidebarItems/types'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'
import { Button } from '~/components/shadcn/ui/button'
import { FileEdit } from '~/lib/icons'
import { getIconByName } from '~/lib/category-icons'

interface SidebarItemEditFormValues {
  name: string
  iconName: string | null
  color: string | null
}

interface SidebarItemEditDialogProps {
  item: AnySidebarItem
  isOpen: boolean
  onClose: () => void
}

// TODO: move this to a shared utility file
// Get a human-readable type name for the dialog title
function getTypeName(type: SidebarItemType): string {
  switch (type) {
    case 'notes':
      return 'Note'
    case 'folders':
      return 'Folder'
    case 'gameMaps':
      return 'Map'
    case 'files':
      return 'File'
    default:
      return 'Item'
  }
}

// TODO: move this to a shared utility file
// Get the default icon name for an item type
function getDefaultIconName(type: SidebarItemType): string {
  switch (type) {
    case 'notes':
      return 'FileText'
    case 'folders':
      return 'Folder'
    case 'gameMaps':
      return 'MapPin'
    case 'files':
      return 'File'
    default:
      return 'FileText'
  }
}

export function SidebarItemEditDialog({
  item,
  isOpen,
  onClose,
}: SidebarItemEditDialogProps) {
  const updateMutation = useMutation({
    mutationFn: useConvexMutation(api.sidebarItems.mutations.updateSidebarItem),
  })

  const getInitialValues = useCallback((): SidebarItemEditFormValues => {
    return {
      name: item.name ?? '',
      iconName: item.iconName ?? null,
      color: item.color ?? null,
    }
  }, [item])

  const form = useForm({
    defaultValues: getInitialValues(),
    onSubmit: async ({ value }) => {
      try {
        await updateMutation.mutateAsync({
          itemId: item._id,
          name: value.name || undefined,
          iconName: value.iconName,
          color: value.color,
        })
        toast.success(`${getTypeName(item.type)} updated`)
        onClose()
      } catch (error) {
        console.error('Failed to update item:', error)
        toast.error('Failed to update item')
      }
    },
  })

  // Reset form when item changes
  useEffect(() => {
    form.reset(getInitialValues())
  }, [item._id, form, getInitialValues])

  const handleClose = () => {
    if (form.state.isSubmitting) return
    onClose()
  }

  if (!isOpen) return null

  const typeName = getTypeName(item.type)
  const defaultIconName = getDefaultIconName(item.type)

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={`Edit ${typeName}`}
      description={`Update ${typeName.toLowerCase()} appearance and settings`}
      icon={FileEdit}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        className="space-y-4"
      >
        {/* Name Field */}
        <form.Field name="name">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder={`Enter ${typeName.toLowerCase()} name`}
                disabled={form.state.isSubmitting}
                autoFocus
              />
            </div>
          )}
        </form.Field>

        {/* Icon and Color Row */}
        <div className="flex items-end gap-4">
          {/* Icon Field */}
          <form.Field name="iconName">
            {(field) => (
              <div className="space-y-2">
                <Label>Icon</Label>
                <IconPicker
                  value={field.state.value ?? undefined}
                  onChange={(iconName) => field.handleChange(iconName)}
                  defaultIcon={defaultIconName}
                />
              </div>
            )}
          </form.Field>

          {/* Color Field */}
          <form.Field name="color">
            {(field) => (
              <div className="space-y-2">
                <Label>Color</Label>
                <ColorPicker
                  value={field.state.value}
                  onChange={(color) => field.handleChange(color)}
                />
              </div>
            )}
          </form.Field>

          {/* Preview */}
          <div className="flex-1">
            <Label className="text-muted-foreground text-xs">Preview</Label>
            <form.Subscribe selector={(s) => s.values}>
              {(values) => {
                const PreviewIcon = getIconByName(
                  values.iconName ?? defaultIconName,
                )
                return (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                    <PreviewIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate text-sm">
                      {values.name || `Untitled ${typeName}`}
                    </span>
                  </div>
                )
              }}
            </form.Subscribe>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={form.state.isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={form.state.isSubmitting}>
            {form.state.isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </FormDialog>
  )
}
