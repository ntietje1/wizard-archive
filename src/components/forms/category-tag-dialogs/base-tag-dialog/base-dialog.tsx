import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useForm } from '@tanstack/react-form'
import { FormDialog } from '../../category-tag-form/base-tag-form/form-dialog'
import type { Tag } from 'convex/tags/types'
import type { TagCategoryConfig } from '../../category-tag-form/base-tag-form/types'

type BaseTagDialogProps<
  TTag extends Tag = Tag,
  TFormValues = Record<string, unknown>,
> =
  | {
      mode: 'create'
      isOpen: boolean
      onClose: () => void
      config: TagCategoryConfig
      tag?: never
      getInitialValues: (args: {
        mode: 'create' | 'edit'
        tag?: TTag
      }) => TFormValues
      onSubmit: (args: {
        mode: 'create' | 'edit'
        values: TFormValues
      }) => Promise<void>
      children: (args: { form: unknown; isSubmitting: boolean }) => ReactNode
    }
  | {
      mode: 'edit'
      isOpen: boolean
      onClose: () => void
      config: TagCategoryConfig
      tag: TTag
      getInitialValues: (args: {
        mode: 'create' | 'edit'
        tag?: TTag
      }) => TFormValues
      onSubmit: (args: {
        mode: 'create' | 'edit'
        values: TFormValues
      }) => Promise<void>
      children: (args: { form: any; isSubmitting: boolean }) => ReactNode
    }

export default function BaseTagDialog<
  TTag extends Tag = Tag,
  TFormValues = Record<string, unknown>,
>({
  mode,
  isOpen,
  onClose,
  config,
  tag,
  getInitialValues,
  onSubmit,
  children,
}: BaseTagDialogProps<TTag, TFormValues>) {
  const initialValues = getInitialValues({ mode, tag })

  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      await onSubmit({ mode, values: value })
      onClose()
    },
  })

  useEffect(() => {
    form.reset(getInitialValues({ mode, tag }))
  }, [mode, tag?._id, getInitialValues])

  const handleClose = () => {
    if (form.state.isSubmitting) return
    onClose()
  }

  if (!isOpen) return null

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={
        mode === 'create' ? `New ${config.singular}` : `Edit ${config.singular}`
      }
      description={
        mode === 'create'
          ? `Add a new ${config.singular.toLowerCase()} to your campaign.`
          : `Update ${config.singular.toLowerCase()} details`
      }
      icon={config.icon}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        className="space-y-4"
      >
        {children({ form, isSubmitting: form.state.isSubmitting })}
      </form>
    </FormDialog>
  )
}
