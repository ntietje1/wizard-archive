import { Handle, Position } from '@xyflow/react'
import { AlertTriangle } from 'lucide-react'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import type { NodeProps } from '@xyflow/react'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'

export function EmbedNode({ id, data, selected, dragging }: NodeProps) {
  const sidebarItemId = data.sidebarItemId as SidebarItemId | undefined
  const { itemsMap } = useActiveSidebarItems()
  const item = sidebarItemId ? itemsMap.get(sidebarItemId) : undefined

  const Icon = getSidebarItemIcon(item)
  const label = item?.name ?? 'Missing item'
  const typeLabel = item?.type ?? 'unknown'
  const isMissing = !item

  return (
    <ResizableNodeWrapper
      id={id}
      selected={!!selected}
      dragging={!!dragging}
      minWidth={140}
      minHeight={40}
    >
      <div className="h-full w-full px-3 py-2.5 rounded-lg border bg-card shadow-sm">
        <Handle type="target" position={Position.Top} className="!bg-primary" />
        <div className="flex items-center gap-2 min-w-0">
          {isMissing ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate select-none">{label}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest select-none">
              {typeLabel}
            </p>
          </div>
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-primary"
        />
      </div>
    </ResizableNodeWrapper>
  )
}
