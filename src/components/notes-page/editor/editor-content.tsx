import { SidebarItemEditor } from '../viewer/sidebar-item-editor'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { LoadingSpinner } from '~/components/loading/loading-spinner'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'

export function EditorContent() {
  const { item, search, isLoading } = useCurrentItem()
  const { navigateToNote } = useEditorNavigation()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { createNote } = useNoteActions()

  const handleCreateNote = () => {
    if (!campaignId) return
    createNote.mutateAsync({ campaignId: campaignId }).then(({ slug }) => {
      navigateToNote(slug, true)
    })
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="h-full flex items-center justify-center">
        <span
          className="text-amber-600 hover:underline underline-offset-2 cursor-pointer"
          onClick={handleCreateNote}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleCreateNote()
          }}
        >
          Create new note
        </span>
      </div>
    )
  }

  return <SidebarItemEditor item={item} search={search} />
}
