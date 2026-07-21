import { validateFileUploadSize } from '../../../../shared/storage/validation'
import type { MapContentMutationResult, MapSession } from '../resources/content-session-contract'
import type { ResourceId } from '../resources/domain-id'
import { useAssetReplacement } from '../resources/asset-replacement'

export function useMapImageReplacement(session: MapSession, mapResourceId: ResourceId) {
  return useAssetReplacement({
    target: {
      owner: session,
      key: JSON.stringify([mapResourceId, session.version.revision, session.version.digest]),
      value: { session, expectedVersion: session.version },
    },
    replace: async (target, source) =>
      await target.session.replaceImage(null, target.expectedVersion, source),
    validate: (file) => {
      const result = validateFileUploadSize(file.size)
      return result.valid ? null : result.error
    },
    message: mapImageMutationMessage,
    retryable: (result) => result.status === 'retryable',
    readingMessage: 'Reading map image…',
    uploadingMessage: 'Uploading map image…',
    readFailureMessage: 'The selected image could not be read.',
    responseLostMessage: 'The map image replacement could not be confirmed.',
  })
}

function mapImageMutationMessage(
  result: Exclude<MapContentMutationResult, { status: 'completed' }>,
) {
  switch (result.reason) {
    case 'content_initializing':
      return 'The map is still being prepared.'
    case 'response_lost':
      return 'The map image replacement could not be confirmed.'
    case 'version_conflict':
      return 'This map changed while the image was uploading.'
    case 'layer_missing':
      return 'The selected map layer no longer exists.'
    case 'content_corrupt':
    case 'content_missing':
      return 'The existing map content is unavailable.'
    case 'invalid_command':
      return 'The map change was invalid.'
    case 'operation_id_reused':
      return 'The map change could not be safely retried.'
    case 'pin_missing':
      return 'The selected map pin no longer exists.'
    case 'resource_missing':
    case 'unauthorized':
      return 'You can no longer edit this map.'
    case 'target_missing':
      return 'The pinned resource is unavailable.'
    case 'version_exhausted':
      return 'This map cannot accept another revision.'
  }
}
