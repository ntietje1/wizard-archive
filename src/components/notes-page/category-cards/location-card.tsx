import { TagCard } from '../category/tag/tag-card'
import { LocationTagContextMenu } from '~/components/context-menu/category/location-tag-context-menu'
import type { TagCardProps } from '../category/tag/tag-card'

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

