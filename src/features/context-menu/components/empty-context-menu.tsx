import {
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuLabel,
  ContextMenuTrigger,
  ContextMenu as ShadcnContextMenu,
} from '~/features/shadcn/components/context-menu'

export function EmptyContextMenu({ children }: { children: React.ReactNode }) {
  return (
    <ShadcnContextMenu open={false} onOpenChange={() => {}}>
      <ContextMenuTrigger
        render={
          <div
            style={{ display: 'contents' }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            {children}
          </div>
        }
      />
    </ShadcnContextMenu>
  )
}

export function PlaceHolderContextMenu({ children }: { children: React.ReactNode }) {
  if (import.meta.env.DEV) {
    return (
      <ShadcnContextMenu>
        <ContextMenuTrigger render={<div style={{ display: 'contents' }}>{children}</div>} />
        <ContextMenuContent side="bottom" align="center" sideOffset={4}>
          <ContextMenuGroup>
            <ContextMenuLabel>
              ⚠️ DEV WARNING: PlaceHolderContextMenu shown (no context menu registered)
            </ContextMenuLabel>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ShadcnContextMenu>
    )
  }
  return <EmptyContextMenu>{children}</EmptyContextMenu>
}
