import { Suspense, lazy, useRef, useState } from 'react'
import { File as FileIcon, Link } from 'lucide-react'
import type { EmbedTarget } from 'shared/embeds/embedTargets'
import type { Id } from 'convex/_generated/dataModel'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { useEmbedUpload } from '~/features/embeds/hooks/use-embed-upload'
import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import { Button } from '~/features/shadcn/components/button'
import { Input } from '~/features/shadcn/components/input'
import { cn } from '~/features/shadcn/lib/utils'
import { blockPropsFromEmbedTarget, embedTargetFromBlockProps } from './embed-block-targets'
import { externalEmbedTargetFromUrl } from '~/features/embeds/utils/embed-targets'
import { useNoteEmbedBlockDropTarget } from './embed-block-drop'
import type { NoteEmbedBlockProps } from './embed-block-targets'

const EmbedContent = lazy(() =>
  import('~/features/embeds/components/embed-content').then((module) => ({
    default: module.EmbedContent,
  })),
)

type NoteEmbedBlockViewProps = {
  block: {
    children?: Array<unknown>
    content?: unknown
    props: NoteEmbedBlockProps
  }
  contentRef: ((node: HTMLElement | null) => void) | null
  editable: boolean
  editor: {
    replaceBlocks: (blocksToRemove: Array<unknown>, blocksToInsert: Array<unknown>) => void
    updateBlock: (block: unknown, update: unknown) => void
  }
  sourceNoteId: Id<'sidebarItems'> | null
}

export function NoteEmbedBlockView({
  block,
  editor,
  contentRef,
  editable,
  sourceNoteId,
}: NoteEmbedBlockViewProps) {
  const rootRef = useRef<HTMLElement | null>(null)
  const blockProps = block.props as NoteEmbedBlockProps
  const target = embedTargetFromBlockProps(blockProps)

  const setTarget = (nextTarget: EmbedTarget) => {
    const nextProps = {
      ...getSharedEmbedBlockProps(blockProps),
      ...blockPropsFromEmbedTarget(nextTarget),
    }

    editor.replaceBlocks(
      [block],
      [
        {
          ...block,
          props: nextProps,
        },
      ],
    )
  }

  const width = positiveNumber(blockProps.previewWidth)
  const height = positiveNumber(blockProps.previewHeight)

  return (
    <section
      ref={rootRef}
      data-testid="note-embed-block"
      data-note-embed-drop-target="true"
      className={cn(
        'note-embed-block relative my-2 overflow-hidden rounded-lg border border-border bg-card text-card-foreground',
        target.kind === 'empty' && 'border-dashed bg-muted/20',
      )}
      style={{
        width,
        height,
        maxWidth: '100%',
      }}
    >
      <span ref={contentRef} className="sr-only" />
      {target.kind !== 'empty' ? <NoteEmbedBlockHeader target={target} /> : null}
      {editable ? (
        <EditableNoteEmbedBlockBody
          rootRef={rootRef}
          sourceNoteId={sourceNoteId}
          target={target}
          setTarget={setTarget}
        />
      ) : (
        <ReadOnlyNoteEmbedBlockBody sourceNoteId={sourceNoteId} target={target} />
      )}
      {editable ? (
        <button
          type="button"
          aria-label="Resize embed"
          className="absolute bottom-1 right-1 z-10 h-4 w-4 cursor-nwse-resize rounded-sm border border-border bg-background/90 shadow-sm"
          onPointerDown={(event) => {
            startResize({
              event,
              root: rootRef.current,
              width,
              height,
              onResize: (previewWidth, previewHeight) => {
                editor.updateBlock(block, {
                  props: {
                    previewWidth,
                    previewHeight,
                  },
                })
              },
            })
          }}
        />
      ) : null}
    </section>
  )
}

function ReadOnlyNoteEmbedBlockBody({
  sourceNoteId,
  target,
}: {
  sourceNoteId: Id<'sidebarItems'> | null
  target: EmbedTarget
}) {
  return (
    <div className="min-h-36">
      <Suspense fallback={<div className="min-h-36" />}>
        <EmbedContent
          target={target}
          sourceItemId={sourceNoteId}
          mode="readonly"
          renderSidebarItem={(item) => <SidebarItemPreviewContent item={item} />}
        />
      </Suspense>
    </div>
  )
}

function EditableNoteEmbedBlockBody({
  rootRef,
  sourceNoteId,
  target,
  setTarget,
}: {
  rootRef: RefObject<HTMLElement | null>
  sourceNoteId: Id<'sidebarItems'> | null
  target: EmbedTarget
  setTarget: (target: EmbedTarget) => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [linkDraftOpen, setLinkDraftOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const { uploadEmbedFile } = useEmbedUpload()
  const uploadFile = async (file: globalThis.File) => {
    const result = await uploadEmbedFile(file)
    return result?.id ?? null
  }

  const setTargetAndCloseDraft = (nextTarget: EmbedTarget) => {
    setTarget(nextTarget)
    setLinkDraftOpen(false)
    setLinkDraft('')
    setLinkError(null)
  }

  useNoteEmbedBlockDropTarget({
    ref: rootRef,
    editable: true,
    sourceNoteId,
    setTarget: setTargetAndCloseDraft,
    uploadFile,
  })

  return (
    <>
      <div className="min-h-36">
        <Suspense fallback={<div className="min-h-36" />}>
          <EmbedContent
            target={target}
            sourceItemId={sourceNoteId}
            mode="editable"
            onUpload={() => fileInputRef.current?.click()}
            onLinkExternal={() => setLinkDraftOpen(true)}
            renderSidebarItem={(item) => <SidebarItemPreviewContent item={item} />}
          />
        </Suspense>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={async (event) => {
          const file = event.currentTarget.files?.item(0)
          event.currentTarget.value = ''
          if (!file) return
          const sidebarItemId = await uploadFile(file)
          if (sidebarItemId) setTargetAndCloseDraft({ kind: 'sidebarItem', sidebarItemId })
        }}
      />
      {linkDraftOpen ? (
        <form
          className="flex gap-2 border-t border-border p-2"
          onSubmit={(event) => {
            event.preventDefault()
            const nextTarget = externalEmbedTargetFromUrl(linkDraft)
            if (!nextTarget) {
              setLinkError('Use an HTTPS file URL')
              return
            }
            setTargetAndCloseDraft(nextTarget)
          }}
        >
          <Input
            value={linkDraft}
            aria-label="External file URL"
            placeholder="https://example.com/file.pdf"
            onChange={(event) => {
              setLinkDraft(event.target.value)
              setLinkError(null)
            }}
          />
          <Button type="submit" size="sm">
            Link
          </Button>
          {linkError ? (
            <span className="self-center text-sm text-destructive">{linkError}</span>
          ) : null}
        </form>
      ) : null}
    </>
  )
}

function NoteEmbedBlockHeader({ target }: { target: EmbedTarget }) {
  const title = getTargetTitle(target)
  if (!title) return null
  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
      {target.kind === 'externalUrl' ? (
        <Link className="size-4 text-muted-foreground" />
      ) : (
        <FileIcon className="size-4 text-muted-foreground" />
      )}
      <h3 className="min-w-0 truncate text-sm font-medium">{title}</h3>
    </div>
  )
}

function getTargetTitle(target: EmbedTarget) {
  if (target.kind === 'externalUrl') return target.name ?? target.url
  return null
}

function positiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function getSharedEmbedBlockProps(props: NoteEmbedBlockProps): NoteEmbedBlockProps {
  return stripUndefined({
    backgroundColor: props.backgroundColor,
    textAlignment: props.textAlignment,
    previewWidth: props.previewWidth,
    previewHeight: props.previewHeight,
  })
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T
}

function startResize({
  event,
  root,
  width,
  height,
  onResize,
}: {
  event: ReactPointerEvent
  root: HTMLElement | null
  width: number | undefined
  height: number | undefined
  onResize: (width: number, height: number) => void
}) {
  event.preventDefault()
  event.stopPropagation()

  const rect = root?.getBoundingClientRect()
  const startWidth = width ?? (rect && rect.width > 0 ? rect.width : 320)
  const startHeight = height ?? (rect && rect.height > 0 ? rect.height : 180)
  const startX = event.clientX
  const startY = event.clientY

  const onPointerMove = (moveEvent: PointerEvent) => {
    onResize(
      Math.max(160, Math.round(startWidth + moveEvent.clientX - startX)),
      Math.max(144, Math.round(startHeight + moveEvent.clientY - startY)),
    )
  }

  const onPointerUp = () => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}
