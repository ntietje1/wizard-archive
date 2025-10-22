import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
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
import { useState } from 'react'
import { toast } from 'sonner'
import type { CategoryFormProps } from './types'
import { isFormValid } from './validators'

export function CategoryForm({
  mode,
  category,
  campaignId,
  onClose,
  onSuccess,
}: CategoryFormProps) {
  const createCategory = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.createTagCategory),
  })

  const updateCategory = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.updateTagCategory),
  })

  const iconOptions = getNonDefaultCategoryIcons()
  const [autoPluralize, setAutoPluralize] = useState(true)

  const handleAutoPluralizeToggle = (checked: boolean) => {
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
      if (
        !isFormValid(
          autoPluralize,
          value.categoryName,
          value.displayName,
          value.pluralDisplayName,
        )
      ) {
        return
      }

      try {
        if (mode === 'create') {
          if (!campaignId) {
            toast.error('Campaign ID is required')
            return
          }
          if (autoPluralize) {
            await createCategory.mutateAsync({
              campaignId: campaignId,
              categoryName: value.categoryName.trim(),
              iconName: value.iconName,
              defaultColor: value.defaultColor,
            })
          } else {
            await createCategory.mutateAsync({
              campaignId: campaignId,
              displayName: value.displayName.trim(),
              pluralDisplayName: value.pluralDisplayName.trim(),
              iconName: value.iconName,
              defaultColor: value.defaultColor,
            })
          }
          toast.success('Category created successfully')
        } else if (mode === 'edit' && category) {
          if (autoPluralize) {
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

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      {autoPluralize ? (
        <form.Field name="categoryName">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name*</Label>
              <Input
                id="category-name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="e.g., Items, Locations, or Faction"
              />
            </div>
          )}
        </form.Field>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <form.Field name="displayName">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="category-singular">Singular Name*</Label>
                <Input
                  id="category-singular"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="e.g., Item"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="pluralDisplayName">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="category-plural">Plural Name*</Label>
                <Input
                  id="category-plural"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="e.g., Items"
                />
              </div>
            )}
          </form.Field>
        </div>
      )}

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
          categoryName: s.values.categoryName,
          displayName: s.values.displayName,
          pluralDisplayName: s.values.pluralDisplayName,
        })}
      >
        {({ categoryName, displayName, pluralDisplayName }) => {
          const isDisabled = !isFormValid(
            autoPluralize,
            categoryName,
            displayName,
            pluralDisplayName,
          )
          return (
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
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
  )
}
