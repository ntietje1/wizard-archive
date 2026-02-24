import { useCallback, useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { Loader } from 'lucide-react'
import { FormDialog } from '../base-form/form-dialog'
import { IconPicker } from './icon-picker'
import { ColorPicker } from './color-picker'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { useNameValidation } from '~/hooks/useNameValidation'
import { useNavigateOnSlugChange } from '~/hooks/useNavigateOnSlugChange'
import { Label } from '~/components/shadcn/ui/label'
import { Button } from '~/components/shadcn/ui/button'
import { FileEdit } from '~/lib/icons'
import { getIconByName } from '~/lib/category-icons'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '~/components/shadcn/ui/input-group'

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
    case SIDEBAR_ITEM_TYPES.notes:
      return 'Note'
    case SIDEBAR_ITEM_TYPES.folders:
      return 'Folder'
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return 'Map'
    case SIDEBAR_ITEM_TYPES.files:
      return 'File'
    default:
      return 'Item'
  }
}

// TODO: move this to a shared utility file
// Get the default icon name for an item type
function getDefaultIconName(type: SidebarItemType): string {
  switch (type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return 'FileText'
    case SIDEBAR_ITEM_TYPES.folders:
      return 'Folder'
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return 'MapPin'
    case SIDEBAR_ITEM_TYPES.files:
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
  const { navigateIfSlugChanged } = useNavigateOnSlugChange()

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
        const previousSlug = item.slug
        const response = await updateMutation.mutateAsync({
          campaignId: item.campaignId,
          itemId: item._id,
          name: value.name || undefined,
          iconName: value.iconName,
          color: value.color,
        })

        navigateIfSlugChanged({
          itemId: item._id,
          itemType: item.type,
          previousSlug,
          newSlug: response.slug,
          updatedItem: {
            ...item,
            slug: response.slug,
            name: value.name || item.name,
          },
        })

        toast.success(`${getTypeName(item.type)} updated`)
        onClose()
      } catch (error) {
        console.error('Failed to update item:', error)
        toast.error('Failed to update item')
      }
    },
  })

  const { checkNameUnique } = useNameValidation({
    name: form.state.values.name,
    initialName: item.name ?? '',
    isActive: isOpen,
    campaignId: item.campaignId,
    parentId: item.parentId,
    excludeId: item._id,
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
        <form.Field
          name="name"
          validators={{
            onChangeAsync: ({ value }) => checkNameUnique(value),
            onChangeAsyncDebounceMs: 300,
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <InputGroup>
                <InputGroupInput
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={`Enter ${typeName.toLowerCase()} name`}
                  autoFocus
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                {field.state.meta.isValidating && (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton className="rounded-full" size="icon-xs">
                      <Loader className="size-4 animate-spin" />
                    </InputGroupButton>
                  </InputGroupAddon>
                )}
              </InputGroup>
              {field.state.meta.errors[0] && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
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
        <form.Subscribe selector={(s) => s.canSubmit}>
          {(canSubmit) => (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={form.state.isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.state.isSubmitting || !canSubmit}
              >
                {form.state.isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </form.Subscribe>
      </form>
    </FormDialog>
  )
}
