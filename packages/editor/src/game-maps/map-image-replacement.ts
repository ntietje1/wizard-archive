import type { MaybePromise } from '../../../../shared/common/async'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceImportFile } from '../files/import-contract'
import { completedResourceOperation } from '../filesystem/transaction-contract'
import type { ResourceOperationResult } from '../filesystem/transaction-contract'

type StagedMapImageReplacement<TImage> = {
  status: 'staged'
  image: TImage
  cancel: (input: MapImageReplacementImageInput<TImage>) => MaybePromise<ResourceOperationResult>
}

type MapImageReplacementStageResult<TImage> =
  | StagedMapImageReplacement<TImage>
  | Exclude<ResourceOperationResult, { status: 'completed' }>

type MapImageReplacementInput<TImage> = {
  file: ResourceImportFile
  layerId?: string | null
  mapId: SidebarItemId
  stageImage: (
    input: MapImageReplacementFileInput,
  ) => MaybePromise<MapImageReplacementStageResult<TImage>>
  commitImage: (
    input: MapImageReplacementImageInput<TImage>,
  ) => MaybePromise<ResourceOperationResult>
}

type MapImageReplacementFileInput = {
  file: ResourceImportFile
  layerId: string | null
  mapId: SidebarItemId
}

type MapImageReplacementImageInput<TImage> = {
  image: TImage
  layerId: string | null
  mapId: SidebarItemId
}

export async function replaceMapImage<TImage>({
  commitImage,
  file,
  layerId,
  mapId,
  stageImage,
}: MapImageReplacementInput<TImage>): Promise<ResourceOperationResult> {
  try {
    const normalizedLayerId = layerId ?? null
    const staged = await stageImage({ file, layerId: normalizedLayerId, mapId })
    if (staged.status !== 'staged') return staged

    let commitResult: ResourceOperationResult
    try {
      commitResult = await commitImage({ image: staged.image, layerId: normalizedLayerId, mapId })
    } catch (error) {
      await cancelStagedImage(staged, normalizedLayerId, mapId, error)
      throw error
    }

    if (!isCompletedResourceOperation(commitResult)) {
      await cancelStagedImage(staged, normalizedLayerId, mapId, commitResult)
      return commitResult
    }

    return completedResourceOperation({
      kind: 'mapImageUpdated',
      itemId: mapId,
      affectedCount: 1,
    })
  } catch (error) {
    return { status: 'error', error }
  }
}

async function cancelStagedImage<TImage>(
  staged: StagedMapImageReplacement<TImage>,
  layerId: string | null,
  mapId: SidebarItemId,
  commitError: unknown,
) {
  try {
    const cancelResult = await staged.cancel({ image: staged.image, layerId, mapId })
    if (!isCompletedResourceOperation(cancelResult)) {
      throw new MapImageReplacementCleanupError(commitError, cancelResult)
    }
  } catch (cancelError) {
    if (cancelError instanceof MapImageReplacementCleanupError) throw cancelError
    throw new MapImageReplacementCleanupError(commitError, cancelError)
  }
}

function isCompletedResourceOperation(
  result: ResourceOperationResult,
): result is Extract<ResourceOperationResult, { status: 'completed' }> {
  return result.status === 'completed'
}

class MapImageReplacementCleanupError extends Error {
  readonly commitError: unknown
  readonly cancelError: unknown

  constructor(commitError: unknown, cancelError: unknown) {
    super('Map image replacement failed and cleanup also failed')
    this.commitError = commitError
    this.cancelError = cancelError
  }
}
