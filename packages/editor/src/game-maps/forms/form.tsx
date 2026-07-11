import { useEffect, useRef, useState } from 'react'
import type { ResourceColor, ResourceIconName } from '../../workspace/resource-contract'

import { toast } from 'sonner'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { handleError } from '../../errors/handle-error'
import { useNameValidation } from '../../filesystem/use-name-validation'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import type { FileUploadControl } from '@wizard-archive/ui/file-upload/control'
import type { MapItem } from '../../game-maps/item-contract'
import { SidebarItemMetadataControls } from '../../filesystem/forms/sidebar-item-metadata-controls'
import { SidebarItemNameInput } from '../../filesystem/forms/sidebar-item-name-input'
import { SidebarItemUploadField } from '../../filesystem/forms/sidebar-item-upload-field'
import { useDocumentDropUploadTarget } from '../../filesystem/forms/use-document-drop-upload-target'
import { createBrowserImportFile } from '../../filesystem/browser-import-file'
import type { MapFormEditState, MapFormSource } from './source'
import {
  assertCompletedResourceReplacement,
  runResourceReplacementWithTimeout,
} from '../../filesystem/resource-replacement'

interface MapFormValues {
  name: string
  iconName: ResourceIconName | null
  color: ResourceColor | null
}

interface MapFormProps {
  mapState: MapFormEditState
  mapId: SidebarItemId
  onClose: () => void
  onSuccess?: (mapSlug?: string) => void
  source: MapFormSource
  upload: FileUploadControl
}

const defaultMapFormValues: MapFormValues = {
  name: '',
  iconName: null,
  color: null,
}

export function MapForm({ mapId, mapState, onClose, onSuccess, source, upload }: MapFormProps) {
  const { updateItemMetadata, updateMapImage, validateItemName } = source
  const map = mapState.item
  const [values, setValues] = useState(() => getMapFormDefaultValues(map))
  const loadedMapIdRef = useRef<SidebarItemId | null>(map?.id ?? null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!map) {
      loadedMapIdRef.current = null
      return
    }
    if (loadedMapIdRef.current === map.id) return
    loadedMapIdRef.current = map.id
    setValues(getMapFormDefaultValues(map))
  }, [map])

  const dropUploadTargetProps = useDocumentDropUploadTarget(upload.handleFileSelect)

  const nameValidation = useNameValidation({
    name: values.name,
    initialName: map?.name ?? '',
    isActive: values.name.trim().length > 0 && !!map,
    parentId: map?.parentId ?? null,
    excludeId: mapId,
    validateName: validateItemName,
  })

  function updateValues(nextValues: Partial<MapFormValues>) {
    setValues((current) => ({ ...current, ...nextValues }))
  }

  async function updateExistingMap() {
    if (!mapId || !map) return

    const { slug } = await updateItemMetadata({
      item: map,
      name: values.name,
      iconName: values.iconName,
      color: values.color,
    })
    if (upload.file) {
      try {
        await replaceMapImageFromForm({
          mapId,
          selectedFile: upload.file,
          updateMapImage,
        })
      } catch (error) {
        handleError(error, 'Map details were saved, but the image upload failed.')
        return
      }
    }

    toast.success('Map updated')
    onSuccess?.(slug)
  }

  async function saveMapForm() {
    try {
      if (!hasImage) {
        toast.error('Map image is required')
        return
      }

      if (mapId && !map) {
        toast.error('Map data failed to load. Please try again.')
        return
      }

      setIsSubmitting(true)
      await updateExistingMap()
    } catch (error) {
      handleError(error, 'Failed to save map')
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasImage = hasSelectedOrStoredMapImage({
    imageAssetId: map?.imageAssetId ?? null,
    selectedImage: upload.file,
  })

  const isLoadingMap = isMapLoading(mapId, map, mapState.isPending)
  const isMissingMap = mapId !== undefined && !isLoadingMap && !map

  const isDisabled = isMapFormDisabled({
    isLoadingMap,
    isMissingMap,
    isSubmitting,
    isUploading: upload.isUploading,
  })
  const requiredNameError = values.name.trim().length === 0 ? 'Map name is required' : undefined
  const nameError = requiredNameError ?? nameValidation.validationError
  const nameErrors = nameError ? [nameError] : []
  const isNameValidating = values.name.trim() !== nameValidation.debouncedName
  const submitForm = () => {
    void saveMapForm()
  }

  return (
    <div className="space-y-4" {...dropUploadTargetProps}>
      <SidebarItemNameInput
        disabled={isDisabled}
        errors={nameErrors}
        isValidating={isNameValidating}
        label="Map Name"
        name="map-name"
        onBlur={() => {}}
        onChange={(name) => updateValues({ name })}
        placeholder="Enter map name"
        value={values.name}
      />

      <SidebarItemMetadataControls
        color={values.color}
        defaultIcon="MapPin"
        fallbackName="Untitled Map"
        iconName={values.iconName}
        name={values.name}
        onColorChange={(color) => updateValues({ color })}
        onIconNameChange={(iconName) => updateValues({ iconName })}
      />

      <SidebarItemUploadField
        acceptPattern="image/*"
        dragDropText="Drag an image here or click to browse"
        isSubmitting={isDisabled}
        label="Map Image"
        upload={upload}
      >
        <MapImageRequirementMessage hasImage={hasImage} />
      </SidebarItemUploadField>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isDisabled}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={submitForm}
          disabled={isMapSubmitDisabled({
            hasImage,
            hasNameError: nameErrors.length > 0,
            isDisabled,
            isNameValidating,
          })}
        >
          {getMapSubmitLabel({ isSubmitting })}
        </Button>
      </div>
    </div>
  )
}

async function replaceMapImageFromForm({
  mapId,
  selectedFile,
  updateMapImage,
}: {
  mapId: SidebarItemId
  selectedFile: File
  updateMapImage: MapFormSource['updateMapImage']
}) {
  const result = await runResourceReplacementWithTimeout({
    operation: () =>
      updateMapImage({
        mapId,
        file: createBrowserImportFile(selectedFile),
      }),
    timeoutMessage: 'Map image replacement did not complete',
  })
  assertCompletedResourceReplacement(result, 'Map image replacement did not complete')
}

function getMapFormDefaultValues(map: MapItem | null): MapFormValues {
  if (!map) return defaultMapFormValues
  return {
    name: map.name || '',
    iconName: map.iconName ?? null,
    color: map.color ?? null,
  }
}

function hasSelectedOrStoredMapImage({
  imageAssetId,
  selectedImage,
}: {
  imageAssetId: MapItem['imageAssetId'] | null
  selectedImage: File | null
}) {
  return selectedImage !== null || imageAssetId !== null
}

function isMapLoading(mapId: SidebarItemId, map: MapItem | null, isPending: boolean) {
  return !!mapId && map === null && isPending
}

function isMapFormDisabled({
  isLoadingMap,
  isMissingMap,
  isSubmitting,
  isUploading,
}: {
  isLoadingMap: boolean
  isMissingMap: boolean
  isSubmitting: boolean
  isUploading: boolean
}) {
  return isSubmitting || isUploading || isLoadingMap || isMissingMap
}

function isMapSubmitDisabled({
  hasImage,
  hasNameError,
  isDisabled,
  isNameValidating,
}: {
  hasImage: boolean
  hasNameError: boolean
  isDisabled: boolean
  isNameValidating: boolean
}) {
  return !hasImage || hasNameError || isDisabled || isNameValidating
}

function getMapSubmitLabel({ isSubmitting }: { isSubmitting: boolean }) {
  return isSubmitting ? 'Updating...' : 'Update'
}

function MapImageRequirementMessage({ hasImage }: { hasImage: boolean }) {
  return hasImage ? null : <p className="text-sm text-destructive">Map image is required</p>
}
