import type { MaybePromise } from '../../../../shared/common/async'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceImportFile } from '../files/import-contract'
import { completedResourceOperation } from '../filesystem/transaction-contract'
import type { ResourceOperationResult } from '../filesystem/transaction-contract'

type StagedMapImageReplacement<TImage> = {
  status: 'staged'
  image: TImage
  cancel?: (input: MapImageReplacementImageInput<TImage>) => MaybePromise<unknown>
}

type MapImageReplacementStageResult<TImage> =
  | StagedMapImageReplacement<TImage>
  | Exclude<ResourceOperationResult, { status: 'completed' }>

type MapImageReplacementInput<TImage> = {
  file: ResourceImportFile
  mapId: SidebarItemId
  stageImage: (
    input: MapImageReplacementFileInput,
  ) => MaybePromise<MapImageReplacementStageResult<TImage>>
  commitImage: (input: MapImageReplacementImageInput<TImage>) => MaybePromise<unknown>
}

type MapImageReplacementFileInput = {
  file: ResourceImportFile
  mapId: SidebarItemId
}

type MapImageReplacementImageInput<TImage> = {
  image: TImage
  mapId: SidebarItemId
}

export async function replaceMapImage<TImage>({
  commitImage,
  file,
  mapId,
  stageImage,
}: MapImageReplacementInput<TImage>): Promise<ResourceOperationResult> {
  try {
    const staged = await stageImage({ file, mapId })
    if (staged.status !== 'staged') return staged

    try {
      await commitImage({ image: staged.image, mapId })
    } catch (error) {
      try {
        await staged.cancel?.({ image: staged.image, mapId })
      } catch (cancelError) {
        throw new MapImageReplacementCleanupError(error, cancelError)
      }
      throw error
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

class MapImageReplacementCleanupError extends Error {
  readonly commitError: unknown
  readonly cancelError: unknown

  constructor(commitError: unknown, cancelError: unknown) {
    super('Map image replacement failed and cleanup also failed')
    this.commitError = commitError
    this.cancelError = cancelError
  }
}
