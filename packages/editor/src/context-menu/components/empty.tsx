import React from 'react'

type EmptyContextMenuChildProps = {
  onContextMenu?: React.MouseEventHandler<HTMLElement>
}

export function EmptyContextMenu({
  children,
}: {
  children: React.ReactElement<EmptyContextMenuChildProps>
}) {
  const child = React.cloneElement(children, {
    onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
      children.props.onContextMenu?.(event)
      if (event.defaultPrevented) return

      event.preventDefault()
      event.stopPropagation()
      event.nativeEvent.stopImmediatePropagation?.()
    },
  })

  return child
}
