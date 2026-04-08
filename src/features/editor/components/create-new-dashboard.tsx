import { useState } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import {
  File,
  FileText,
  Folder,
  Grid2x2Plus,
  Loader2,
  MapPin,
  Plus,
} from 'lucide-react'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { LucideIcon } from 'lucide-react'
import { handleError } from '~/shared/utils/logger'
import { Button } from '~/features/shadcn/components/button'
import { useCreateSidebarItem } from '~/features/sidebar/hooks/useCreateSidebarItem'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'

interface CreateNewButtonProps {
  icon: LucideIcon
  name: string
  description: string
  onClick: () => void
  isCreating: boolean
  disabled: boolean
}

function CreateNewButton({
  icon: Icon,
  name,
  description,
  onClick,
  isCreating,
  disabled,
}: CreateNewButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-4 w-full px-4 py-3 h-auto justify-start text-left group"
    >
      <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{name}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground group-hover:text-foreground">
        {isCreating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </div>
    </Button>
  )
}

interface CreateNewDashboardProps {
  parentId: Id<'folders'> | null
  folderPath?: string
}

export function CreateNewDashboard({
  parentId,
  folderPath,
}: CreateNewDashboardProps) {
  const { campaignId } = useCampaign()
  const { createItem } = useCreateSidebarItem()
  const { getDefaultName } = useSidebarValidation()
  const { navigateToItem } = useEditorNavigation()
  const { openParentFolders } = useOpenParentFolders()
  const pendingItemName = useSidebarUIStore((s) => s.pendingItemName)
  const [creatingType, setCreatingType] = useState<SidebarItemType | null>(null)

  const isDisabled = creatingType !== null

  const handleCreate = async (type: SidebarItemType) => {
    if (!campaignId || isDisabled) return

    setCreatingType(type)

    try {
      const name = pendingItemName.trim() || getDefaultName(type, parentId)
      const result = await createItem({ type, campaignId, parentId, name })
      openParentFolders(result.id)
      await navigateToItem(result.slug)
    } catch (error) {
      handleError(error, 'Failed to create item')
    }
    setCreatingType(null)
  }

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        {/* Create New Section */}
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Create New
            </h2>
            {folderPath && (
              <p className="text-xs text-muted-foreground mt-1">{folderPath}</p>
            )}
          </div>
          <div className="space-y-2">
            <CreateNewButton
              icon={FileText}
              name="Note"
              description="Write and organize your thoughts"
              onClick={() => handleCreate(SIDEBAR_ITEM_TYPES.notes)}
              disabled={isDisabled}
              isCreating={creatingType === SIDEBAR_ITEM_TYPES.notes}
            />
            <CreateNewButton
              icon={Folder}
              name="Folder"
              description="Group related items together"
              onClick={() => handleCreate(SIDEBAR_ITEM_TYPES.folders)}
              disabled={isDisabled}
              isCreating={creatingType === SIDEBAR_ITEM_TYPES.folders}
            />
            <CreateNewButton
              icon={MapPin}
              name="Map"
              description="Upload an image to pin items on"
              onClick={() => handleCreate(SIDEBAR_ITEM_TYPES.gameMaps)}
              disabled={isDisabled}
              isCreating={creatingType === SIDEBAR_ITEM_TYPES.gameMaps}
            />
            <CreateNewButton
              icon={File}
              name="File"
              description="Upload a document, image, or media"
              onClick={() => handleCreate(SIDEBAR_ITEM_TYPES.files)}
              disabled={isDisabled}
              isCreating={creatingType === SIDEBAR_ITEM_TYPES.files}
            />
            <CreateNewButton
              icon={Grid2x2Plus}
              name="Canvas"
              description="Collaborative whiteboard with nodes and drawing"
              onClick={() => handleCreate(SIDEBAR_ITEM_TYPES.canvases)}
              disabled={isDisabled}
              isCreating={creatingType === SIDEBAR_ITEM_TYPES.canvases}
            />
          </div>
        </div>

        {/* Create from Template Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Create from Template
          </h2>
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">No templates yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Templates will appear here once created
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
