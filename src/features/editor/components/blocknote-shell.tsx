import { BlockNoteView } from '@blocknote/shadcn'
import { SideMenuController } from '@blocknote/react'
import { PreventExternalDrop } from './extensions/prevent-external-drop/prevent-external-drop'
import { SideMenuRenderer } from './extensions/side-menu/side-menu'
import { SlashMenu } from './extensions/slash-menu/slash-menu'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { NoteWithContent } from 'convex/notes/types'
import type { CSSProperties, ReactNode } from 'react'
import './extensions/wiki-link/wiki-link.css'
import './extensions/md-link/md-link.css'
import type { LinkResolver } from '~/features/editor/hooks/useLinkResolver'
import { useBlockNotePlugins } from '~/features/editor/hooks/use-blocknote-plugins'
import { useResolvedTheme } from '~/features/settings/hooks/useTheme'

interface BlockNoteShellProps {
  editor: CustomBlockNoteEditor
  note?: NoteWithContent | undefined
  editable: boolean
  linkResolver: LinkResolver
  style?: CSSProperties
  children?: ReactNode
}

export function BlockNoteShell({
  editor,
  note,
  editable,
  linkResolver,
  style,
  children,
}: BlockNoteShellProps) {
  const resolvedTheme = useResolvedTheme()
  const noteSurfaceRef = useBlockNotePlugins({ editor, editable, linkResolver })

  return (
    <div ref={noteSurfaceRef} className="contents">
      <BlockNoteView
        editor={editor}
        style={style}
        theme={resolvedTheme}
        editable={editable}
        sideMenu={false}
        formattingToolbar={false}
        slashMenu={false}
        linkToolbar={false}
      >
        {editable && (
          <>
            <PreventExternalDrop />
            {note && (
              <SideMenuController
                sideMenu={(props) => <SideMenuRenderer {...props} note={note} />}
              />
            )}
            <SlashMenu editor={editor} />
          </>
        )}
        {children}
      </BlockNoteView>
    </div>
  )
}
