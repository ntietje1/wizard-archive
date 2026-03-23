import { Highlighter } from 'lucide-react'

export const BackgroundColorIcon = (
  props: Partial<{
    backgroundColor: string | undefined
    size: number | undefined
  }>,
) => {
  const backgroundColor = props.backgroundColor || 'default'
  const size = props.size || 16

  const style = {
    pointerEvents: 'none',
    height: `${size}px`,
    width: `${size}px`,
  } as const

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
