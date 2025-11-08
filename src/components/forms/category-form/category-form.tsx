import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { useConvex, useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'
import { Button } from '~/components/shadcn/ui/button'
import { cn } from '~/lib/utils'
import { ColorPicker } from '~/components/forms/category-tag-form/base-tag-form/color-picker'
import {
  getCategoryIcon,
  getNonDefaultCategoryIcons,
} from '~/lib/category-icons'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import type { CategoryFormProps } from './types'
import { validateCategoryName, validateCategoryDisplayName } from './validators'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { Trash2, AlertCircle } from 'lucide-react'
import { MAX_NAME_LENGTH } from '../category-tag-form/base-tag-form/types'
import { CATEGORY_KIND } from 'convex/tags/types'

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

  const deleteCategory = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.deleteTagCategory),
  })

  const iconOptions = getNonDefaultCategoryIcons()
  const [autoPluralize, setAutoPluralize] = useState(true)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const isSystemCategory =
    mode === 'edit' && category?.kind === CATEGORY_KIND.SystemCore

  // auto pluralize is always on in create mode
  const effectiveAutoPluralize = mode === 'create' ? true : autoPluralize

  const handleAutoPluralizeToggle = (checked: boolean) => {
    if (mode === 'create') return
    setAutoPluralize(checked)
    if (checked) {
      if (mode === 'edit' && category) {
        form.setFieldValue('categoryName', category.pluralDisplayName)
      }
      form.setFieldValue('displayName', '')
      form.setFieldValue('pluralDisplayName', '')
    } else {
      if (mode === 'edit' && category) {
        form.setFieldValue('displayName', category.displayName)
        form.setFieldValue('pluralDisplayName', category.pluralDisplayName)
      }
      form.setFieldValue('categoryName', '')
    }
  }

  const getInitialValues = () => {
    if (mode === 'edit' && category) {
      return {
        categoryName: category.pluralDisplayName,
        displayName: category.displayName,
        pluralDisplayName: category.pluralDisplayName,
        iconName: category.iconName,
        defaultColor: category.defaultColor || '#ef4444',
      }
    }
    return {
      categoryName: '',
      displayName: '',
      pluralDisplayName: '',
      iconName: 'TagIcon',
      defaultColor: '#ef4444',
    }
  }

  const form = useForm({
    defaultValues: getInitialValues(),
    onSubmit: async ({ value }) => {
      // for system categories, we don't need to validate the name
      if (!isSystemCategory) {
        if (
          !validateCategoryName(
            effectiveAutoPluralize,
            value.categoryName,
            value.displayName,
            value.pluralDisplayName,
          )
        ) {
          return
        }
      }

      try {
        if (mode === 'create') {
          if (!campaignId) {
            toast.error('Campaign ID is required')
            return
          }
          await createCategory.mutateAsync({
            campaignId: campaignId,
            name: {
              categoryName: value.categoryName.trim(),
            },
            iconName: value.iconName,
            defaultColor: value.defaultColor,
          })
          toast.success('Category created successfully')
        } else if (mode === 'edit' && category) {
          if (isSystemCategory) {
            // for system categories, we only update the color
            const result = await updateCategory.mutateAsync({
              categoryId: category._id,
              defaultColor: value.defaultColor,
            })
            toast.success('Category updated successfully')
            onClose()
            if (onSuccess && result.slug) {
              onSuccess(result.slug)
            }
          } else if (effectiveAutoPluralize) {
            const result = await updateCategory.mutateAsync({
              categoryId: category._id,
              categoryName: value.categoryName.trim(),
              iconName: value.iconName,
              defaultColor: value.defaultColor,
            })
            toast.success('Category updated successfully')
            onClose()
            if (onSuccess && result.slug) {
              onSuccess(result.slug)
            }
          } else {
            const result = await updateCategory.mutateAsync({
              categoryId: category._id,
              displayName: value.displayName.trim(),
              pluralDisplayName: value.pluralDisplayName.trim(),
              iconName: value.iconName,
              defaultColor: value.defaultColor,
            })
            toast.success('Category updated successfully')
            onClose()
            if (onSuccess && result.slug) {
              onSuccess(result.slug)
            }
          }
          return
        }
        onClose()
      } catch (error) {
        console.error(`Failed to ${mode} category:`, error)
        toast.error(`Failed to ${mode} category`)
      }
    },
  })

  const confirmDeleteCategory = useCallback(async () => {
    if (mode === 'edit' && category) {
      await deleteCategory
        .mutateAsync({ categoryId: category._id })
        .then(() => {
          toast.success('Category deleted successfully')
          onClose()
          setIsConfirmingDelete(false)
        })
        .catch((error: Error) => {
          console.error(error)
          toast.error('Failed to delete category')
        })
    }
  }, [deleteCategory, mode, category, onClose, setIsConfirmingDelete])

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
            {effectiveAutoPluralize ? (
              <form.Field
                name="categoryName"
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
                      placeholder="e.g., Items, Locations, or Faction"
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
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <form.Field
                  name="displayName"
                  validators={{
                    onMount: ({ value }: { value: string }) =>
                      validateCategoryDisplayName(value, MAX_NAME_LENGTH),
                    onChange: ({ value }: { value: string }) =>
                      validateCategoryDisplayName(value, MAX_NAME_LENGTH),
                  }}
                >
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="category-singular">Singular Name*</Label>
                      <Input
                        id="category-singular"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="e.g., Item"
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

                <form.Field
                  name="pluralDisplayName"
                  validators={{
                    onMount: ({ value }: { value: string }) =>
                      validateCategoryDisplayName(value, MAX_NAME_LENGTH),
                    onChange: ({ value }: { value: string }) =>
                      validateCategoryDisplayName(value, MAX_NAME_LENGTH),
                  }}
                >
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="category-plural">Plural Name*</Label>
                      <Input
                        id="category-plural"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="e.g., Items"
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
              </div>
            )}

            {mode === 'edit' && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="auto-pluralize"
                  checked={autoPluralize}
                  onChange={(e) => handleAutoPluralizeToggle(e.target.checked)}
                  className="w-3 h-3 rounded border-slate-300"
                />
                <Label
                  htmlFor="auto-pluralize"
                  className="text-xs cursor-pointer inline-flex items-center gap-2"
                >
                  Auto-detect singular/plural forms
                </Label>
              </div>
            )}

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
              {category.pluralDisplayName}
            </div>
            <p className="text-xs text-muted-foreground">
              System category names cannot be changed
            </p>
          </div>
        )}

        <form.Field name="defaultColor">
          {(field) => (
            <div className="space-y-2">
              <Label>Default Tag Color</Label>
              <ColorPicker
                selectedColor={field.state.value}
                onColorChange={(c: string) => field.handleChange(c)}
              />
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
      <ConfirmationDialog
        isOpen={isConfirmingDelete}
        onClose={() => setIsConfirmingDelete(false)}
        onConfirm={confirmDeleteCategory}
        title="Delete Category"
        description={`Are you sure you want to delete this category? This will also delete all tags and notes in this category. This action cannot be undone.`}
        confirmLabel="Delete Category"
        confirmVariant="destructive"
        icon={Trash2}
      />
    </>
  )
}
