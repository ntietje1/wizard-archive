import { Highlighter } from '~/lib/icons'
import { useMemo } from 'react'

export const BackgroundColorIcon = (
  props: Partial<{
    backgroundColor: string | undefined
    size: number | undefined
  }>,
) => {
  const backgroundColor = props.backgroundColor || 'default'
  const size = props.size || 16

  const style = useMemo(
    () =>
      ({
        pointerEvents: 'none',
        height: size.toString() + 'px',
        width: size.toString() + 'px',
      }) as const,
    [size],
  )

  return (
    <div
      className={'bn-background-color-icon rounded-sm'}
      data-background-color={backgroundColor}
      style={style}
    >
      <Highlighter size={size} strokeWidth={1.25} />
    </div>
  )
}
