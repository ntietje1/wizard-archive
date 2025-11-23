import { FolderCard } from '../category/folder/folder-card'
import { CharacterFolderContextMenu } from '~/components/context-menu/category/character-folder-context-menu'
import type { FolderCardProps } from '../category/folder/folder-card'

export function CharacterFolderCardWithContextMenu(props: FolderCardProps) {
  if (!props.categoryConfig) {
    return <FolderCard {...props} />
  }
  return (
    <CharacterFolderContextMenu
      categoryConfig={props.categoryConfig}
      folder={props.folder}
    >
      <FolderCard {...props} />
    </CharacterFolderContextMenu>
  )
}

