import { type LucideIcon, Folder as FolderIcon } from '~/lib/icons'
import {
  Collapsible,
  CollapsibleContent,
} from '~/components/shadcn/ui/collapsible'
import { useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { convexQuery } from '@convex-dev/react-query'
import { useCampaign } from '~/contexts/CampaignContext'
import { useFolderState } from '~/hooks/useFolderState'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useFolderActions } from '~/hooks/useFolderActions'
import {
  CategoryContextMenu,
  type CategoryContextMenuProps,
} from './category-context-menu'
import { type TagNoteContextMenuProps } from './tag-note-context.menu'
import { toast } from 'sonner'
import { useRef } from 'react'
import type { ContextMenuRef } from '~/components/context-menu/context-menu'
import { CategorySidebarItem } from './category-sidebar-item'
import { SidebarItemButtonBase } from '../../sidebar-item/sidebar-item-button-base'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import type { AnySidebarItem, Folder } from 'convex/notes/types'
import { DraggableCategoryFolder } from './draggable-category-folder'
import { DroppableCategoryFolder } from './droppable-category-folder'
import { useSidebarItemsByParent } from '~/hooks/useSidebarItems'
import type { Id } from 'convex/_generated/dataModel'

type CategoryContextMenuComponent =
  React.ComponentType<CategoryContextMenuProps>
type NoteContextMenuComponent = React.ComponentType<TagNoteContextMenuProps>

interface CategoryFolderButtonProps {
  folder?: Folder
  categoryConfig: TagCategoryConfig
  categoryContextMenu?: CategoryContextMenuComponent
  tagNoteContextMenu?: NoteContextMenuComponent
}

export const CategoryFolderButton = ({
  folder,
  categoryConfig,
  categoryContextMenu,
  tagNoteContextMenu,
  ancestorIds = [],
}: CategoryFolderButtonProps & { ancestorIds?: Id<'folders'>[] }) => {
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const getCategory = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoryBySlug,
      campaign?._id
        ? {
            campaignId: campaign._id,
            slug: categoryConfig.categorySlug,
          }
        : 'skip',
    ),
  )
  const { isExpanded, toggleExpanded } = useFolderState(
    folder?._id || categoryConfig.categorySlug,
  )
  const categoryContextMenuRef = useRef<ContextMenuRef>(null)

  const categoryId = folder?.categoryId ?? getCategory?.data?._id
  const children = useSidebarItemsByParent(categoryId, folder?._id)

  const hasItems = (children.data && children.data.length > 0) || false

  const CategoryContextMenuComponent =
    categoryContextMenu || CategoryContextMenu

  const currentAncestors = folder ? [...ancestorIds, folder._id] : ancestorIds

  return (
    <DroppableCategoryFolder
      folder={folder}
      categoryId={getCategory?.data?._id}
      ancestorIds={ancestorIds}
    >
      <Collapsible open={isExpanded} onOpenChange={toggleExpanded}>
        <CategoryContextMenuComponent
          ref={categoryContextMenuRef}
          categoryConfig={categoryConfig}
          folder={folder}
        >
          {folder ? (
            // Sub-folders are draggable
            <DraggableCategoryFolder folder={folder} ancestorIds={ancestorIds}>
              <CategoryFolderBase
                icon={FolderIcon}
                categoryName={folder.name || categoryConfig.plural}
                isExpanded={isExpanded}
                toggleExpanded={toggleExpanded}
                contextMenuRef={categoryContextMenuRef}
                folder={folder}
                defaultName={categoryConfig.plural}
              />
            </DraggableCategoryFolder>
          ) : (
            // Root category folders are NOT draggable
            <CategoryFolderBase
              icon={categoryConfig.icon}
              categoryName={categoryConfig.plural}
              isExpanded={isExpanded}
              toggleExpanded={toggleExpanded}
              contextMenuRef={categoryContextMenuRef}
            />
          )}
        </CategoryContextMenuComponent>
        <CollapsibleContent>
          <div className="relative pl-2">
            {/* Vertical line */}
            {hasItems && (
              <div className="absolute left-1 top-0 bottom-0 w-px bg-muted-foreground/5" />
            )}
            {children.data?.map((item: AnySidebarItem) => (
              <CategorySidebarItem
                key={item._id}
                item={item}
                categoryConfig={categoryConfig}
                categoryContextMenu={categoryContextMenu}
                tagNoteContextMenu={tagNoteContextMenu}
                ancestorIds={currentAncestors}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </DroppableCategoryFolder>
  )
}

interface CategoryFolderBaseProps {
  icon: LucideIcon
  categoryName: string
  isExpanded: boolean
  toggleExpanded: () => void
  contextMenuRef: React.RefObject<ContextMenuRef | null>
  folder?: Folder
  defaultName?: string
}

const CategoryFolderBase = ({
  icon,
  categoryName,
  isExpanded,
  toggleExpanded,
  contextMenuRef,
  folder,
  defaultName,
}: CategoryFolderBaseProps) => {
  const { renamingId, setRenamingId } = useFileSidebar()
  const { updateFolder } = useFolderActions()

  const handleFolderClick = () => {
    toast.info('Category folder clicked - functionality coming soon!')
  }

  const handleMoreOptionsWrapper = (e: React.MouseEvent) => {
    e.stopPropagation()
    contextMenuRef.current?.open({ x: e.clientX + 4, y: e.clientY + 4 })
  }

  const handleFinishRename = folder
    ? async (newName: string) => {
        await updateFolder.mutateAsync({
          folderId: folder._id,
          name: newName,
        })
        setRenamingId(null)
      }
    : undefined

  const isRenaming = folder ? renamingId === folder._id : false

  return (
    <SidebarItemButtonBase
      icon={icon}
      editIcon={icon}
      name={categoryName}
      defaultName={defaultName || categoryName}
      isExpanded={isExpanded}
      isSelected={false}
      isRenaming={isRenaming}
      showChevron={true}
      onSelect={handleFolderClick}
      onMoreOptions={handleMoreOptionsWrapper}
      onToggleExpanded={toggleExpanded}
      onFinishRename={handleFinishRename}
    />
  )
}
