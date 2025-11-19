import { TagCard } from '../../$categorySlug/-components/tag/tag-card'
import { CharacterTagContextMenu } from '~/components/context-menu/category/character-tag-context-menu'
import type { TagCardProps } from '../../$categorySlug/-components/tag/tag-card'

export function CharacterTagCardWithContextMenu(props: TagCardProps) {
  if (!props.config || !props.noteAndTag) {
    return <TagCard {...props} />
  }
  return (
    <CharacterTagContextMenu
      categoryConfig={props.config}
      noteWithTag={props.noteAndTag}
    >
      <TagCard {...props} />
    </CharacterTagContextMenu>
  )
}
