import { api } from 'convex/_generated/api'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { CreateParentTarget } from 'convex/sidebarItems/validation/parent'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'

interface CreateNoteArgs {
  name: string
  parentTarget: CreateParentTarget
  content: Array<CustomBlock>
}

export function useCreateNote() {
  const { createItem } = useCreateFileSystemItem()
  const setNoteContent = useCampaignMutation(api.notes.mutations.setNoteContent)

  const createNote = async (args: CreateNoteArgs) => {
    const created = await createItem({
      type: SIDEBAR_ITEM_TYPES.notes,
      name: args.name,
      parentTarget: args.parentTarget,
    })

    await setNoteContent.mutateAsync({ noteId: created.id, content: args.content })

    return created
  }

  return { createNote }
}
