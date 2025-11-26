import { TagCard } from '../category/tag/tag-card'
import type { TagCardProps } from '../category/tag/tag-card'
import { SessionTagContextMenu } from '~/components/context-menu/category/session-tag-context-menu'

//TODO: these currently aren't used at all!!
export function SessionTagCardWithContextMenu(props: TagCardProps) {
  if (!props.config || !props.noteAndTag) {
    return <TagCard {...props} />
  }
  return (
    <SessionTagContextMenu
      categoryConfig={props.config}
      noteWithTag={props.noteAndTag}
    >
      <TagCard {...props} />
    </SessionTagContextMenu>
  )
}
