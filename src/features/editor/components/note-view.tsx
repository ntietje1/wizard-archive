import { BlockNoteView } from '@blocknote/shadcn'
import { SideMenuController } from '@blocknote/react'
import { WikiLinkClickHandler } from './extensions/wiki-link/wiki-link-click-handler'
import { MdLinkClickHandler } from './extensions/md-link/md-link-click-handler'
import { PreventExternalDrop } from './extensions/prevent-external-drop/prevent-external-drop'
import { SideMenuRenderer } from './extensions/side-menu/side-menu'
import { SlashMenu } from './extensions/slash-menu/slash-menu'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { ReactNode } from 'react'
import './extensions/wiki-link/wiki-link.css'
import './extensions/md-link/md-link.css'
import { useWikiLinkExtension } from '~/features/editor/hooks/useWikiLinkExtension'
import { useMdLinkExtension } from '~/features/editor/hooks/useMdLinkExtension'
import { useDisableAutolink } from '~/features/editor/hooks/useDisableAutolink'
import { useResolvedTheme } from '~/features/settings/hooks/useTheme'

interface NoteViewProps {
  editor: CustomBlockNoteEditor
  editable: boolean
  className?: string
  children?: ReactNode
}

export function NoteView({
  editor,
  editable,
  className,
  children,
}: NoteViewProps) {
  const resolvedTheme = useResolvedTheme()
  useWikiLinkExtension(editor)
  useMdLinkExtension(editor)
  useDisableAutolink(editor)

  return (
    <BlockNoteView
      className={className}
      editor={editor}
      theme={resolvedTheme}
      editable={editable}
      sideMenu={false}
      formattingToolbar={false}
      slashMenu={false}
      linkToolbar={false}
    >
      <PreventExternalDrop />
      <WikiLinkClickHandler editor={editor} />
      <MdLinkClickHandler editor={editor} />
      <SideMenuController sideMenu={SideMenuRenderer} />
      <SlashMenu editor={editor} />
      {children}
    </BlockNoteView>
  )
}
