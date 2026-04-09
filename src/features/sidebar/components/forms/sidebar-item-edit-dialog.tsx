import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { FileEdit, Loader } from 'lucide-react'
import { getDefaultIconName, getTypeName } from '../../utils/sidebar-item-utils'
import { IconPicker } from './icon-picker'
import { ColorPicker } from './color-picker'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { handleError } from '~/shared/utils/logger'
import { FormDialog } from '~/shared/components/form-dialog'
import { useNameValidation } from '~/shared/hooks/useNameValidation'
import { useEditSidebarItem } from '~/features/sidebar/hooks/useEditSidebarItem'
import { Label } from '~/features/shadcn/components/label'
import { Button } from '~/features/shadcn/components/button'
import { getIconByName } from '~/shared/utils/category-icons'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '~/features/shadcn/components/input-group'

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

export function SidebarItemEditDialog({ item, isOpen, onClose }: SidebarItemEditDialogProps) {
  const { editItem } = useEditSidebarItem()

  const form = useForm({
    defaultValues: {
      name: item.name ?? '',
      iconName: item.iconName ?? null,
      color: item.color ?? null,
    } satisfies SidebarItemEditFormValues,
    onSubmit: async ({ value }) => {
      try {
        await editItem({
          item,
          name: value.name || undefined,
          iconName: value.iconName,
          color: value.color,
        })

        toast.success(`${getTypeName(item.type)} updated`)
        onClose()
      } catch (error) {
        handleError(error, 'Failed to save changes')
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

  useEffect(() => {
    form.reset({
      name: item.name ?? '',
      iconName: item.iconName ?? null,
      color: item.color ?? null,
    })
  }, [item._id, item.name, item.iconName, item.color, form])

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
          void form.handleSubmit()
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
                <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
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
                const PreviewIcon = getIconByName(values.iconName ?? defaultIconName)
                return (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                    <PreviewIcon
                      className="h-4 w-4 flex-shrink-0"
                      style={values.color ? { color: values.color } : undefined}
                    />
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
              <Button type="submit" disabled={form.state.isSubmitting || !canSubmit}>
                {form.state.isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </form.Subscribe>
      </form>
    </FormDialog>
  )
}
