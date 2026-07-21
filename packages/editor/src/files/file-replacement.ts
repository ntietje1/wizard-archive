import { validateFileUploadSize } from '../../../../shared/storage/validation'
import type { VersionStamp } from '../resources/component-version'
import type { FileContentSource } from '../resources/content-session-contract'
import type { ResourceId } from '../resources/domain-id'
import { useAssetReplacement } from '../resources/asset-replacement'

export function useFileReplacement(
  source: FileContentSource,
  resourceId: ResourceId,
  version: VersionStamp,
) {
  return useAssetReplacement({
    target: {
      owner: source,
      key: JSON.stringify([resourceId, version.revision, version.digest]),
      value: { source, resourceId, expectedVersion: version },
    },
    replace: async (target, candidate) =>
      await target.source.replace(target.resourceId, target.expectedVersion, candidate),
    validate: (file) => {
      const result = validateFileUploadSize(file.size)
      return result.valid ? null : result.error
    },
    message: (result) => fileReplacementMessage(result.reason),
    retryable: (result) => result.status === 'retryable',
    readingMessage: 'Reading file…',
    uploadingMessage: 'Uploading replacement…',
    readFailureMessage: 'The selected file could not be read.',
    responseLostMessage: 'The file replacement could not be confirmed.',
  })
}

function fileReplacementMessage(reason: string): string {
  switch (reason) {
    case 'content_initializing':
      return 'The file is still being prepared.'
    case 'response_lost':
      return 'The file replacement could not be confirmed.'
    case 'version_conflict':
      return 'This file changed while the replacement was uploading.'
    case 'invalid_file':
      return 'The selected file type is not supported.'
    case 'content_corrupt':
    case 'content_missing':
      return 'The existing file content is unavailable.'
    case 'resource_missing':
    case 'unauthorized':
      return 'You can no longer replace this file.'
    case 'version_exhausted':
      return 'This file cannot accept another revision.'
    default:
      return 'The file could not be replaced.'
  }
}
