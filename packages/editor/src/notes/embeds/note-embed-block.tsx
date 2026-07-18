import { File as FileIcon, Link, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent, ReactNode, RefObject } from 'react'
import type { ReactCustomBlockRenderProps } from '@blocknote/react'
import type { embedBlockConfig } from '../document/schema-factory'
import {
  RESIZE_HANDLES,
  resizeHandleCursor,
  resizeHandleZoneStyle,
} from '../../interaction/resize-handle'
import type { ResizeHandle } from '../../interaction/resize-handle'
import {
  parseSerializedAuthoredDestination,
  serializeAuthoredDestination,
} from '../../resources/authored-destination'
import type {
  AuthoredDestination,
  SafeHttpsUrl,
} from '../../resources/authored-destination-contract'
import { parseSafeHttpsUrl } from '../../resources/authored-destination-contract'
import type { AuthoredDestinationDropResult } from '../../resources/authored-destination-drop'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'
import type { NoteBlockId, ResourceId } from '../../resources/domain-id'
import type { EditorRuntime } from '../../resources/editor-runtime-contract'
import { mediaLayoutAspectRatio, mediaLayoutsEqual } from '../../resources/embed-media-layout'
import type { EmbedMediaLayout } from '../../resources/embed-media-layout'
import { EmbeddedMedia } from '../../resources/embedded-media'
import { presentExternalUrl } from '../../resources/external-url-presentation'
import type { AuthorizedResourceSummary } from '../../resources/resource-index-contract'
import { ResourcePreviewSurface } from '../../resources/workspace/resource-preview-surface'
import { useWorkspaceIndexSnapshot } from '../../resources/workspace/resource-store-snapshot'
import { useNoteResourceRuntime } from '../use-note-resource-runtime'
import { settleNoteEmbedResourceCreation } from './note-embed-insertion'
import {
  keyboardResizeNoteEmbed,
  noteEmbedResizeLabel,
  startNoteEmbedResize,
} from './note-embed-resize'

type NoteEmbedRenderProps = ReactCustomBlockRenderProps<
  'embed',
  typeof embedBlockConfig.propSchema,
  'none'
>

export function NoteEmbedBlock({ block, editor }: NoteEmbedRenderProps) {
  const surface = useNoteResourceRuntime()
  const destination = parseSerializedAuthoredDestination(block.props.destination)
  const empty = destination?.kind === 'unresolved' && destination.rawTarget.length === 0
  const [linking, setLinking] = useState(false)
  const root = useRef<HTMLElement>(null)
  const [selected, setSelected] = useState(false)
  const layoutIdentity = block.props.destination
  const [reportedLayout, setReportedLayout] = useState<{
    identity: string
    layout: EmbedMediaLayout
  } | null>(null)
  const storedAspectRatio = positiveSize(block.props.previewAspectRatio)
  const mediaLayout =
    reportedLayout?.identity === layoutIdentity
      ? reportedLayout.layout
      : storedAspectRatio !== null
        ? {
            kind: 'intrinsicAspectRatio' as const,
            aspectRatio: storedAspectRatio,
          }
        : null
  const resizable = surface.editable && destination !== null && !empty
  const setDestination = (next: AuthoredDestination) => {
    editor.updateBlock(block, {
      props: {
        destination: serializeAuthoredDestination(next),
        previewAspectRatio: undefined,
        previewHeight: undefined,
      },
    })
  }
  const drop = useNoteEmbedBlockDrop({
    blockId: assertDomainId(DOMAIN_ID_KIND.noteBlock, block.id),
    empty,
    setDestination,
    surface,
  })
  useEffect(() => {
    if (!selected) return
    const clear = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && root.current?.contains(event.target)) return
      setSelected(false)
    }
    window.addEventListener('pointerdown', clear, true)
    return () => window.removeEventListener('pointerdown', clear, true)
  }, [selected])
  const commitSize = ({ height, width }: { height: number; width: number }) => {
    editor.updateBlock(block, {
      props: {
        previewHeight: mediaLayout === null ? height : undefined,
        previewWidth: width,
      },
    })
  }
  const reportMediaLayout = (layout: EmbedMediaLayout) => {
    setReportedLayout((current) =>
      current?.identity === layoutIdentity && mediaLayoutsEqual(current.layout, layout)
        ? current
        : { identity: layoutIdentity, layout },
    )
    const aspectRatio = mediaLayoutAspectRatio(layout)
    if (surface.editable && layout.kind === 'fixedHeight') {
      if (block.props.previewAspectRatio !== undefined) {
        editor.updateBlock(block, { props: { previewAspectRatio: undefined } })
      }
      return
    }
    if (
      !surface.editable ||
      aspectRatio === null ||
      block.props.previewAspectRatio === aspectRatio
    ) {
      return
    }
    editor.updateBlock(block, { props: { previewAspectRatio: aspectRatio } })
  }

  return (
    <section
      ref={root}
      className="note-embed-block relative my-3 w-full select-none overflow-visible"
      contentEditable={false}
      data-blocknote-external-drop-blocked={empty ? undefined : 'true'}
      data-blocknote-external-drop-target={drop.enabled ? 'true' : undefined}
      data-drop-target={drop.enabled ? undefined : 'false'}
      data-testid="note-embed-block"
      onDragOver={drop.onDragOver}
      onDragLeave={drop.onDragLeave}
      onDrop={drop.onDrop}
      onPointerDownCapture={(event) => {
        if (!surface.editable || event.button !== 0) return
        setSelected(true)
        editor.setTextCursorPosition(block, 'start')
      }}
      style={{
        maxWidth: '100%',
        width: block.props.previewWidth ? `${block.props.previewWidth}px` : undefined,
      }}
    >
      <div className="size-full overflow-hidden rounded-md border border-border bg-card">
        <NoteEmbedContent
          destination={destination}
          empty={empty}
          height={block.props.previewHeight}
          linking={linking}
          mediaLayout={mediaLayout}
          onMediaLayout={reportMediaLayout}
          pending={drop.pending}
          setDestination={setDestination}
          setLinking={setLinking}
          surface={surface}
          uploadFile={drop.uploadFile}
        />
      </div>
      {selected && (
        <NoteEmbedSelectionControls
          editorElement={editor.domElement ?? null}
          height={block.props.previewHeight}
          mediaLayout={mediaLayout}
          onCommit={commitSize}
          resizable={resizable}
          root={root}
          width={block.props.previewWidth}
        />
      )}
    </section>
  )
}

export function ExternalNoteEmbedHtml({ block }: NoteEmbedRenderProps) {
  return (
    <section
      data-note-embed-destination={block.props.destination}
      data-note-embed-preview-aspect-ratio={block.props.previewAspectRatio}
      data-note-embed-preview-height={block.props.previewHeight}
      data-note-embed-preview-width={block.props.previewWidth}
    >
      Embedded resource
    </section>
  )
}

function NoteEmbedContent({
  destination,
  empty,
  height,
  linking,
  mediaLayout,
  onMediaLayout,
  pending,
  setDestination,
  setLinking,
  surface,
  uploadFile,
}: {
  destination: AuthoredDestination | null
  empty: boolean
  height?: number
  linking: boolean
  mediaLayout: EmbedMediaLayout | null
  onMediaLayout: (layout: EmbedMediaLayout) => void
  pending: 'drop' | 'upload' | null
  setDestination: (destination: AuthoredDestination) => void
  setLinking: (linking: boolean) => void
  surface: ReturnType<typeof useNoteResourceRuntime>
  uploadFile: (file: File) => void
}) {
  if (pending === 'drop') {
    return (
      <EmbedState>
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        <span>Adding embedded resource</span>
      </EmbedState>
    )
  }
  if (!destination) return <EmbedState>Embedded destination is invalid</EmbedState>
  if (destination.kind === 'internal') {
    return (
      <InternalNoteEmbed
        ancestry={surface.ancestry}
        destination={destination}
        drop={surface.drop}
        report={surface.report}
        renderNote={surface.renderNote}
        runtime={surface.runtime}
        height={height}
        mediaLayout={mediaLayout}
        onMediaLayout={onMediaLayout}
      />
    )
  }
  if (destination.kind === 'externalUrl') {
    return (
      <ExternalNoteEmbed
        height={height}
        mediaLayout={mediaLayout}
        onMediaLayout={onMediaLayout}
        url={destination.url}
      />
    )
  }
  if (empty) {
    return (
      <EmptyNoteEmbed
        editable={surface.editable}
        linking={linking}
        setDestination={setDestination}
        setLinking={setLinking}
        uploadFile={uploadFile}
        uploading={pending === 'upload'}
      />
    )
  }
  return (
    <NoteEmbedBody height={height} mediaLayout={mediaLayout}>
      <EmbedState>
        <span className="font-medium">Unresolved embedded resource</span>
        <span className="text-muted-foreground">{destination.rawTarget}</span>
      </EmbedState>
    </NoteEmbedBody>
  )
}

function useNoteEmbedBlockDrop({
  blockId,
  empty,
  setDestination,
  surface,
}: {
  blockId: NoteBlockId
  empty: boolean
  setDestination: (destination: AuthoredDestination) => void
  surface: ReturnType<typeof useNoteResourceRuntime>
}) {
  const [pending, setPending] = useState<'drop' | 'upload' | null>(null)
  const operation = useRef<AbortController | null>(null)
  const enabled = Boolean(empty && surface.editable && surface.drop && pending === null)

  useEffect(
    () => () => {
      operation.current?.abort()
      operation.current = null
    },
    [],
  )

  const resolve = async (
    source: 'drop' | 'upload',
    load: (
      resolver: NonNullable<typeof surface.drop>,
      signal: AbortSignal,
    ) => Promise<AuthoredDestinationDropResult>,
  ) => {
    if (!surface.drop) return
    const controller = new AbortController()
    operation.current?.abort()
    operation.current = controller
    setPending(source)
    try {
      const result = await load(surface.drop, controller.signal)
      if (result.kind === 'destinations') {
        const next = result.destinations[0]
        if (next && !controller.signal.aborted && !recursiveDestination(next, surface.ancestry)) {
          setDestination(next)
        }
      } else {
        const creation = result.settlements[0]
        if (!creation) return
        settleNoteEmbedResourceCreation(creation, {
          blockId,
          canReplaceTarget: () => !controller.signal.aborted,
          currentDocument: () => currentSourceDocument(surface),
          document: surface.document,
          report: surface.report,
        })
      }
    } finally {
      if (operation.current === controller) {
        operation.current = null
        setPending(null)
      }
    }
  }

  const finish = (event: DragEvent<HTMLElement>) => {
    if (!enabled || !surface.drop?.canResolve(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    void resolve('drop', (resolver, signal) => resolver.resolve(event.dataTransfer, 1, signal))
  }

  return {
    enabled,
    pending,
    onDragOver: enabled
      ? (event: DragEvent<HTMLElement>) => {
          if (!surface.drop?.canResolve(event.dataTransfer)) return
          event.preventDefault()
          event.stopPropagation()
          event.currentTarget.dataset.dropTarget = 'true'
        }
      : undefined,
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      const next = event.relatedTarget
      if (next instanceof Node && event.currentTarget.contains(next)) return
      event.currentTarget.dataset.dropTarget = 'false'
    },
    onDrop: finish,
    uploadFile: (file: File) => {
      if (!enabled) return
      void resolve('upload', (resolver, signal) => resolver.resolveFiles([file], 1, signal))
    },
  }
}

function currentSourceDocument(surface: ReturnType<typeof useNoteResourceRuntime>) {
  if (!surface.runtime || !surface.sourceResourceId) return surface.document
  const state = surface.runtime.content.notes.get(surface.sourceResourceId)
  if (state.status === 'initializing') return state.local
  return state.status === 'ready' ? state.session.document : null
}

function InternalNoteEmbed({
  ancestry,
  destination,
  drop,
  report,
  renderNote,
  runtime,
  height,
  mediaLayout,
  onMediaLayout,
}: {
  ancestry: ReadonlySet<ResourceId>
  destination: Extract<AuthoredDestination, { kind: 'internal' }>
  drop: ReturnType<typeof useNoteResourceRuntime>['drop']
  report: ReturnType<typeof useNoteResourceRuntime>['report']
  renderNote: ReturnType<typeof useNoteResourceRuntime>['renderNote']
  runtime: EditorRuntime | null
  height?: number
  mediaLayout: EmbedMediaLayout | null
  onMediaLayout: (layout: EmbedMediaLayout) => void
}) {
  if (!runtime) {
    return (
      <NoteEmbedBody height={height} mediaLayout={mediaLayout}>
        <EmbedState>Embedded resources are unavailable here</EmbedState>
      </NoteEmbedBody>
    )
  }
  if (ancestry.has(destination.target.resourceId)) {
    return (
      <NoteEmbedBody height={height} mediaLayout={mediaLayout}>
        <EmbedState>Recursive embedded resource</EmbedState>
      </NoteEmbedBody>
    )
  }
  return (
    <InternalResourceEmbed
      ancestry={ancestry}
      drop={drop}
      report={report}
      renderNote={renderNote}
      runtime={runtime}
      target={destination.target}
      height={height}
      mediaLayout={mediaLayout}
      onMediaLayout={onMediaLayout}
    />
  )
}

function InternalResourceEmbed({
  ancestry,
  drop,
  report,
  renderNote,
  runtime,
  target,
  height,
  mediaLayout,
  onMediaLayout,
}: {
  ancestry: ReadonlySet<ResourceId>
  drop: ReturnType<typeof useNoteResourceRuntime>['drop']
  report: ReturnType<typeof useNoteResourceRuntime>['report']
  renderNote: ReturnType<typeof useNoteResourceRuntime>['renderNote']
  runtime: EditorRuntime
  target: Extract<AuthoredDestination, { kind: 'internal' }>['target']
  height?: number
  mediaLayout: EmbedMediaLayout | null
  onMediaLayout: (layout: EmbedMediaLayout) => void
}) {
  const resourceId = target.resourceId
  const snapshot = useWorkspaceIndexSnapshot(runtime.resources.index)
  const resource = snapshot.lookup(resourceId)

  useEffect(() => {
    if (resource.state === 'unknown') void runtime.resources.loader.ensureResource(resourceId)
  }, [resource.state, resourceId, runtime.resources.loader])

  if (resource.state !== 'known') {
    return (
      <NoteEmbedBody height={height} mediaLayout={mediaLayout}>
        <EmbedState>
          {resource.state === 'unknown' ? 'Loading resource' : 'Resource unavailable'}
        </EmbedState>
      </NoteEmbedBody>
    )
  }
  return (
    <>
      <InternalResourceHeader resource={resource.value} runtime={runtime} target={target} />
      <NoteEmbedBody height={height} mediaLayout={mediaLayout}>
        <ResourcePreviewSurface
          onMediaLayout={onMediaLayout}
          renderNote={({ resource: note, state }) =>
            renderNote ? (
              renderNote({ ancestors: ancestry, drop, report, resource: note, runtime, state })
            ) : (
              <EmbedState>Embedded notes are unavailable here</EmbedState>
            )
          }
          resource={resource.value}
          runtime={runtime}
          target={target}
        />
      </NoteEmbedBody>
    </>
  )
}

function InternalResourceHeader({
  resource,
  runtime,
  target,
}: {
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  target: Extract<AuthoredDestination, { kind: 'internal' }>['target']
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 border-b border-border bg-muted/30 px-3 py-2 text-left"
      aria-label={`Open ${resource.title}`}
      onClick={() => runtime.navigation.open(target)}
    >
      <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 truncate text-sm font-medium">{resource.title}</span>
    </button>
  )
}

function EmptyNoteEmbed({
  editable,
  linking,
  setDestination,
  setLinking,
  uploadFile,
  uploading,
}: {
  editable: boolean
  linking: boolean
  setDestination: (destination: AuthoredDestination) => void
  setLinking: (linking: boolean) => void
  uploadFile: (file: File) => void
  uploading: boolean
}) {
  const [url, setUrl] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const parsed = parseSafeHttpsUrl(url)
  if (!editable) return <EmbedState>Empty embedded resource</EmbedState>
  if (linking) {
    return (
      <form
        className="flex min-h-36 flex-col justify-center gap-2 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (parsed) setDestination({ kind: 'externalUrl', url: parsed })
        }}
      >
        <label className="text-sm font-medium" htmlFor="note-embed-external-url">
          External file URL
        </label>
        <input
          id="note-embed-external-url"
          autoFocus
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/file.pdf"
          type="url"
          value={url}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            disabled={!parsed}
          >
            Link
          </button>
          <button type="button" className="px-3 py-1.5 text-sm" onClick={() => setLinking(false)}>
            Cancel
          </button>
        </div>
      </form>
    )
  }
  return (
    <EmbedState>
      <span className="font-medium">Drag and drop a resource or file here</span>
      <button
        type="button"
        aria-busy={uploading}
        className="flex items-center gap-2 text-sm underline disabled:opacity-50"
        disabled={uploading}
        onClick={() => fileInput.current?.click()}
      >
        {uploading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {uploading ? 'Uploading' : 'Upload'}
      </button>
      <input
        ref={fileInput}
        type="file"
        aria-label="Embed file upload"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) uploadFile(file)
        }}
      />
      <button type="button" className="text-sm underline" onClick={() => setLinking(true)}>
        or link to an external file
      </button>
    </EmbedState>
  )
}

function ExternalNoteEmbed({
  height,
  mediaLayout,
  onMediaLayout,
  url,
}: {
  height?: number
  mediaLayout: EmbedMediaLayout | null
  onMediaLayout: (layout: EmbedMediaLayout) => void
  url: SafeHttpsUrl
}) {
  const { href, mediaKind, title } = presentExternalUrl(url)
  return (
    <>
      <a
        className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2"
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        <Link className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 truncate text-sm font-medium">{title}</span>
      </a>
      <NoteEmbedBody height={height} mediaLayout={mediaLayout}>
        {mediaKind === 'image' ? (
          <EmbeddedMedia alt={title} kind="image" onMediaLayout={onMediaLayout} url={href} />
        ) : mediaKind === 'audio' ? (
          <div className="flex size-full items-center px-4">
            <EmbeddedMedia kind="audio" onMediaLayout={onMediaLayout} url={href} />
          </div>
        ) : mediaKind === 'video' ? (
          <EmbeddedMedia kind="video" onMediaLayout={onMediaLayout} url={href} />
        ) : mediaKind === 'pdf' ? (
          <iframe className="size-full border-0" src={href} title={title} />
        ) : (
          <EmbedState>
            <a className="text-sm underline" href={href} rel="noreferrer" target="_blank">
              Open file
            </a>
          </EmbedState>
        )}
      </NoteEmbedBody>
    </>
  )
}

function EmbedState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-2 p-4 text-center text-sm">
      {children}
    </div>
  )
}

function NoteEmbedBody({
  children,
  height,
  mediaLayout,
}: {
  children: ReactNode
  height?: number
  mediaLayout: EmbedMediaLayout | null
}) {
  const aspectRatio = mediaLayoutAspectRatio(mediaLayout)
  return (
    <div
      className={`flex w-full items-center justify-center overflow-hidden ${
        mediaLayout?.kind === 'fixedHeight' ? '' : 'min-h-36'
      } ${mediaLayout === null ? 'h-72' : ''}`}
      data-note-embed-body="true"
      style={
        mediaLayout?.kind === 'fixedHeight'
          ? { height: mediaLayout.height }
          : aspectRatio
            ? { aspectRatio: `${aspectRatio} / 1` }
            : height
              ? { height }
              : undefined
      }
    >
      {children}
    </div>
  )
}

function NoteEmbedSelectionControls({
  editorElement,
  height,
  mediaLayout,
  onCommit,
  resizable,
  root,
  width,
}: {
  editorElement: HTMLElement | null
  height?: number
  mediaLayout: EmbedMediaLayout | null
  onCommit: (size: { height: number; width: number }) => void
  resizable: boolean
  root: RefObject<HTMLElement | null>
  width?: number
}) {
  const resizeHandles =
    mediaLayout?.kind === 'fixedHeight' ? (['left', 'right'] as const) : RESIZE_HANDLES
  return (
    <div
      className="pointer-events-none absolute inset-0 z-30"
      contentEditable={false}
      data-testid="note-embed-resize-wrapper"
    >
      <div
        className="absolute inset-0 bg-canvas-selection-fill"
        data-testid="note-embed-resize-fill"
      />
      <div
        className="absolute border-[1.5px]"
        data-testid="note-embed-resize-outline"
        style={{ borderColor: 'var(--canvas-selection-stroke)', inset: -3 }}
      />
      {resizable &&
        resizeHandles.map((handle) => (
          <button
            key={handle}
            type="button"
            aria-label={noteEmbedResizeLabel(handle)}
            className="pointer-events-auto absolute z-20 touch-none border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-selection-focus-ring"
            data-note-embed-resize-zone="true"
            data-testid={`note-embed-resize-zone-${handle}`}
            draggable={false}
            onKeyDown={(event) =>
              resizeFromKeyboard(event, {
                editorElement,
                handle,
                height,
                mediaLayout,
                onCommit,
                root: root.current,
                width,
              })
            }
            onPointerDown={(event) =>
              startNoteEmbedResize({
                editorElement,
                event,
                handle,
                aspectRatio: mediaLayoutAspectRatio(mediaLayout),
                onCommit,
                root: root.current,
              })
            }
            style={{
              ...resizeHandleZoneStyle(handle, 18),
              cursor: resizeHandleCursor(handle),
            }}
          />
        ))}
    </div>
  )
}

function resizeFromKeyboard(
  event: KeyboardEvent<HTMLButtonElement>,
  {
    editorElement,
    handle,
    height,
    mediaLayout,
    onCommit,
    root,
    width,
  }: {
    editorElement: HTMLElement | null
    handle: ResizeHandle
    height?: number
    mediaLayout: EmbedMediaLayout | null
    onCommit: (size: { height: number; width: number }) => void
    root: HTMLElement | null
    width?: number
  },
) {
  const body = root?.querySelector<HTMLElement>('[data-note-embed-body="true"]')
  const rootBounds = root?.getBoundingClientRect()
  const bodyBounds = body?.getBoundingClientRect()
  const next = keyboardResizeNoteEmbed({
    editorWidth: editorElement?.firstElementChild?.clientWidth,
    handle,
    height: positiveSize(height) ?? positiveSize(bodyBounds?.height) ?? 144,
    aspectRatio: mediaLayoutAspectRatio(mediaLayout),
    key: event.key,
    width: positiveSize(width) ?? positiveSize(rootBounds?.width) ?? 64,
  })
  if (!next) return
  event.preventDefault()
  event.stopPropagation()
  onCommit(next)
}

function positiveSize(value: number | undefined): number | null {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : null
}

function recursiveDestination(destination: AuthoredDestination, ancestry: ReadonlySet<ResourceId>) {
  return destination.kind === 'internal' && ancestry.has(destination.target.resourceId)
}
