import { ColorPicker } from '../base-tag-form/color-picker.tsx'
import { ErrorAlertAndCharacterCount } from '../base-tag-form/error-alert.tsx'
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
} from '../base-tag-form/types.ts'
import { SubmitButton } from './submit-button.tsx'
import type { TagCategoryConfig } from '../base-tag-form/types.ts'
import type { UseFileWithPreviewReturn } from '~/hooks/useFileWithPreview'
import { Label } from '~/components/shadcn/ui/label'
import { Input } from '~/components/shadcn/ui/input'
import { Textarea } from '~/components/shadcn/ui/textarea'
import { Button } from '~/components/shadcn/ui/button.tsx'
import { ImageUploadSection } from '~/components/file-upload/image-upload-section.tsx'

interface FormFieldState {
  state: {
    value: string
    meta: {
      errors: Array<string | Error | undefined>
      isTouched: boolean
    }
  }
  handleChange: (value: string) => void
  handleBlur: () => void
}

interface ColorFieldState {
  state: {
    value: string | null
  }
  handleChange: (value: string | null) => void
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
  categoryDefaultColor?: string
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

export function ColorField({
  field,
  isDisabled,
  categoryDefaultColor,
}: ColorFieldProps) {
  const isUsingCategoryDefault = field.state.value === null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label id="color-picker-label" className="text-sm font-semibold">
          Tag Color
        </Label>
        {isUsingCategoryDefault && categoryDefaultColor && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>(Using the category color</span>
            <span
              className="inline-block w-3 h-3 mt-0.5 rounded-full"
              style={{ backgroundColor: categoryDefaultColor }}
              aria-label={`Category color: ${categoryDefaultColor}`}
            />
            <span>since no tag color is selected)</span>
          </span>
        )}
        {isUsingCategoryDefault && !categoryDefaultColor && (
          <span className="text-xs text-muted-foreground">
            (No category default color is set)
          </span>
        )}
        {!isUsingCategoryDefault && (
          <span className="text-xs text-muted-foreground">
            (Click again to deselect and revert to the default color)
          </span>
        )}
      </div>
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
