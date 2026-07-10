import { api } from 'convex/_generated/api'
import {
  completeWizardEditorMapPinOperation,
  replaceWizardEditorMapImage,
} from '@wizard-archive/editor/adapter'
import type { WizardEditorMapSession } from '@wizard-archive/editor/adapter'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { uploadToStorage, useStorageUploadMutations } from '../shared/upload-helpers'
import { useRef } from 'react'

interface LiveGameMapSessionSource {
  session: WizardEditorMapSession
}

export function useLiveGameMapSessionSource(): LiveGameMapSessionSource {
  const storageUploadMutations = useStorageUploadMutations()
  const beginMapImageReplacementMutation = useCampaignMutation(
    api.gameMaps.mutations.beginMapImageReplacement,
  )
  const createMapPinsMutation = useCampaignMutation(api.gameMaps.mutations.createItemPins)
  const updateMapPinMutation = useCampaignMutation(api.gameMaps.mutations.updateItemPin)
  const removeMapPinMutation = useCampaignMutation(api.gameMaps.mutations.removeItemPin)
  const updateMapPinVisibilityMutation = useCampaignMutation(
    api.gameMaps.mutations.updatePinVisibility,
  )
  const updateMapImageMutation = useCampaignMutation(api.gameMaps.mutations.updateMapImage)
  const latestMapImageRequestByMapIdRef = useRef(new Map<string, number>())
  const nextMapImageRequestIdRef = useRef(0)

  return {
    session: {
      pins: {
        create: async (input) => {
          try {
            const pinIds = await createMapPinsMutation.mutateAsync(input)
            return {
              status: 'completed',
              receipt: {
                kind: 'mapPinsCreated',
                itemId: input.mapId,
                affectedCount: pinIds.length,
                pinIds,
              },
            }
          } catch (error) {
            return { status: 'error', error }
          }
        },
        update: async ({ mapId: _mapId, ...input }) => {
          try {
            await updateMapPinMutation.mutateAsync(input)
            return completeWizardEditorMapPinOperation({
              kind: 'mapPinUpdated',
              mapId: _mapId,
            })
          } catch (error) {
            return { status: 'error', error }
          }
        },
        remove: async ({ mapId: _mapId, mapPinId }) => {
          try {
            await removeMapPinMutation.mutateAsync({ mapPinId })
            return completeWizardEditorMapPinOperation({
              kind: 'mapPinRemoved',
              mapId: _mapId,
            })
          } catch (error) {
            return { status: 'error', error }
          }
        },
        setVisibility: async ({ isVisible, mapId: _mapId, mapPinId }) => {
          try {
            await updateMapPinVisibilityMutation.mutateAsync({ mapPinId, visible: isVisible })
            return completeWizardEditorMapPinOperation({
              kind: 'mapPinVisibilityUpdated',
              mapId: _mapId,
            })
          } catch (error) {
            return { status: 'error', error }
          }
        },
      },
      updateMapImage: async ({ file, mapId }) => {
        const mapKey = String(mapId)
        const requestId = ++nextMapImageRequestIdRef.current
        latestMapImageRequestByMapIdRef.current.set(mapKey, requestId)
        return replaceWizardEditorMapImage<
          Awaited<ReturnType<typeof uploadToStorage>> & { replacementToken: string },
          typeof mapId
        >({
          file,
          mapId,
          stageImage: async (input) => {
            const replacementToken = await beginMapImageReplacementMutation.mutateAsync({
              mapId: input.mapId,
            })
            if (latestMapImageRequestByMapIdRef.current.get(mapKey) !== requestId) {
              return { status: 'unavailable', reason: 'stale_map_image' }
            }
            const upload = await uploadToStorage(input.file, storageUploadMutations)
            if (latestMapImageRequestByMapIdRef.current.get(mapKey) !== requestId) {
              await storageUploadMutations.discardUpload.mutateAsync({
                sessionId: upload.sessionId,
              })
              return { status: 'unavailable', reason: 'stale_map_image' }
            }
            return {
              status: 'staged',
              image: { ...upload, replacementToken },
              cancel: (staged) =>
                storageUploadMutations.discardUpload.mutateAsync({
                  sessionId: staged.image.sessionId,
                }),
            }
          },
          commitImage: (staged) =>
            updateMapImageMutation.mutateAsync({
              mapId: staged.mapId,
              replacementToken: staged.image.replacementToken,
              uploadSessionId: staged.image.sessionId,
            }),
        })
      },
    },
  }
}
