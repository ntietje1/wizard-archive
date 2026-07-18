import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { CanvasDocumentNode } from '../../canvas/document-contract'
import { canvasEmbedLabel } from '../../canvas/canvas-embed-label'
import { EPHEMERAL_NOTE_SCROLL } from '../../notes/note-scroll-persistence'
import { NoteSessionEditor } from '../../notes/note-session-editor'
import type { BlockNoteActivation } from '../../rich-text/blocknote/use-blocknote-activation'
import type { EditorRuntime } from '../editor-runtime-contract'
import type { ResourceId } from '../domain-id'
import { RESOURCE_PERMISSION, resourcePermissionAllows } from '../resource-access-policy'
import { ResourcePreviewSurface } from './resource-preview-surface'
import { useWorkspaceIndexSnapshot } from './resource-store-snapshot'
import { renderEmbeddedNoteResource } from './embedded-note-resource-preview'

const MISSING_RESOURCE = { state: 'missing' as const }

export function CanvasResourceEmbed({
  activation,
  canEdit,
  editing,
  node,
  runtime,
  sourceResourceId,
  zoom = 1,
}: {
  activation: BlockNoteActivation | null
  canEdit: boolean
  editing: boolean
  node: Extract<CanvasDocumentNode, { type: 'embed' }>
  runtime: EditorRuntime
  sourceResourceId: ResourceId
  zoom?: number
}) {
  const resourceId =
    node.data.destination?.kind === 'internal' ? node.data.destination.target.resourceId : null
  const target = node.data.destination?.kind === 'internal' ? node.data.destination.target : null
  const snapshot = useWorkspaceIndexSnapshot(runtime.resources.index)
  const resource =
    resourceId && resourceId !== sourceResourceId ? snapshot.lookup(resourceId) : MISSING_RESOURCE

  useEffect(() => {
    if (resourceId && resourceId !== sourceResourceId && resource.state === 'unknown') {
      void runtime.resources.loader.ensureResource(resourceId)
    }
  }, [resource.state, resourceId, runtime.resources.loader, sourceResourceId])

  if (resource.state !== 'known') {
    return (
      <CanvasEmbedFrame label={canvasEmbedLabel(node)} missing zoom={zoom}>
        <CanvasEmbedFallback node={node} />
      </CanvasEmbedFrame>
    )
  }

  return (
    <CanvasEmbedFrame label={resource.value.title} zoom={zoom}>
      <ResourcePreviewSurface
        resource={resource.value}
        runtime={runtime}
        target={target ?? { kind: 'resource', resourceId: resource.value.id }}
        renderNote={({ resource: note, state }) => {
          const noteCanEdit =
            canEdit && resourcePermissionAllows(note.permission, RESOURCE_PERMISSION.edit)
          const noteEditing = editing && noteCanEdit
          return (
            <CanvasNoteSurface canEdit={noteCanEdit} editing={noteEditing}>
              <NoteSessionEditor
                activation={noteEditing ? (activation ?? undefined) : undefined}
                canEdit={noteEditing}
                resources={{
                  ancestors: new Set([sourceResourceId]),
                  renderNote: renderEmbeddedNoteResource,
                  runtime,
                  sourceResourceId: note.id,
                }}
                formattingToolbar={false}
                label={`${note.title} embedded note`}
                scroll={EPHEMERAL_NOTE_SCROLL}
                state={state}
              />
            </CanvasNoteSurface>
          )
        }}
      />
    </CanvasEmbedFrame>
  )
}

function CanvasEmbedFrame({
  children,
  label,
  missing = false,
  zoom,
}: {
  children: ReactNode
  label: string
  missing?: boolean
  zoom: number
}) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  return (
    <div className="relative size-full">
      <div
        className="pointer-events-none absolute top-0 left-0 z-20 w-full select-none"
        data-testid="canvas-embed-floating-label-frame"
        style={{
          height: 16 / safeZoom,
          transform: `translateY(calc(-100% - ${6 / safeZoom}px))`,
        }}
      >
        <span
          className="absolute bottom-0 left-0 block truncate text-xs font-medium text-muted-foreground"
          data-testid="canvas-embed-floating-label"
          style={{
            lineHeight: '16px',
            transform: `scale(${1 / safeZoom})`,
            transformOrigin: 'left bottom',
            width: `${safeZoom * 100}%`,
          }}
        >
          {missing ? `Warning: ${label}` : label}
        </span>
      </div>
      <div className="size-full overflow-hidden rounded-md">{children}</div>
    </div>
  )
}

function CanvasNoteSurface({
  canEdit,
  children,
  editing,
}: {
  canEdit: boolean
  children: ReactNode
  editing: boolean
}) {
  return (
    <div
      className="flex size-full min-h-0 flex-col overflow-hidden text-left"
      data-canvas-editable-embed={canEdit && !editing}
    >
      {children}
    </div>
  )
}

function CanvasEmbedFallback({ node }: { node: Extract<CanvasDocumentNode, { type: 'embed' }> }) {
  return (
    <span className="flex size-full items-center justify-center p-3 text-center">
      {canvasEmbedLabel(node)}
    </span>
  )
}
