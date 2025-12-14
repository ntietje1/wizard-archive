import type { SidebarItemId } from 'convex/sidebarItems/types'
import type { EditorViewerProps } from '~/lib/editor-registry'
import { useCampaign } from '~/contexts/CampaignContext'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '~/components/shadcn/ui/resizable'
import {
  PageEditor,
  PageEditorEmptyContent,
  PageEditorSkeleton,
} from '../editor/page-editor'
import { NotesViewer } from './notes-viewer'

interface PageLayoutContentProps {
  parentId: SidebarItemId | undefined
  parentSlug: string | undefined
  emptyMessage: string
  emptyButtonText: string
}

function PageLayoutContent({
  parentId,
  parentSlug,
  emptyMessage,
  emptyButtonText,
}: PageLayoutContentProps) {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  if (!parentId || !parentSlug || !campaignId) {
    return <PageEditorEmptyContent />
  }

  return (
    <ResizablePanelGroup
      direction="horizontal"
      autoSaveId="page-layout-content"
      className="flex-1 min-h-0"
    >
      <ResizablePanel
        defaultSize={50}
        minSize={25}
        className="flex min-h-0 flex-col"
      >
        <PageEditor
          parentId={parentId}
          parentSlug={parentSlug}
          campaignId={campaignId}
          emptyMessage={emptyMessage}
          emptyButtonText={emptyButtonText}
        />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        defaultSize={50}
        minSize={25}
        className="flex min-h-0 flex-col"
      >
        <NotesViewer />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export function PageLayoutViewer({ item }: EditorViewerProps) {
  if (!item) return <PageEditorSkeleton />

  return (
    <PageLayoutContent
      parentId={item._id}
      parentSlug={item.slug}
      emptyMessage="This item has no pages. Create a page to start editing."
      emptyButtonText="Create First Page"
    />
  )
}
