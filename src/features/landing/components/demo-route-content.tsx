import { CanvasReadOnlyPreview } from '~/features/canvas/components/canvas-read-only-preview'
import { DemoCanvasEmbedRenderer } from '~/features/landing/components/demo-canvas-embed-renderer'
import { NavBar } from '~/features/landing/components/nav-bar'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'

const DEMO_CANVAS_NODES = [
  {
    id: 'scene-brief',
    type: 'text',
    position: { x: 40, y: 40 },
    width: 320,
    height: 144,
    data: {
      content: [
        {
          type: 'heading',
          props: { level: 3 },
          content: [{ type: 'text', text: 'Session brief', styles: { bold: true } }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Connect locations, NPC notes, and the next reveal before play starts.',
            },
          ],
        },
      ],
      backgroundColor: 'var(--t-blue)',
      backgroundOpacity: 0.16,
      borderStroke: 'var(--t-blue)',
      borderOpacity: 0.5,
      borderWidth: 2,
    },
  },
  {
    id: 'map-preview',
    type: 'embed',
    position: { x: 480, y: 56 },
    width: 300,
    height: 210,
    data: {
      sidebarItemId: 'fixture-map',
      textColor: 'var(--foreground)',
      backgroundColor: 'var(--t-green)',
      backgroundOpacity: 0.12,
      borderStroke: 'var(--t-green)',
      borderOpacity: 0.5,
      borderWidth: 2,
    },
  },
  {
    id: 'encounter-clock',
    type: 'text',
    position: { x: 180, y: 310 },
    width: 300,
    height: 128,
    data: {
      content: [
        {
          type: 'heading',
          props: { level: 4 },
          content: [{ type: 'text', text: 'Encounter clock' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Guards alerted: 2 of 4 segments.' }],
        },
      ],
      backgroundColor: 'var(--t-orange)',
      backgroundOpacity: 0.18,
      borderStroke: 'var(--t-orange)',
      borderOpacity: 0.55,
      borderWidth: 2,
    },
  },
  {
    id: 'route-line',
    type: 'stroke',
    position: { x: 372, y: 204 },
    width: 164,
    height: 120,
    data: {
      color: 'var(--t-purple)',
      size: 5,
      opacity: 0.75,
      bounds: { x: 0, y: 0, width: 164, height: 120 },
      points: [
        [0, 110, 0.5],
        [38, 64, 0.7],
        [86, 78, 0.8],
        [164, 0, 0.65],
      ],
    },
  },
] satisfies ReadonlyArray<CanvasDocumentNode>

const DEMO_CANVAS_EDGES = [
  {
    id: 'brief-to-map',
    source: 'scene-brief',
    target: 'map-preview',
    type: 'bezier',
    sourceHandle: null,
    targetHandle: null,
    style: { stroke: 'var(--t-blue)', strokeWidth: 2, opacity: 0.65 },
  },
  {
    id: 'brief-to-clock',
    source: 'scene-brief',
    target: 'encounter-clock',
    type: 'step',
    sourceHandle: null,
    targetHandle: null,
    style: { stroke: 'var(--t-orange)', strokeWidth: 2, opacity: 0.7 },
  },
] satisfies ReadonlyArray<CanvasDocumentEdge>

export function DemoRouteContent() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main className="pt-16" aria-label="Demo project">
        <div className="grid min-h-[calc(100svh-4rem)] grid-rows-[auto_1fr] gap-5 px-5 py-5 sm:px-8 sm:py-7 lg:grid-cols-[minmax(16rem,22rem)_1fr] lg:grid-rows-1 lg:px-10 lg:py-9">
          <aside className="flex flex-col justify-between gap-5 border-b border-border pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Demo Project</p>
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
                Plan a session from one canvas.
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                A prepared adventure board for keeping locations, NPC notes, and the next reveal
                visible at a glance.
              </p>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-1">
              <div>
                <dt className="text-muted-foreground">Focus</dt>
                <dd className="font-medium">Session prep</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Includes</dt>
                <dd className="font-medium">Notes, map, clock</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">View</dt>
                <dd className="font-medium">Canvas</dd>
              </div>
            </dl>
          </aside>
          <div className="min-h-[26rem] overflow-hidden rounded-lg border border-border bg-background shadow-sm">
            <CanvasReadOnlyPreview
              nodes={DEMO_CANVAS_NODES}
              edges={DEMO_CANVAS_EDGES}
              fitPadding={0.18}
              className="h-full"
              embedRenderer={DemoCanvasEmbedRenderer}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
