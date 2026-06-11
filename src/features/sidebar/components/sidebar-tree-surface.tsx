import { SidebarItemButtonBase } from './sidebar-item/sidebar-item-button-base'
import type { SidebarItemButtonProps } from './sidebar-item/types'
import { Collapsible, CollapsibleContent } from '~/features/shadcn/components/collapsible'
import type { ReactNode } from 'react'

export interface SidebarTreeSurfaceItem {
  id: string
  icon: SidebarItemButtonProps['icon']
  name: SidebarItemButtonProps['name']
  nameContent?: ReactNode
  visualState: SidebarItemButtonProps['presentation']['visualState']
  focused?: boolean
  renaming?: boolean
  expanded?: boolean
  showChevron?: boolean
  pending?: boolean
  indentLevel?: number
  linkProps?: SidebarItemButtonProps['linkProps']
  shareButton?: ReactNode
  children?: ReadonlyArray<SidebarTreeSurfaceItem>
  onClick?: SidebarItemButtonProps['onClick']
  onContextMenu?: SidebarItemButtonProps['onContextMenu']
  onMoreOptions?: SidebarItemButtonProps['onMoreOptions']
  onToggleExpanded?: SidebarItemButtonProps['onToggleExpanded']
}

interface SidebarTreeSurfaceProps {
  items: ReadonlyArray<SidebarTreeSurfaceItem>
  emptyState?: ReactNode
}

interface SidebarTreeNodeShellProps {
  children?: ReactNode
  expanded: boolean
  itemButton: ReactNode
  onExpandedChange?: (expanded: boolean) => void
}

export function SidebarTreeSurface({ emptyState = null, items }: SidebarTreeSurfaceProps) {
  if (items.length === 0) return emptyState

  return (
    <>
      {items.map((item) => (
        <SidebarTreeSurfaceNode key={item.id} item={item} depth={item.indentLevel ?? 0} />
      ))}
    </>
  )
}

export function SidebarTreeNodeShell({
  children,
  expanded,
  itemButton,
  onExpandedChange,
}: SidebarTreeNodeShellProps) {
  if (!children) return itemButton

  return (
    <Collapsible open={expanded} onOpenChange={onExpandedChange}>
      {itemButton}
      <CollapsibleContent
        transition={{
          duration: expanded ? 0.2 : 0.15,
          ease: 'easeInOut',
        }}
        keepRendered={false}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

function SidebarTreeSurfaceNode({ depth, item }: { depth: number; item: SidebarTreeSurfaceItem }) {
  const children = item.expanded ? item.children : undefined

  return (
    <SidebarTreeNodeShell
      expanded={item.expanded ?? false}
      itemButton={
        <SidebarItemButtonBase
          icon={item.icon}
          name={item.name}
          nameContent={item.nameContent}
          presentation={{
            visualState: item.visualState,
            focused: item.focused ?? false,
            renaming: item.renaming ?? false,
            expanded: item.expanded ?? false,
            showChevron: item.showChevron ?? false,
            pending: item.pending,
            indentLevel: depth,
          }}
          linkProps={item.linkProps}
          onClick={item.onClick}
          onContextMenu={item.onContextMenu}
          onMoreOptions={item.onMoreOptions}
          onToggleExpanded={item.onToggleExpanded}
          shareButton={item.shareButton}
        />
      }
    >
      {children?.map((child) => (
        <SidebarTreeSurfaceNode
          key={child.id}
          item={child}
          depth={child.indentLevel ?? depth + 1}
        />
      ))}
    </SidebarTreeNodeShell>
  )
}
