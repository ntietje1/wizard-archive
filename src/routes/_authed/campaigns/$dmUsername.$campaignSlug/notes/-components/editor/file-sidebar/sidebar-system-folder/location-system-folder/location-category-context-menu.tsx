import {
  CategoryContextMenu,
  type CategoryContextMenuProps,
} from '../generic-category-folder/category-context-menu'
import { MapPin, MapPinPlus } from '~/lib/icons'
import { useCampaign } from '~/contexts/CampaignContext'
import { useRouter } from '@tanstack/react-router'
import { forwardRef, useState } from 'react'
import type {
  ContextMenuItem,
  ContextMenuRef,
} from '~/components/context-menu/context-menu'
import { useFolderState } from '~/hooks/useFolderState'
import LocationTagDialog from '~/components/forms/category-tag-form/location-tag-form/location-tag-dialog'

export const LocationCategoryFolderContextMenu = forwardRef<
  ContextMenuRef,
  CategoryContextMenuProps
>(({ categoryConfig, children, ...props }, ref) => {
  const router = useRouter()
  const { dmUsername, campaignSlug } = useCampaign()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const { openFolder } = useFolderState(
    props.folder?._id || categoryConfig.categorySlug,
  )

  const handleCreateItem = () => {
    openFolder()
    setIsCreateDialogOpen(true)
  }

  const itemsTransformation = (baseItems: ContextMenuItem[]) => {
    const items: Array<ContextMenuItem> = [...baseItems]

    if (items[0] && items[0].type === 'action') {
      items[0] = {
        ...items[0],
        icon: <MapPinPlus className="h-4 w-4" />,
        onClick: handleCreateItem,
      }
    }

    if (!props.folder) {
      items.push({
        type: 'action' as const,
        icon: <MapPin className="h-4 w-4" />,
        label: `Go to ${categoryConfig.plural}`,
        onClick: () => {
          router.navigate({
            to: '/campaigns/$dmUsername/$campaignSlug/categories/locations',
            params: {
              dmUsername,
              campaignSlug,
            },
          })
        },
      })
    }

    return items
  }

  return (
    <>
      <CategoryContextMenu
        ref={ref}
        categoryConfig={categoryConfig}
        itemsTransformation={itemsTransformation}
        {...props}
      >
        {children}
      </CategoryContextMenu>
      <LocationTagDialog
        mode="create"
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        config={categoryConfig}
        parentFolderId={props.folder?._id}
        navigateToNote={false}
      />
    </>
  )
})
