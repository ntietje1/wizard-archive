import {
  ContextMenuTrigger,
  ContextMenu as ShadcnContextMenu,
} from "~/components/shadcn/ui/context-menu";

export function EmptyContextMenu({ children }: { children: React.ReactNode }) {
  return (
    <ShadcnContextMenu open={false} onOpenChange={() => {}}>
      <ContextMenuTrigger
        render={
          <div 
            style={{ display: 'contents' }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {children}
          </div>
        }
      />
    </ShadcnContextMenu>
  )
}   