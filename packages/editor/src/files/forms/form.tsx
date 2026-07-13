import { useState } from 'react'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { ResourceColor, ResourceIconName } from '../../workspace/resource-contract'

import { toast } from 'sonner'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { useNameValidation } from '../../filesystem/use-name-validation'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { FILE_UPLOAD_ACCEPT_PATTERN } from '../../../../../shared/storage/validation'
import type { FileItem } from '../item-contract'
import type { FileUploadControl } from '@wizard-archive/ui/file-upload/control'
import { SidebarItemMetadataControls } from '../../filesystem/forms/sidebar-item-metadata-controls'
import { SidebarItemNameInput } from '../../filesystem/forms/sidebar-item-name-input'
import { SidebarItemUploadField } from '../../filesystem/forms/sidebar-item-upload-field'
import { useDocumentDropUploadTarget } from '../../filesystem/forms/use-document-drop-upload-target'
import { createBrowserImportFile } from '../../filesystem/browser-import-file'
import { handleError } from '../../errors/handle-error'
import type { FileFormEditState, FileFormSource } from './source'
import {
  assertCompletedResourceReplacement,
  runResourceReplacementWithTimeout,
} from '../../filesystem/resource-replacement'

interface FileFormValues {
  name: string
  iconName: ResourceIconName | null
  color: ResourceColor | null
}

interface FileFormValueState {
  loadedFileId: SidebarItemId | undefined
  values: FileFormValues
}

interface FileFormProps {
  fileState: FileFormEditState
  fileId?: SidebarItemId
  parentId?: SidebarItemId | null
  onClose: () => void
  onSuccess?: (fileSlug?: string) => void
  source: FileFormSource
  upload: FileUploadControl
}

const defaultFileFormValues: FileFormValues = {
  name: '',
  iconName: null,
  color: null,
}

export function FileForm({
  fileId,
  fileState,
  parentId,
  onClose,
  onSuccess,
  source,
  upload,
}: FileFormProps) {
  const { validateItemName } = source
  const file = fileState.item
  const loadedFileId = fileId && file?.id === fileId ? fileId : undefined
  const [valueState, setValueState] = useState<FileFormValueState>(() => ({
    loadedFileId,
    values: getFileFormDefaultValues(fileId, file),
  }))
  const [isSubmitting, setIsSubmitting] = useState(false)

  let values = valueState.values
  if (valueState.loadedFileId !== loadedFileId) {
    values = getFileFormDefaultValues(fileId, file)
    setValueState({ loadedFileId, values })
  }

  const dropUploadTargetProps = useDocumentDropUploadTarget(upload.handleFileSelect)
  const effectiveName = resolveFinalName({ file, upload, values })
  const isLoadingFile = isFileLoading(fileId, file, fileState.isPending)
  const isEditLoadFailed = isFileEditLoadFailed(fileId, fileState.status)

  const nameValidation = useNameValidation({
    name: effectiveName,
    initialName: file?.name ?? '',
    isActive: effectiveName.trim().length > 0 && (fileId ? !!file : true),
    parentId: file?.parentId ?? parentId ?? null,
    excludeId: fileId,
    validateName: validateItemName,
  })

  function updateValues(nextValues: Partial<FileFormValues>) {
    setValueState((current) => ({
      ...current,
      values: { ...current.values, ...nextValues },
    }))
  }

  const hasFile =
    (isLoadingFile && !isEditLoadFailed) ||
    hasSelectedOrStoredFile({
      selectedFile: upload.file,
      assetId: isEditLoadFailed ? null : (file?.assetId ?? null),
    })
  const isDisabled = isFileFormDisabled({
    isEditLoadFailed,
    isLoadingFile,
    isSubmitting,
    isUploading: upload.isUploading,
  })
  const nameErrors = nameValidation.validationError ? [nameValidation.validationError] : []
  const isNameValidating = effectiveName.trim() !== nameValidation.debouncedName
  const submitForm = () => {
    void saveFileForm({
      file,
      fileId,
      hasFile,
      onClose,
      onSuccess,
      parentId,
      setIsSubmitting,
      source,
      upload,
      values,
    })
  }

  return (
    <div className="space-y-4" {...dropUploadTargetProps}>
      <SidebarItemNameInput
        disabled={isDisabled}
        errors={nameErrors}
        isValidating={isNameValidating}
        label="File Name (optional)"
        name="file-name"
        onBlur={() => {}}
        onChange={(name) => updateValues({ name })}
        placeholder="Enter file name"
        value={values.name}
      />

      <SidebarItemMetadataControls
        color={values.color}
        defaultIcon="File"
        fallbackName="Untitled File"
        iconName={values.iconName}
        name={values.name}
        onColorChange={(color) => updateValues({ color })}
        onIconNameChange={(iconName) => updateValues({ iconName })}
      />

      <SidebarItemUploadField
        acceptPattern={FILE_UPLOAD_ACCEPT_PATTERN}
        dragDropText="Drag a file here or click to browse"
        isSubmitting={isDisabled}
        label="File"
        upload={upload}
      >
        <FileRequirementMessage
          isEditLoadFailed={isEditLoadFailed}
          hasFile={hasFile}
          isLoadingFile={isLoadingFile}
          uploadError={upload.uploadError}
        />
      </SidebarItemUploadField>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isDisabled}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={submitForm}
          disabled={isFileSubmitDisabled({
            hasFile,
            hasNameError: nameErrors.length > 0,
            isDisabled,
            isNameValidating,
          })}
        >
          {getFileSubmitLabel({
            isEditing: fileId !== undefined,
            isSubmitting,
          })}
        </Button>
      </div>
    </div>
  )
}

interface SaveFileFormOptions {
  file: FileItem | null
  fileId?: SidebarItemId
  hasFile: boolean
  onClose: () => void
  onSuccess?: (fileSlug?: string) => void
  parentId?: SidebarItemId | null
  setIsSubmitting: (isSubmitting: boolean) => void
  source: FileFormSource
  upload: FileUploadControl
  values: FileFormValues
}

async function saveFileForm(options: SaveFileFormOptions) {
  const { file, fileId, hasFile, setIsSubmitting } = options
  let submissionStarted = false
  try {
    if (fileId) {
      if (!file) {
        toast.error('File data failed to load. Please try again.')
        return
      }

      if (!hasFile) {
        toast.error('File is required')
        return
      }

      setIsSubmitting(true)
      submissionStarted = true
      await updateExistingFile({ ...options, file, fileId })
      return
    }

    if (!hasFile) {
      toast.error('File is required')
      return
    }

    const selectedFile = options.upload.file
    if (!selectedFile) {
      toast.error('File is required')
      return
    }

    setIsSubmitting(true)
    submissionStarted = true
    await createNewFile({ ...options, selectedFile })
  } catch (error) {
    handleError(error, 'Failed to save file')
  } finally {
    if (submissionStarted) setIsSubmitting(false)
  }
}

async function updateExistingFile({
  file,
  fileId,
  onClose,
  onSuccess,
  source,
  upload,
  values,
}: SaveFileFormOptions & { file: FileItem; fileId: SidebarItemId }) {
  const { slug } = await source.updateItemMetadata({
    item: file,
    name: resolveFinalName({ file, upload, values }),
    iconName: values.iconName,
    color: values.color,
  })

  if (upload.file) {
    try {
      await replaceFileAttachment({
        fileId,
        selectedFile: upload.file,
        source,
      })
    } catch (error) {
      handleError(error, 'File details were saved, but the replacement upload failed.')
      return
    }
  }

  toast.success('File updated')
  onClose()
  onSuccess?.(slug)
}

async function createNewFile({
  file,
  onClose,
  onSuccess,
  parentId,
  selectedFile,
  source,
  upload,
  values,
}: SaveFileFormOptions & { selectedFile: File }) {
  const created = await source.createItem(
    {
      type: RESOURCE_TYPES.files,
      name: resolveFinalName({ file, upload, values }),
      iconName: values.iconName ?? undefined,
      color: values.color ?? undefined,
      parentTarget: { kind: 'direct', parentId: parentId ?? null },
    },
    async ({ id }) => {
      await replaceFileAttachment({
        fileId: id,
        selectedFile,
        source,
      })
    },
  )
  if (created.status !== 'completed') {
    toast.error('Failed to create file')
    return
  }

  void openCreatedFile(source, created.id)
  toast.success('File created')
  onSuccess?.(created.slug)
  onClose()
}

async function replaceFileAttachment({
  fileId,
  selectedFile,
  source,
}: {
  fileId: SidebarItemId
  selectedFile: File
  source: FileFormSource
}) {
  const result = await runResourceReplacementWithTimeout({
    operation: () =>
      source.replaceFile({
        fileId,
        file: createBrowserImportFile(selectedFile),
      }),
    timeoutMessage: 'File replacement did not complete',
  })
  assertCompletedResourceReplacement(result, 'File replacement did not complete')
}

async function openCreatedFile(source: FileFormSource, fileId: SidebarItemId) {
  try {
    await source.openItem(fileId)
  } catch (error) {
    handleError(error, 'Failed to open file')
  }
}

function resolveFinalName({
  file,
  upload,
  values,
}: {
  file: FileItem | null
  upload: FileUploadControl
  values: FileFormValues
}) {
  return values.name.trim() || upload.file?.name || upload.fileMetadata?.name || file?.name || ''
}

function getFileFormDefaultValues(
  fileId: SidebarItemId | undefined,
  file: FileItem | null,
): FileFormValues {
  if (!fileId || !file) return defaultFileFormValues
  return {
    name: file.name || '',
    iconName: file.iconName ?? null,
    color: file.color ?? null,
  }
}

function isFileLoading(
  fileId: SidebarItemId | undefined,
  file: FileItem | null,
  isPending: boolean,
) {
  return fileId !== undefined && file === null && isPending
}

function isFileEditLoadFailed(
  fileId: SidebarItemId | undefined,
  status: FileFormEditState['status'],
) {
  return fileId !== undefined && (status === 'not_found' || status === 'error')
}

function hasSelectedOrStoredFile({
  selectedFile,
  assetId,
}: {
  selectedFile: File | null
  assetId: FileItem['assetId'] | null
}) {
  return selectedFile !== null || assetId !== null
}

function isFileFormDisabled({
  isEditLoadFailed,
  isLoadingFile,
  isSubmitting,
  isUploading,
}: {
  isEditLoadFailed: boolean
  isLoadingFile: boolean
  isSubmitting: boolean
  isUploading: boolean
}) {
  return isSubmitting || isUploading || isLoadingFile || isEditLoadFailed
}

function isFileSubmitDisabled({
  hasFile,
  hasNameError,
  isDisabled,
  isNameValidating,
}: {
  hasFile: boolean
  hasNameError: boolean
  isDisabled: boolean
  isNameValidating: boolean
}) {
  if (!hasFile || isDisabled) return true
  return hasNameError || isNameValidating
}

function getFileSubmitLabel({
  isEditing,
  isSubmitting,
}: {
  isEditing: boolean
  isSubmitting: boolean
}) {
  if (isSubmitting) return isEditing ? 'Updating...' : 'Creating...'
  return isEditing ? 'Update' : 'Create'
}

function FileRequirementMessage({
  isEditLoadFailed,
  hasFile,
  isLoadingFile,
  uploadError,
}: {
  isEditLoadFailed: boolean
  hasFile: boolean
  isLoadingFile: boolean
  uploadError: string
}) {
  if (isEditLoadFailed) {
    return <p className="text-sm text-destructive">File data failed to load. Please try again.</p>
  }
  if (uploadError) {
    return <p className="text-sm text-destructive">{uploadError}</p>
  }
  if (isLoadingFile) {
    return <p className="text-sm text-muted-foreground">Loading file...</p>
  }
  return hasFile ? null : <p className="text-sm text-destructive">File is required</p>
}
