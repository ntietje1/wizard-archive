interface ColorIconProps {
  backgroundColor?: string
  size?: number
  textColor?: string
}

export function ColorIcon({
  backgroundColor: backgroundColorProp,
  size: sizeProp,
  textColor: textColorProp,
}: ColorIconProps) {
  const textColor = textColorProp || 'default'
  const backgroundColor = backgroundColorProp || 'default'
  const size = sizeProp || 16

  const style = {
    ...(textColor !== 'default' ? { color: textColor } : {}),
    ...(backgroundColor !== 'default' ? { backgroundColor } : {}),
    pointerEvents: 'none',
    fontSize: `${(size * 0.75).toString()}px`,
    height: `${size.toString()}px`,
    lineHeight: `${size.toString()}px`,
    textAlign: 'center',
    width: `${size.toString()}px`,
  } as const

  return (
    <div
      aria-hidden="true"
      className={'bn-color-icon'}
      data-background-color={backgroundColor}
      data-text-color={textColor}
      style={style}
    >
      A
    </div>
  )
}
