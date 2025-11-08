import { TagCard } from '../../$categorySlug/-components/tag/tag-card'
import { LocationTagContextMenu } from './location-tag-context-menu'
import type { TagCardProps } from '../../$categorySlug/-components/tag/tag-card'

export function LocationTagCardWithContextMenu(props: TagCardProps) {
  if (!props.config || !props.noteAndTag) {
    return <TagCard {...props} />
  }
  return (
    <LocationTagContextMenu
      categoryConfig={props.config}
      noteWithTag={props.noteAndTag}
    >
      <TagCard {...props} />
    </LocationTagContextMenu>
  )
}
