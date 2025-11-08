import { FolderCard } from '../../$categorySlug/-components/folder/folder-card'
import { CharacterFolderContextMenu } from './character-folder-context-menu'
import type { FolderCardProps } from '../../$categorySlug/-components/folder/folder-card'

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
