import type {
  BlocksShareSource,
  BlocksShareState,
  BlockShareTargetBlock,
  BlockShareTargetNote,
} from '../contracts'

type BlocksShareCapability =
  | Extract<BlocksShareSource, { status: 'unsupported' }>
  | { status: 'available'; state: BlocksShareState }

export function useBlocksShare(
  source: BlocksShareSource,
  blocks: Array<BlockShareTargetBlock>,
  note: BlockShareTargetNote | undefined,
): BlocksShareCapability {
  if (source.status !== 'available') return source
  return { status: 'available', state: source.useBlocksShare(blocks, note) }
}
