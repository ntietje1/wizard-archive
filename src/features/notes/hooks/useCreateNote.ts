import { api } from 'convex/_generated/api'
import type { CustomBlock } from 'shared/editor-blocks/types'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { encodeStateAsUpdate } from 'yjs'
import { useConvex } from '@convex-dev/react-query'
import type { CreateParentTarget } from 'shared/sidebar-items/parent-target'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { blocksToYDoc } from 'shared/editor-blocks/blocknote-yjs'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

interface CreateNoteArgs {
  name: string
  parentTarget: CreateParentTarget
  content: Array<CustomBlock>
}

export function useCreateNote() {
  const { createItem } = useCreateFileSystemItem()
  const convex = useConvex()
  const { campaignId } = useCampaign()
  const pushUpdate = useCampaignMutation(api.yjsSync.mutations.pushUpdate)

  const createNote = async (args: CreateNoteArgs) => {
    return await createItem(
      {
        type: SIDEBAR_ITEM_TYPES.notes,
        name: args.name,
        parentTarget: args.parentTarget,
      },
      async (created) => {
        if (args.content.length > 0) {
          if (!campaignId) throw new Error('useCreateNote requires a campaign context')
          const doc = blocksToYDoc(args.content, 'document')
          try {
            await pushUpdate.mutateAsync({
              documentId: created.id,
              update: toArrayBuffer(encodeStateAsUpdate(doc)),
            })
            await convex.action(api.notes.actions.persistNoteBlocks, {
              campaignId,
              documentId: created.id,
            })
          } finally {
            doc.destroy()
          }
        }
      },
    )
  }

  return { createNote }
}

function toArrayBuffer(update: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(update.byteLength)
  copy.set(update)
  return copy.buffer
}
