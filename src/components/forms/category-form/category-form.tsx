import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { useConvex, useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useCallback, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { CATEGORY_KIND } from 'convex/tags/types'
import { toast } from 'sonner'
import { MAX_NAME_LENGTH } from '../category-tag-form/base-tag-form/types'
import { validateCategoryDisplayName, validateCategoryName } from './validators'
import type { CategoryFormProps } from './types'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'
import { Button } from '~/components/shadcn/ui/button'
import { cn } from '~/lib/shadcn/utils'
import { ColorPicker } from '~/components/forms/category-tag-form/base-tag-form/color-picker'
import {
  getCategoryIcon,
  getNonDefaultCategoryIcons,
} from '~/lib/category-icons'
import { CategoryDeleteConfirmDialog } from '~/components/dialogs/delete/category-delete-confirm-dialog'

export function CategoryForm({
  mode,
  category,
  campaignId,
  onClose,
  onSuccess,
}: CategoryFormProps) {
  const convex = useConvex()
  const createCategory = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.createTagCategory),
  })

  const updateCategory = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.updateTagCategory),
  })

  const iconOptions = getNonDefaultCategoryIcons()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const isSystemCategory =
    mode === 'edit' && category?.kind === CATEGORY_KIND.SystemCore

  const getInitialValues = () => {
    if (mode === 'edit' && category) {
      return {
        name: category.name || '',
        iconName: category.iconName || 'TagIcon',
        defaultColor: category.defaultColor || '#ef4444',
      }
    }
    return {
      name: '',
      iconName: 'TagIcon',
      defaultColor: '#ef4444',
    }
  }

  const form = useForm({
    defaultValues: getInitialValues(),
    onSubmit: async ({ value }) => {
      // for system categories, we don't need to validate the name
      if (!isSystemCategory) {
        if (!validateCategoryName(value.name)) {
          return
        }
      }

      try {
        if (mode === 'create') {
          if (!campaignId) {
            toast.error('Campaign ID is required')
            return
          }
          const categoryId = await createCategory.mutateAsync({
            campaignId,
            name: value.name.trim(),
            iconName: value.iconName || 'TagIcon',
            defaultColor: value.defaultColor,
          })
          if (onSuccess) {
            try {
              const createdCategory = await convex.query(
                api.tags.queries.getTagCategory,
                {
                  campaignId,
                  categoryId,
                },
              )
              if (createdCategory?.slug) {
                onSuccess(createdCategory.slug)
              }
            } catch (error) {
              console.error('Failed to fetch created category:', error)
              onClose()
            }
          } else {
            onClose()
            toast.success('Category created successfully')
          }
        } else if (mode === 'edit' && category) {
          const result = await updateCategory.mutateAsync({
            categoryId: category._id,
            name: value.name.trim(),
            iconName: value.iconName,
            defaultColor: value.defaultColor,
          })
          if (onSuccess && result.slug) {
            onSuccess(result.slug)
          } else {
            toast.success('Category updated successfully')
            onClose()
          }
          return
        }
      } catch (error) {
        console.error(`Failed to ${mode} category:`, error)
        toast.error(`Failed to ${mode} category`)
      }
    },
  })

  const handleDeleteSuccess = useCallback(() => {
    onClose()
    setIsConfirmingDelete(false)
  }, [onClose])

  return (
    <>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        {!isSystemCategory && (
          <>
            <form.Field
              name="name"
              validators={{
                onMount: ({ value }: { value: string }) =>
                  validateCategoryDisplayName(value, MAX_NAME_LENGTH),
                onChange: ({ value }: { value: string }) =>
                  validateCategoryDisplayName(value, MAX_NAME_LENGTH),
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="category-name">Category Name*</Label>
                  <Input
                    id="category-name"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="e.g., Items, Locations, or Factions"
                    maxLength={MAX_NAME_LENGTH}
                  />
                  {field.state.meta.errors.length > 0 &&
                    field.state.meta.isTouched && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle size={14} />
                        {typeof field.state.meta.errors[0] === 'string'
                          ? field.state.meta.errors[0]
                          : 'Invalid category name'}
                      </p>
                    )}
                  {field.state.meta.errors.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {field.state.value.length}/{MAX_NAME_LENGTH}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="iconName">
              {(field) => (
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {iconOptions.map((name) => {
                      const Icon = getCategoryIcon(name)
                      const selected = field.state.value === name
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => field.handleChange(name)}
                          className={cn(
                            'border rounded-md p-2 flex items-center justify-center hover:bg-slate-50',
                            selected ? 'border-amber-500' : 'border-slate-200',
                          )}
                          aria-label={`Select ${name} icon`}
                        >
                          <Icon className="h-5 w-5" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </form.Field>
          </>
        )}

        {isSystemCategory && mode === 'edit' && category && (
          <div className="space-y-2">
            <Label>Category Name</Label>
            <div className="text-sm text-muted-foreground py-2 px-3 border rounded-md bg-slate-50">
              {category.name}
            </div>
            <p className="text-xs text-muted-foreground">
              System category names cannot be changed
            </p>
          </div>
        )}

        <form.Field
          name="defaultColor"
          validators={{
            onMount: ({ value }: { value: string }) =>
              !value ? 'Default color is required' : undefined,
            onChange: ({ value }: { value: string }) =>
              !value ? 'Default color is required' : undefined,
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <Label>Default Tag Color *</Label>
              <ColorPicker
                selectedColor={field.state.value || null}
                onColorChange={(c: string | null) => {
                  field.handleChange(c ?? '')
                }}
                allowDeselect={false}
              />
              {field.state.meta.errors.length > 0 &&
                field.state.meta.isTouched && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {typeof field.state.meta.errors[0] === 'string'
                      ? field.state.meta.errors[0]
                      : 'Default color is required'}
                  </p>
                )}
            </div>
          )}
        </form.Field>

        <form.Subscribe
          selector={(s) => ({
            canSubmit: s.canSubmit,
            isSubmitting: s.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => {
            return (
              <div className="flex justify-between gap-2 pt-2">
                <div>
                  {mode === 'edit' && !isSystemCategory && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setIsConfirmingDelete(true)}
                      disabled={isConfirmingDelete}
                    >
                      Delete
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!canSubmit || isSubmitting}>
                    {mode === 'create' ? 'Create' : 'Update'}
                  </Button>
                </div>
              </div>
            )
          }}
        </form.Subscribe>
      </form>
      {mode === 'edit' && category && (
        <CategoryDeleteConfirmDialog
          category={category}
          isDeleting={isConfirmingDelete}
          onClose={() => setIsConfirmingDelete(false)}
          onConfirm={handleDeleteSuccess}
        />
      )}
    </>
  )
}
