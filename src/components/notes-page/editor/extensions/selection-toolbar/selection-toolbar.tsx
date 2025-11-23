import {
  FileCaptionButton,
  BlockTypeSelect,
  FormattingToolbar,
  FormattingToolbarController,
  FileReplaceButton,
  TextAlignButton,
  NestBlockButton,
  UnnestBlockButton,
  CreateLinkButton,
  BasicTextStyleButton,
} from '@blocknote/react'
import { TextColorButton } from './text-color-button'
import { BackgroundColorButton } from './background-color-button'

export default function SelectionToolbar() {
  return (
    <FormattingToolbarController
      formattingToolbar={() => (
        <FormattingToolbar>
          <BlockTypeSelect key={'blockTypeSelect'} />

          <FileCaptionButton key={'fileCaptionButton'} />
          <FileReplaceButton key={'replaceFileButton'} />

          <BasicTextStyleButton
            basicTextStyle={'bold'}
            key={'boldStyleButton'}
          />
          <BasicTextStyleButton
            basicTextStyle={'italic'}
            key={'italicStyleButton'}
          />
          <BasicTextStyleButton
            basicTextStyle={'underline'}
            key={'underlineStyleButton'}
          />
          <BasicTextStyleButton
            basicTextStyle={'strike'}
            key={'strikeStyleButton'}
          />

          <TextAlignButton textAlignment={'left'} key={'textAlignLeftButton'} />
          <TextAlignButton
            textAlignment={'center'}
            key={'textAlignCenterButton'}
          />
          <TextAlignButton
            textAlignment={'right'}
            key={'textAlignRightButton'}
          />

          <TextColorButton key={'textColorButton'} />
          <BackgroundColorButton key={'backgroundColorButton'} />

          <NestBlockButton key={'nestBlockButton'} />
          <UnnestBlockButton key={'unnestBlockButton'} />

          <CreateLinkButton key={'createLinkButton'} />
        </FormattingToolbar>
      )}
    />
  )
}
