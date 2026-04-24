import * as React from 'react'
import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { CheckIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '~/features/shadcn/lib/utils'

type VirtualAnchor = {
  getBoundingClientRect: () => DOMRect
}

type ContextMenuPosition = {
  x: number
  y: number
}

type ContextMenuAnchor = MenuPrimitive.Positioner.Props['anchor']

type ContextMenuProps = Omit<MenuPrimitive.Root.Props, 'children'> & {
  children?: React.ReactNode
}

type ContextMenuRootContextValue = {
  anchor: ContextMenuAnchor
  openAt: (position: ContextMenuPosition) => void
  close: () => void
}

const ContextMenuRootContext = React.createContext<ContextMenuRootContextValue | null>(null)

const CONTEXT_MENU_OPEN_OFFSET = { x: 8, y: 0 } as const

const offsetContextMenuPosition = (position: ContextMenuPosition): ContextMenuPosition => ({
  x: position.x + CONTEXT_MENU_OPEN_OFFSET.x,
  y: position.y + CONTEXT_MENU_OPEN_OFFSET.y,
})

const createVirtualAnchor = (position: ContextMenuPosition): VirtualAnchor => ({
  getBoundingClientRect: () =>
    DOMRect.fromRect({
      width: 0,
      height: 0,
      x: position.x,
      y: position.y,
    }),
})

function composeEventHandlers<E extends React.SyntheticEvent | Event>(
  theirHandler: ((event: E) => void) | undefined,
  ourHandler: (event: E) => void,
) {
  return (event: E) => {
    theirHandler?.(event)
    if (!event.defaultPrevented) {
      ourHandler(event)
    }
  }
}

function useContextMenuRootContext() {
  const context = React.useContext(ContextMenuRootContext)

  if (!context) {
    throw new Error('Base UI: context menu components must be used within <ContextMenu>.')
  }

  return context
}

export interface ContextMenuRef {
  openAt: (position: ContextMenuPosition) => void
  close: () => void
}

const ContextMenu = React.forwardRef<ContextMenuRef, ContextMenuProps>(
  ({ children, onOpenChange, ...props }, forwardedRef) => {
    const handleRef = React.useRef(new MenuPrimitive.Handle())
    const fallbackTriggerRef = React.useRef<HTMLButtonElement>(null)
    const [anchor, setAnchor] = React.useState<ContextMenuAnchor>(null)

    const close = React.useCallback(() => {
      handleRef.current.close()
    }, [])

    const openAt = React.useCallback((position: ContextMenuPosition) => {
      setAnchor(createVirtualAnchor(offsetContextMenuPosition(position)))

      if (handleRef.current.isOpen) {
        return
      }

      fallbackTriggerRef.current?.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
          clientX: position.x,
          clientY: position.y,
        }),
      )
    }, [])

    React.useImperativeHandle(
      forwardedRef,
      () => ({
        openAt,
        close,
      }),
      [close, openAt],
    )

    const handleOpenChange = React.useCallback<
      NonNullable<MenuPrimitive.Root.Props['onOpenChange']>
    >(
      (open, eventDetails) => {
        if (!open) {
          setAnchor(null)
        }
        onOpenChange?.(open, eventDetails)
      },
      [onOpenChange],
    )

    const contextValue = React.useMemo(
      () => ({
        anchor,
        openAt,
        close,
      }),
      [anchor, close, openAt],
    )

    return (
      <ContextMenuRootContext.Provider value={contextValue}>
        <MenuPrimitive.Root
          handle={handleRef.current}
          modal={false}
          onOpenChange={handleOpenChange}
          {...props}
        >
          <MenuPrimitive.Trigger
            ref={fallbackTriggerRef}
            handle={handleRef.current}
            aria-hidden="true"
            className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px opacity-0"
            tabIndex={-1}
          />
          {children}
        </MenuPrimitive.Root>
      </ContextMenuRootContext.Provider>
    )
  },
)

ContextMenu.displayName = 'ContextMenu'

interface ContextMenuTriggerProps {
  render?: ContextMenuTriggerElement
  children?: ContextMenuTriggerElement
  disabled?: boolean
  className?: string
}

type ContextMenuTriggerElementProps = {
  className?: string
  onContextMenu?: React.MouseEventHandler<HTMLElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>
  'data-slot'?: string
}

type ContextMenuTriggerElement = React.ReactElement<ContextMenuTriggerElementProps>

function ContextMenuTrigger({
  render,
  children,
  disabled = false,
  className,
}: ContextMenuTriggerProps) {
  const { openAt } = useContextMenuRootContext()
  const triggerElement = render ?? children

  if (!React.isValidElement<ContextMenuTriggerElementProps>(triggerElement)) {
    if (import.meta.env.DEV) {
      console.warn('ContextMenu received an invalid trigger element', triggerElement)
    }
    return null
  }

  const openFromKeyboard = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect()
    openAt({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }

  return React.cloneElement(triggerElement, {
    'data-slot': 'context-menu-trigger',
    className: cn('select-none', className, triggerElement.props.className),
    onContextMenu: composeEventHandlers(
      triggerElement.props.onContextMenu,
      (event: React.MouseEvent<HTMLElement>) => {
        if (disabled) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        event.nativeEvent.stopImmediatePropagation?.()
        openAt({
          x: event.clientX,
          y: event.clientY,
        })
      },
    ),
    onKeyDown: composeEventHandlers(
      triggerElement.props.onKeyDown,
      (event: React.KeyboardEvent<HTMLElement>) => {
        if (disabled) {
          return
        }

        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault()
          event.stopPropagation()
          openFromKeyboard(event.currentTarget)
        }
      },
    ),
  })
}

function ContextMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
}

function ContextMenuContent({
  className,
  align = 'start',
  alignOffset = 4,
  anchor,
  side = 'right',
  sideOffset = 0,
  useRootAnchor = true,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'anchor' | 'side' | 'sideOffset'
  > & {
    useRootAnchor?: boolean
  }) {
  const rootContext = useContextMenuRootContext()
  const resolvedAnchor = anchor ?? (useRootAnchor ? rootContext.anchor : undefined)

  return (
    <ContextMenuPortal>
      <MenuPrimitive.Positioner
        className="isolate z-9999 outline-none"
        align={align}
        alignOffset={alignOffset}
        anchor={resolvedAnchor}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(
            'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 bg-popover text-popover-foreground min-w-36 rounded-lg p-1 shadow-md ring-1 duration-100 z-9999 max-h-(--available-height) origin-(--transform-origin) overflow-x-hidden overflow-y-auto outline-none',
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </ContextMenuPortal>
  )
}

function ContextMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="context-menu-group" {...props} />
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="context-menu-label"
      data-inset={inset}
      className={cn(
        'text-muted-foreground px-1.5 py-1 text-xs font-medium data-[inset]:pl-8',
        className,
      )}
      {...props}
    />
  )
}

function ContextMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean
  variant?: 'default' | 'destructive'
}) {
  return (
    <MenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:text-destructive focus:*:[svg]:text-accent-foreground gap-1.5 rounded-md px-1.5 py-1 text-sm [&_svg:not([class*='size-'])]:size-4 group/context-menu-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  )
}

function ContextMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="context-menu-sub" {...props} />
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground gap-1.5 rounded-md px-1.5 py-1 text-sm [&_svg:not([class*='size-'])]:size-4 flex cursor-default items-center outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </MenuPrimitive.SubmenuTrigger>
  )
}

function ContextMenuSubContent({ ...props }: React.ComponentProps<typeof ContextMenuContent>) {
  return (
    <ContextMenuContent
      data-slot="context-menu-sub-content"
      className="shadow-lg"
      side="right"
      useRootAnchor={false}
      {...props}
    />
  )
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm [&_svg:not([class*='size-'])]:size-4 relative flex cursor-default items-center outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute right-2 pointer-events-none">
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function ContextMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...props} />
}

function ContextMenuRadioItem({ className, children, ...props }: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm [&_svg:not([class*='size-'])]:size-4 relative flex cursor-default items-center outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 pointer-events-none">
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

function ContextMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn('bg-border -mx-1 my-1 h-px', className)}
      {...props}
    />
  )
}

function ContextMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn(
        'text-muted-foreground group-focus/context-menu-item:text-accent-foreground ml-auto text-xs tracking-widest',
        className,
      )}
      {...props}
    />
  )
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}
