import { FolderCard } from '../category/folder/folder-card'
import type { FolderCardProps } from '../category/folder/folder-card'
import { SessionFolderContextMenu } from '~/components/context-menu/category/session-folder-context-menu'

//TODO: these currently aren't used at all!!
export function SessionFolderCardWithContextMenu(props: FolderCardProps) {
  if (!props.categoryConfig) {
    return <FolderCard {...props} />
  }
  return (
    <SessionFolderContextMenu
      categoryConfig={props.categoryConfig}
      folder={props.folder}
    >
      <FolderCard {...props} />
    </SessionFolderContextMenu>
  )
}
