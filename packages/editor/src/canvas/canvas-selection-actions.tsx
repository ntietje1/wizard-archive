import { CANVAS_ARRANGE_ACTIONS, createCanvasArrangeChange } from './canvas-arrange'
import type { CanvasDocumentController } from './document-controller'
import type { CanvasDocumentContent } from './document-contract'
import type { CanvasInteractionSnapshot } from './interaction-controller'
import { CANVAS_REORDER_ACTIONS, createCanvasReorderChange } from './canvas-z-order'

export function CanvasSelectionActions({
  canEdit,
  content,
  documentController,
  interaction,
}: {
  canEdit: boolean
  content: CanvasDocumentContent
  documentController: CanvasDocumentController
  interaction: CanvasInteractionSnapshot
}) {
  const selectedNodeCount = interaction.selection.nodeIds.size
  const selectedCount = selectedNodeCount + interaction.selection.edgeIds.size
  if (!canEdit || interaction.tool !== 'select' || selectedCount === 0) return null
  return (
    <div className="absolute left-3 top-3 z-20 flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-sm backdrop-blur">
      <select
        aria-label="Arrange selection"
        className="h-8 rounded-md border bg-background px-2 text-xs disabled:opacity-50"
        disabled={selectedNodeCount < 2}
        value=""
        onChange={(event) => {
          const action = CANVAS_ARRANGE_ACTIONS.find(({ id }) => id === event.currentTarget.value)
          if (!action) return
          const change = createCanvasArrangeChange(content, interaction.selection, action.id)
          if (change) documentController.apply(change)
        }}
      >
        <option value="">Arrange</option>
        {CANVAS_ARRANGE_ACTIONS.map((action) => (
          <option
            key={action.id}
            disabled={selectedNodeCount < action.minimumNodes}
            value={action.id}
          >
            {action.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Layer selection"
        className="h-8 rounded-md border bg-background px-2 text-xs"
        value=""
        onChange={(event) => {
          const action = CANVAS_REORDER_ACTIONS.find(({ id }) => id === event.currentTarget.value)
          if (!action) return
          const change = createCanvasReorderChange(content, interaction.selection, action.id)
          if (change) documentController.apply(change)
        }}
      >
        <option value="">Layer</option>
        {CANVAS_REORDER_ACTIONS.map((action) => (
          <option key={action.id} value={action.id}>
            {action.label}
          </option>
        ))}
      </select>
    </div>
  )
}
