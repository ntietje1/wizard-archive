import { use, useEffect, useId, useLayoutEffect, useReducer, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, Dispatch, MouseEvent as ReactMouseEvent, RefObject } from 'react'
import { CircleHelp } from 'lucide-react'
import { NOTE_VALUE_FUNCTIONS, NOTE_VALUE_SLUG_OPTIONS } from '../values/constants'
import { validateSlug } from '../../../../../shared/slugs'
import type { NoteValueProps } from '../values/schema'
import type { NoteValueRuntimeState } from '../values/state-contract'
import { FormulaInput } from './formula-input'
import { useNoteValueRuntime } from './value-block-runtime-context'
import { ValueInlineChip } from './value-inline-chip'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { Input } from '@wizard-archive/ui/shadcn/components/input'
import { Label } from '@wizard-archive/ui/shadcn/components/label'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { useSlugFieldFeedback } from '@wizard-archive/ui/hooks/use-slug-field-feedback'
import { BlockNoteContextMenuContext } from '../context-menu/blocknote-context-menu'

const POPOVER_WIDTH = 384
const VIEWPORT_PADDING = 16
const ANCHOR_OFFSET = 8
const VALIDATION_FEEDBACK_DELAY_MS = 400

interface ValuePopoverState {
  open: boolean
  functionsOpen: boolean
  anchorRect: DOMRect | null
  popoverHeight: number | null
}

type ValuePopoverAction =
  | { type: 'open'; anchorRect: DOMRect | null }
  | { type: 'toggle'; anchorRect: DOMRect | null }
  | { type: 'close' }
  | { type: 'toggleFunctions' }
  | { type: 'setAnchorRect'; anchorRect: DOMRect }
  | { type: 'setPopoverHeight'; height: number | null }

const initialValuePopoverState: ValuePopoverState = {
  open: false,
  functionsOpen: false,
  anchorRect: null,
  popoverHeight: null,
}

function valuePopoverReducer(
  state: ValuePopoverState,
  action: ValuePopoverAction,
): ValuePopoverState {
  switch (action.type) {
    case 'open':
      return {
        ...state,
        open: true,
        functionsOpen: false,
        anchorRect: action.anchorRect ?? state.anchorRect,
      }
    case 'toggle':
      return {
        ...state,
        open: !state.open,
        functionsOpen: state.open ? false : state.functionsOpen,
        anchorRect: action.anchorRect ?? state.anchorRect,
      }
    case 'close':
      return { ...state, open: false, functionsOpen: false }
    case 'toggleFunctions':
      return { ...state, functionsOpen: !state.functionsOpen }
    case 'setAnchorRect':
      return { ...state, anchorRect: action.anchorRect }
    case 'setPopoverHeight':
      return { ...state, popoverHeight: action.height }
  }
}

function getPopoverStyle(anchorRect: DOMRect, popoverHeight: number | null): CSSProperties {
  const width = Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2)
  const left = Math.min(
    Math.max(anchorRect.left, VIEWPORT_PADDING),
    window.innerWidth - width - VIEWPORT_PADDING,
  )
  const estimatedHeight = popoverHeight ?? 260
  const belowTop = anchorRect.bottom + ANCHOR_OFFSET
  const aboveTop = anchorRect.top - estimatedHeight - ANCHOR_OFFSET
  const hasRoomBelow = belowTop + estimatedHeight <= window.innerHeight - VIEWPORT_PADDING
  const top = hasRoomBelow ? belowTop : Math.max(VIEWPORT_PADDING, aboveTop)

  return {
    position: 'fixed',
    left,
    top,
    width,
    zIndex: 60,
  }
}

function ValueInlinePopover({
  anchorRect,
  popoverHeight,
  functionsOpen,
  popoverRef,
  slugInputId,
  formulaInputId,
  resultLabelId,
  slug,
  slugError,
  expressionSource,
  displayedValue,
  showSlugError,
  showValidationError,
  expressionInputRef,
  slugInputRef,
  onToggleFunctions,
  onSlugChange,
  onSlugBlur,
  onFormulaChange,
  onFormulaBlur,
  onClose,
}: {
  anchorRect: DOMRect
  popoverHeight: number | null
  functionsOpen: boolean
  popoverRef: RefObject<HTMLDialogElement | null>
  slugInputId: string
  formulaInputId: string
  resultLabelId: string
  slug: string
  slugError: string | null
  expressionSource: string
  displayedValue: string
  showSlugError: boolean
  showValidationError: boolean
  expressionInputRef: RefObject<HTMLInputElement | null>
  slugInputRef: RefObject<HTMLInputElement | null>
  onToggleFunctions: () => void
  onSlugChange: (rawSlug: string) => void
  onSlugBlur: () => void
  onFormulaChange: (expressionSource: string) => void
  onFormulaBlur: () => void
  onClose: () => void
}) {
  return createPortal(
    <dialog
      ref={popoverRef}
      style={getPopoverStyle(anchorRect, popoverHeight)}
      aria-label="Edit value"
      data-testid="note-value-popover"
      className="max-w-[calc(100vw-2rem)] border-0 bg-transparent p-0 text-popover-foreground backdrop:bg-transparent"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="relative grid min-w-0 gap-3 rounded-lg border border-border bg-popover p-3 shadow-md">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1.5 right-1.5"
          aria-label="Formula functions"
          aria-expanded={functionsOpen}
          onClick={onToggleFunctions}
        >
          <CircleHelp />
        </Button>
        {functionsOpen ? (
          <section
            aria-label="Formula functions"
            className="absolute top-8 right-1.5 z-10 grid w-64 gap-2 rounded-md border border-border bg-popover p-2 text-xs shadow-md"
          >
            {NOTE_VALUE_FUNCTIONS.map((fn) => (
              <div key={fn.name} className="grid gap-0.5">
                <code className="font-mono text-foreground">{fn.signature}</code>
                <span className="text-muted-foreground">{fn.description}</span>
              </div>
            ))}
          </section>
        ) : null}
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={slugInputId}>Slug</Label>
          <Input
            id={slugInputId}
            ref={slugInputRef}
            aria-label="Value slug"
            value={slug}
            onChange={(event) => onSlugChange(event.target.value)}
            onBlur={onSlugBlur}
            aria-invalid={showSlugError || undefined}
            className={cn(showSlugError && 'border-destructive focus-visible:ring-destructive/30')}
          />
          {showSlugError ? <p className="text-sm text-destructive">{slugError}</p> : null}
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={formulaInputId}>Formula</Label>
          <FormulaInput
            id={formulaInputId}
            ref={expressionInputRef}
            value={expressionSource}
            showValidationError={showValidationError}
            onChange={onFormulaChange}
            onBlur={onFormulaBlur}
            placeholder="e.g. [[strength_mod]] + [[Sheet.prof_bonus]]"
          />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label id={resultLabelId}>Result</Label>
          <div
            aria-labelledby={resultLabelId}
            className={cn(
              'min-w-0 rounded border border-border/70 bg-muted/40 p-2 text-sm break-words',
              showValidationError && 'border-destructive/40 bg-destructive/10 text-destructive',
            )}
            data-testid="note-value-preview"
          >
            {displayedValue}
          </div>
        </div>
      </div>
    </dialog>,
    document.body,
  )
}

function getValueSlugError(
  slug: string,
  valueId: string,
  definitions: ReturnType<typeof useNoteValueRuntime>['authoredDefinitions'],
): string | null {
  const validationError = validateSlug(slug, NOTE_VALUE_SLUG_OPTIONS)
  if (validationError) return validationError
  const isDuplicate = definitions.some(
    (definition) => definition.valueId !== valueId && definition.slug === slug,
  )
  return isDuplicate ? `Value slug "${slug}" is already used` : null
}

function useValuePopoverAnchor({
  chipRef,
  dispatchPopover,
  open,
  popoverRef,
  anchorRect,
}: {
  chipRef: RefObject<HTMLSpanElement | null>
  dispatchPopover: Dispatch<ValuePopoverAction>
  open: boolean
  popoverRef: RefObject<HTMLDialogElement | null>
  anchorRect: DOMRect | null
}) {
  useEffect(() => {
    if (!open) return

    const updateAnchor = () => {
      const rect = chipRef.current?.getBoundingClientRect()
      if (rect) {
        dispatchPopover({ type: 'setAnchorRect', anchorRect: rect })
      }
    }

    updateAnchor()
    window.addEventListener('resize', updateAnchor)
    window.addEventListener('scroll', updateAnchor, true)
    return () => {
      window.removeEventListener('resize', updateAnchor)
      window.removeEventListener('scroll', updateAnchor, true)
    }
  }, [chipRef, dispatchPopover, open])

  useLayoutEffect(() => {
    if (!open) {
      dispatchPopover({ type: 'setPopoverHeight', height: null })
      return
    }
    const height = popoverRef.current?.getBoundingClientRect().height
    if (height) {
      dispatchPopover({ type: 'setPopoverHeight', height })
    }
  }, [anchorRect, dispatchPopover, open, popoverRef])
}

function useValuePopoverDismiss({
  chipRef,
  dispatchPopover,
  open,
  popoverRef,
}: {
  chipRef: RefObject<HTMLSpanElement | null>
  dispatchPopover: Dispatch<ValuePopoverAction>
  open: boolean
  popoverRef: RefObject<HTMLDialogElement | null>
}) {
  useEffect(() => {
    if (!open) return

    const closeFromOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (target === popoverRef.current) {
        dispatchPopover({ type: 'close' })
        return
      }
      if (chipRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return
      }
      dispatchPopover({ type: 'close' })
    }
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dispatchPopover({ type: 'close' })
        chipRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', closeFromOutsidePointer, true)
    document.addEventListener('keydown', closeFromEscape)
    return () => {
      document.removeEventListener('pointerdown', closeFromOutsidePointer, true)
      document.removeEventListener('keydown', closeFromEscape)
    }
  }, [chipRef, dispatchPopover, open, popoverRef])
}

function useValuePopoverDialog({
  chipRef,
  dispatchPopover,
  open,
  popoverRef,
}: {
  chipRef: RefObject<HTMLSpanElement | null>
  dispatchPopover: Dispatch<ValuePopoverAction>
  open: boolean
  popoverRef: RefObject<HTMLDialogElement | null>
}) {
  useEffect(() => {
    const dialog = popoverRef.current
    if (!open || !dialog) return
    const chip = chipRef.current

    const handleClose = () => {
      dispatchPopover({ type: 'close' })
    }

    dialog.addEventListener('close', handleClose)

    if (typeof dialog.show === 'function') {
      if (!dialog.open) dialog.show()
    } else {
      dialog.setAttribute('open', '')
    }

    return () => {
      dialog.removeEventListener('close', handleClose)
      if (typeof dialog.close === 'function') {
        if (dialog.open) dialog.close()
      } else {
        dialog.removeAttribute('open')
      }
      chip?.focus()
    }
  }, [chipRef, dispatchPopover, open, popoverRef])
}

function getValueDisplayState({
  expressionSource,
  popoverOpen,
  showValidationFeedback,
  state,
}: {
  expressionSource: string
  popoverOpen: boolean
  showValidationFeedback: boolean
  state: NoteValueRuntimeState | undefined
}) {
  const hasError = state?.status === 'error'
  const showValidationError = hasError && showValidationFeedback
  const hasFormula = expressionSource.trim().length > 0

  if (state?.status === 'ok') {
    return {
      displayedValue: state.formattedValue,
      chipDisplayedValue: state.formattedValue,
      chipHasError: false,
      chipIsLoading: false,
      hasError,
      showValidationError,
    }
  }

  const errorMessage = state?.status === 'error' ? (state.errorMessage ?? 'Invalid formula') : null
  const chipShouldShowError = hasError && (!popoverOpen || showValidationFeedback)
  const pendingMessage = hasFormula ? 'Checking formula' : 'No formula'

  return {
    displayedValue: errorMessage && showValidationError ? errorMessage : pendingMessage,
    chipDisplayedValue: errorMessage && chipShouldShowError ? errorMessage : pendingMessage,
    chipHasError: chipShouldShowError,
    chipIsLoading: !hasError && hasFormula,
    hasError,
    showValidationError,
  }
}

export function ValueInlineContent({
  inlineContent,
  updateInlineContent,
}: {
  inlineContent: {
    props: NoteValueProps
  }
  updateInlineContent: (update: { type: 'value'; props: NoteValueProps }) => void
}) {
  const { authoredDefinitions, editable, stateByValueId } = useNoteValueRuntime()
  const state = stateByValueId.get(inlineContent.props.valueId)
  const [popoverState, dispatchPopover] = useReducer(valuePopoverReducer, initialValuePopoverState)
  const chipRef = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLDialogElement>(null)
  const slugInputRef = useRef<HTMLInputElement>(null)
  const expressionInputRef = useRef<HTMLInputElement>(null)
  const valueInstanceId = useId()
  const latestPropsRef = useRef(inlineContent.props)
  const openPopoverFromContextMenuRef = useRef<() => void>(() => {})
  const stopWatchingDragStartRef = useRef<(() => void) | null>(null)
  const blockNoteContextMenu = use(BlockNoteContextMenuContext)
  const registerValueInlineEdit = blockNoteContextMenu?.registerValueInlineEdit
  const inputId = `note-value-${inlineContent.props.valueId}`
  const slugInputId = `${inputId}-slug`
  const formulaInputId = `${inputId}-formula`
  const resultLabelId = `${inputId}-result-label`
  const {
    showFeedback: showValidationFeedback,
    scheduleFeedback: scheduleValidationFeedback,
    showFeedbackNow: showValidationFeedbackNow,
  } = useSlugFieldFeedback(VALIDATION_FEEDBACK_DELAY_MS)
  const {
    showFeedback: showSlugFeedback,
    scheduleFeedback: scheduleSlugFeedback,
    showFeedbackNow: showSlugFeedbackNow,
  } = useSlugFieldFeedback()

  useValuePopoverAnchor({
    chipRef,
    dispatchPopover,
    open: popoverState.open,
    popoverRef,
    anchorRect: popoverState.anchorRect,
  })
  useValuePopoverDismiss({
    chipRef,
    dispatchPopover,
    open: popoverState.open,
    popoverRef,
  })
  useValuePopoverDialog({
    chipRef,
    dispatchPopover,
    open: popoverState.open,
    popoverRef,
  })

  useEffect(() => () => stopWatchingDragStartRef.current?.(), [])

  useEffect(() => {
    if (!editable) return
    return registerValueInlineEdit?.(inlineContent.props.valueId, valueInstanceId, () => {
      openPopoverFromContextMenuRef.current()
    })
  }, [editable, inlineContent.props.valueId, registerValueInlineEdit, valueInstanceId])

  useEffect(() => {
    if (!popoverState.open) return
    slugInputRef.current?.focus()
  }, [popoverState.open])

  latestPropsRef.current = inlineContent.props

  const {
    displayedValue,
    chipDisplayedValue,
    chipHasError,
    chipIsLoading,
    hasError,
    showValidationError,
  } = getValueDisplayState({
    expressionSource: inlineContent.props.expressionSource,
    popoverOpen: popoverState.open,
    showValidationFeedback,
    state,
  })
  const slugError = getValueSlugError(
    inlineContent.props.slug,
    inlineContent.props.valueId,
    authoredDefinitions,
  )

  const togglePopover = () => {
    if (!popoverState.open) {
      showValidationFeedbackNow()
      showSlugFeedbackNow()
    }
    dispatchPopover({
      type: 'toggle',
      anchorRect: chipRef.current?.getBoundingClientRect() ?? null,
    })
  }
  openPopoverFromContextMenuRef.current = () => {
    showValidationFeedbackNow()
    showSlugFeedbackNow()
    dispatchPopover({
      type: 'open',
      anchorRect: chipRef.current?.getBoundingClientRect() ?? null,
    })
  }

  const updateProps = (patch: Partial<NoteValueProps>) => {
    const nextProps = {
      ...latestPropsRef.current,
      ...patch,
    }
    latestPropsRef.current = nextProps
    updateInlineContent({
      type: 'value',
      props: nextProps,
    })
  }

  const selectChipForDrag = () => {
    const chip = chipRef.current
    if (!chip) return

    const selection = window.getSelection()
    if (!selection?.isCollapsed && selection?.containsNode(chip, true)) {
      return
    }

    const range = document.createRange()
    range.selectNode(chip)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  const watchForDragGesture = (event: ReactMouseEvent<HTMLSpanElement>) => {
    const startX = event.clientX
    const startY = event.clientY

    stopWatchingDragStartRef.current?.()
    const stopWatching = () => {
      document.removeEventListener('mousemove', armDragSelection, true)
      document.removeEventListener('mouseup', stopWatching, true)
      stopWatchingDragStartRef.current = null
    }
    const armDragSelection = (moveEvent: MouseEvent) => {
      if ((moveEvent.buttons & 1) === 0) {
        stopWatching()
        return
      }

      const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY)
      if (distance < 4) return

      selectChipForDrag()
      stopWatching()
    }

    document.addEventListener('mousemove', armDragSelection, true)
    document.addEventListener('mouseup', stopWatching, true)
    stopWatchingDragStartRef.current = stopWatching
  }

  if (!editable) {
    return (
      <ValueInlineChip
        spanRef={chipRef}
        slug={inlineContent.props.slug}
        displayedValue={chipDisplayedValue}
        hasError={hasError}
        isLoading={chipIsLoading}
        valueId={inlineContent.props.valueId}
        valueInstanceId={valueInstanceId}
        state={state?.status ?? 'pending'}
      />
    )
  }

  const chip = (
    <ValueInlineChip
      spanRef={chipRef}
      slug={inlineContent.props.slug}
      displayedValue={chipDisplayedValue}
      hasError={chipHasError}
      isLoading={chipIsLoading}
      valueId={inlineContent.props.valueId}
      valueInstanceId={valueInstanceId}
      state={state?.status ?? 'pending'}
      draggable
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-expanded={popoverState.open}
      onMouseDown={(event) => {
        if (event.button === 0) {
          event.currentTarget.focus()
          watchForDragGesture(event)
        }
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'copyMove'
        event.dataTransfer.setData('application/x-note-value-id', inlineContent.props.valueId)
      }}
      onClick={(event) => {
        event.stopPropagation()
        togglePopover()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        togglePopover()
      }}
    />
  )

  return (
    <>
      {chip}
      {popoverState.open && popoverState.anchorRect ? (
        <ValueInlinePopover
          anchorRect={popoverState.anchorRect}
          popoverHeight={popoverState.popoverHeight}
          functionsOpen={popoverState.functionsOpen}
          popoverRef={popoverRef}
          slugInputId={slugInputId}
          formulaInputId={formulaInputId}
          resultLabelId={resultLabelId}
          slug={inlineContent.props.slug}
          slugError={slugError}
          expressionSource={inlineContent.props.expressionSource}
          displayedValue={displayedValue}
          showSlugError={Boolean(slugError && showSlugFeedback)}
          showValidationError={showValidationError}
          expressionInputRef={expressionInputRef}
          slugInputRef={slugInputRef}
          onToggleFunctions={() => dispatchPopover({ type: 'toggleFunctions' })}
          onSlugChange={(rawSlug) => {
            scheduleSlugFeedback()
            updateProps({ slug: rawSlug })
          }}
          onSlugBlur={showSlugFeedbackNow}
          onFormulaChange={(expressionSource) => {
            scheduleValidationFeedback()
            updateProps({ expressionSource })
          }}
          onFormulaBlur={showValidationFeedbackNow}
          onClose={() => dispatchPopover({ type: 'close' })}
        />
      ) : null}
    </>
  )
}
