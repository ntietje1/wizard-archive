import { FolderCard } from '../category/folder/folder-card'
import { LocationFolderContextMenu } from '~/components/context-menu/category/location-folder-context-menu'
import type { FolderCardProps } from '../category/folder/folder-card'

//TODO: these currently aren't used at all!!
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
