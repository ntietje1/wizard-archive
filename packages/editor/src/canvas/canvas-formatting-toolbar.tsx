import { FormattingToolbar } from '@blocknote/react'
import type { ComponentProps } from 'react'

export function CanvasFormattingToolbar(props: ComponentProps<typeof FormattingToolbar>) {
  return (
    <div aria-label="Canvas formatting toolbar" role="toolbar">
      <FormattingToolbar {...props} />
    </div>
  )
}
