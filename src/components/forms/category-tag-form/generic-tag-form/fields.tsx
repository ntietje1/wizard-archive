import { Label } from '~/components/shadcn/ui/label'
import { Input } from '~/components/shadcn/ui/input'
import { Textarea } from '~/components/shadcn/ui/textarea'
import { Button } from '~/components/shadcn/ui/button.tsx'
import { ColorPicker } from '../base-tag-form/color-picker.tsx'
import { ImageUploadSection } from '~/components/file-upload/image-upload-section.tsx'
import { ErrorAlertAndCharacterCount } from '../base-tag-form/error-alert.tsx'
import { SubmitButton } from './submit-button.tsx'
import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  type TagCategoryConfig,
} from '../base-tag-form/types.ts'
import type { UseFileWithPreviewReturn } from '~/hooks/useFileWithPreview'

interface FormFieldState {
  state: {
    value: string
    meta: {
      errors: (string | Error | undefined)[]
      isTouched: boolean
    }
  }
  handleChange: (value: string) => void
  handleBlur: () => void
}

interface ColorFieldState {
  state: {
    value: string
  }
  handleChange: (value: string) => void
}

interface NameFieldProps {
  field: FormFieldState
  config: TagCategoryConfig
  isDisabled: boolean
}

interface DescriptionFieldProps {
  field: FormFieldState
  config: TagCategoryConfig
  isDisabled: boolean
}

interface ColorFieldProps {
  field: ColorFieldState
  isDisabled: boolean
}

interface ImageUploadFieldProps {
  label: string
  fileUpload: UseFileWithPreviewReturn
  isSubmitting: boolean
  handleFileSelect: (file: File) => void
}

interface SubmitButtonsProps {
  mode: 'create' | 'edit'
  isSubmitting: boolean
  canSubmit: boolean
  imageUpload: UseFileWithPreviewReturn
  nameValue: string
  onClose: () => void
}

export function NameField({ field, config, isDisabled }: NameFieldProps) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={`${config.singular.toLowerCase()}-name`}
        className="text-sm font-semibold"
      >
        {config.singular} Name *
      </Label>
      <Input
        id={`${config.singular.toLowerCase()}-name`}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        placeholder={`Enter ${config.singular.toLowerCase()} name...`}
        maxLength={MAX_NAME_LENGTH}
        disabled={isDisabled}
        className="transition-colors"
      />
      <ErrorAlertAndCharacterCount
        error={field.state.meta.errors[0]}
        shouldShowError={
          field.state.meta.errors.length > 0 && field.state.meta.isTouched
        }
        characterCount={field.state.value.length}
        maxCharCount={MAX_NAME_LENGTH}
      />
    </div>
  )
}

export function DescriptionField({
  field,
  config,
  isDisabled,
}: DescriptionFieldProps) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={`${config.singular.toLowerCase()}-description`}
        className="text-sm font-semibold"
      >
        Description
      </Label>
      <Textarea
        id={`${config.singular.toLowerCase()}-description`}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        placeholder={`Describe this ${config.singular.toLowerCase()}...`}
        maxLength={MAX_DESCRIPTION_LENGTH}
        disabled={isDisabled}
        className="resize-none"
      />
      <ErrorAlertAndCharacterCount
        error={field.state.meta.errors[0]}
        shouldShowError={
          field.state.meta.errors.length > 0 && field.state.meta.isTouched
        }
        characterCount={field.state.value.length}
        maxCharCount={MAX_DESCRIPTION_LENGTH}
      />
    </div>
  )
}

export function ColorField({ field, isDisabled }: ColorFieldProps) {
  return (
    <div className="space-y-2">
      <Label id="color-picker-label" className="text-sm font-semibold">
        Tag Color
      </Label>
      <ColorPicker
        selectedColor={field.state.value}
        onColorChange={(color) => field.handleChange(color)}
        disabled={isDisabled}
        aria-labelledby="color-picker-label"
      />
    </div>
  )
}
export function ImageUploadField({
  label,
  fileUpload,
  isSubmitting,
  handleFileSelect,
}: ImageUploadFieldProps) {
  return (
    <ImageUploadSection
      label={label}
      fileUpload={fileUpload}
      isSubmitting={isSubmitting}
      handleFileSelect={handleFileSelect}
    />
  )
}

export function SubmitButtons({
  mode,
  isSubmitting,
  canSubmit,
  imageUpload,
  nameValue,
  onClose,
}: SubmitButtonsProps) {
  return (
    <div className="flex justify-end gap-3 pt-4 border-t">
      <Button
        type="button"
        variant="outline"
        onClick={onClose}
        disabled={isSubmitting || imageUpload.isUploading}
      >
        Cancel
      </Button>
      <SubmitButton
        mode={mode}
        isSubmitting={isSubmitting}
        isDisabled={!canSubmit || imageUpload.isUploading || !nameValue.trim()}
      />
    </div>
  )
}
