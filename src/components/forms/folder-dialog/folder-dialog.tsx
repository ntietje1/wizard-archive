import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { FormDialog } from '../category-tag-form/base-tag-form/form-dialog'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'
import { FolderEdit, FolderPlus } from '~/lib/icons'
import { Button } from '~/components/shadcn/ui/button'

export interface FolderFormValues {
  name: string
}

type FolderDialogProps =
  | {
      mode: 'create'
      isOpen: boolean
      onClose: () => void
      onSubmit: (values: FolderFormValues) => Promise<void>
      folderId?: never
      initialName?: never
    }
  | {
      mode: 'edit'
      isOpen: boolean
      onClose: () => void
      onSubmit: (values: FolderFormValues) => Promise<void>
      folderId: string
      initialName: string
    }

export function FolderDialog({
  mode,
  isOpen,
  onClose,
  onSubmit,
  folderId,
  initialName,
}: FolderDialogProps) {
  const getInitialValues = (): FolderFormValues => {
    if (mode === 'edit' && initialName) {
      return { name: initialName }
    }
    return { name: '' }
  }

  const form = useForm({
    defaultValues: getInitialValues(),
    onSubmit: async ({ value }) => {
      await onSubmit(value)
      onClose()
    },
  })

  // Reset form when dialog mode/folder changes
  useEffect(() => {
    form.reset(getInitialValues())
  }, [mode, folderId, initialName])

  const handleClose = () => {
    if (form.state.isSubmitting) return
    onClose()
  }

  if (!isOpen) return null

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === 'create' ? 'New Folder' : 'Edit Folder'}
      description={
        mode === 'create'
          ? 'Create a new folder to organize your content.'
          : 'Update folder details'
      }
      icon={mode === 'create' ? FolderPlus : FolderEdit}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        className="space-y-4"
      >
        <form.Field name="name">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Enter folder name"
                disabled={form.state.isSubmitting}
                autoFocus
              />
            </div>
          )}
        </form.Field>

        <form.Subscribe
          selector={(s) => ({
            name: s.values.name,
          })}
        >
          {({ name }) => {
            const isDisabled = !name
            return (
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={form.state.isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isDisabled}>
                  {mode === 'create' ? 'Create' : 'Update'}
                </Button>
              </div>
            )
          }}
        </form.Subscribe>
      </form>
    </FormDialog>
  )
}
