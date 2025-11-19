import { FolderCard } from '../../$categorySlug/-components/folder/folder-card'
import { LocationFolderContextMenu } from '~/components/context-menu/category/location-folder-context-menu'
import type { FolderCardProps } from '../../$categorySlug/-components/folder/folder-card'

export function LocationFolderCardWithContextMenu(props: FolderCardProps) {
  if (!props.categoryConfig) {
    return <FolderCard {...props} />
  }
  return (
    <LocationFolderContextMenu
      categoryConfig={props.categoryConfig}
      folder={props.folder}
    >
      <FolderCard {...props} />
    </LocationFolderContextMenu>
  )
}
