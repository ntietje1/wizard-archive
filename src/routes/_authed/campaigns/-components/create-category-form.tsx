import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'
import { Button } from '~/components/shadcn/ui/button'
import { cn } from '~/lib/utils'
import { ColorPicker } from '~/components/forms/category-tag-dialogs/base-tag-dialog/color-picker'
import { getCategoryIcon, getNonDefaultCategoryIcons } from '~/lib/category-icons'

interface CreateCategoryFormProps {
  campaignId: string
  onClose: () => void
}

export function CreateCategoryForm({ campaignId, onClose }: CreateCategoryFormProps) {
  const createCategory = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.createTagCategory),
  })

  const iconOptions = getNonDefaultCategoryIcons()

  const form = useForm({
    defaultValues: {
      displayName: '',
      pluralDisplayName: '',
      iconName: 'TagIcon',
      defaultColor: '#ef4444',
    },
    onSubmit: async ({ value }) => {
      if (!value.displayName.trim() || !value.pluralDisplayName.trim()) return
      await createCategory.mutateAsync({
        campaignId: campaignId as any,
        displayName: value.displayName.trim(),
        pluralDisplayName: value.pluralDisplayName.trim(),
        iconName: value.iconName,
        defaultColor: value.defaultColor,
      })
      onClose()
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
      <form.Field name="displayName">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="category-name">Category Name</Label>
            <Input
              id="category-name"
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
            <Label htmlFor="category-plural">Plural Name</Label>
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
          displayName: s.values.displayName,
          pluralDisplayName: s.values.pluralDisplayName,
        })}
      >
        {({ displayName, pluralDisplayName }) => {
          const isDisabled = !displayName.trim() || !pluralDisplayName.trim()
          return (
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isDisabled}>
                Create
              </Button>
            </div>
          )
        }}
      </form.Subscribe>
    </form>
  )
}
