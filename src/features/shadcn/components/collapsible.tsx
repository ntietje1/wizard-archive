'use client'

import * as React from 'react'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import type { HTMLMotionProps } from 'motion/react'

type CollapsibleContextType = {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const CollapsibleContext = React.createContext<
  CollapsibleContextType | undefined
>(undefined)

function useCollapsible() {
  const context = React.useContext(CollapsibleContext)
  if (context === undefined) {
    throw new Error('useCollapsible must be used within Collapsible')
  }
  return context
}

function Collapsible({
  open,
  onOpenChange,
  ...props
}: CollapsiblePrimitive.Root.Props) {
  const [internalOpen, setInternalOpen] = React.useState(open ?? false)
  const isOpen = open ?? internalOpen

  const handleOpenChange = React.useCallback(
    (
      newOpen: boolean,
      eventDetails: Parameters<
        NonNullable<CollapsiblePrimitive.Root.Props['onOpenChange']>
      >[1],
    ) => {
      if (open === undefined) {
        setInternalOpen(newOpen)
      }
      onOpenChange?.(newOpen, eventDetails)
    },
    [open, onOpenChange],
  )

  const setIsOpen = React.useCallback(
    (newOpen: boolean) => {
      handleOpenChange(newOpen, {
        reason: 'none',
        event: new Event('change'),
        cancel: () => {},
        allowPropagation: () => {},
        isCanceled: false,
        isPropagationAllowed: true,
        trigger: undefined,
      } as Parameters<
        NonNullable<CollapsiblePrimitive.Root.Props['onOpenChange']>
      >[1])
    },
    [handleOpenChange],
  )

  return (
    <CollapsibleContext.Provider value={{ isOpen, setIsOpen }}>
      <CollapsiblePrimitive.Root
        data-slot="collapsible"
        open={isOpen}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </CollapsibleContext.Provider>
  )
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  )
}

type CollapsibleContentProps = Omit<
  CollapsiblePrimitive.Panel.Props,
  'keepMounted' | 'render'
> &
  HTMLMotionProps<'div'> & {
    keepRendered?: boolean
  }

function CollapsibleContent({
  transition = { duration: 0.2, ease: 'linear' },
  hiddenUntilFound,
  keepRendered = true,
  style,
  ...props
}: CollapsibleContentProps) {
  const { isOpen } = useCollapsible()
  const prefersReducedMotion = useReducedMotion()
  const resolvedTransition = prefersReducedMotion ? { duration: 0 } : transition

  return (
    <CollapsiblePrimitive.Panel
      hidden={false}
      hiddenUntilFound={hiddenUntilFound}
      keepMounted
      render={
        <AnimatePresence mode="wait">
          {keepRendered ? (
            <m.div
              key="collapsible-content"
              data-slot="collapsible-content"
              initial={{ height: 0 }}
              animate={
                isOpen
                  ? { height: 'auto', visibility: 'visible' as const }
                  : { height: 0, visibility: 'hidden' as const }
              }
              transition={{
                ...resolvedTransition,
                visibility: {
                  delay: isOpen ? 0 : (resolvedTransition.duration ?? 0),
                },
              }}
              aria-hidden={!isOpen}
              inert={!isOpen ? true : undefined}
              style={{
                overflow: 'hidden',
                ...style,
              }}
              {...props}
            />
          ) : (
            isOpen && (
              <m.div
                key="collapsible-content"
                data-slot="collapsible-content"
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={resolvedTransition}
                style={{
                  overflow: 'hidden',
                  ...style,
                }}
                {...props}
              />
            )
          )}
        </AnimatePresence>
      }
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
