import { AlertTriangle, Sigma, X } from 'lucide-react'
import { useId, useState } from 'react'
import { noteValueReference } from './runtime'
import { useNoteValueRuntime } from './use-note-value-runtime'
import type { NoteValueProps } from './schema'

export function NoteValueInline({
  props,
  update,
}: {
  props: NoteValueProps
  update: (next: { type: 'value'; props: NoteValueProps }) => void
}) {
  const { definitions, editable, states } = useNoteValueRuntime()
  const [open, setOpen] = useState(false)
  const suggestionsId = useId()
  const state = states.get(props.valueId)
  const label = props.label.trim() || 'Value'
  const updateProps = (patch: Partial<NoteValueProps>) => {
    update({ type: 'value', props: { ...props, ...patch } })
  }
  return (
    <span className="note-value-owner" contentEditable={false}>
      <button
        type="button"
        className="note-value-inline"
        aria-label={`${label}: ${state?.formatted ?? props.expressionSource}`}
        data-note-value-id={props.valueId}
        data-note-value-state={state?.status ?? 'error'}
        draggable={editable}
        onClick={() => {
          if (editable) setOpen(true)
        }}
      >
        <Sigma aria-hidden="true" />
        <span>{label}</span>
        <span className="note-value-result">{state?.formatted ?? props.expressionSource}</span>
        {state?.status === 'error' && <AlertTriangle aria-label="Value error" />}
      </button>
      {open && editable && (
        <span className="note-value-popover" role="dialog" aria-label={`Edit ${label}`}>
          <span className="note-value-popover-heading">
            <strong>Edit value</strong>
            <button type="button" aria-label="Close value editor" onClick={() => setOpen(false)}>
              <X aria-hidden="true" />
            </button>
          </span>
          <label>
            Label
            <input
              aria-label="Value label"
              value={props.label}
              onChange={(event) => updateProps({ label: event.currentTarget.value })}
            />
          </label>
          <label>
            Formula
            <input
              aria-label="Value formula"
              list={suggestionsId}
              value={props.expressionSource}
              onChange={(event) => updateProps({ expressionSource: event.currentTarget.value })}
            />
          </label>
          <datalist id={suggestionsId}>
            {definitions.flatMap((definition) =>
              definition.valueId === props.valueId
                ? []
                : [
                    <option key={definition.valueId} value={noteValueReference(definition.valueId)}>
                      {definition.label}
                    </option>,
                  ],
            )}
            {['min()', 'max()', 'round()', 'floor()', 'ceil()', 'abs()'].map((formula) => (
              <option key={formula} value={formula} />
            ))}
          </datalist>
          {state?.status === 'error' && <span className="note-value-error">{state.error}</span>}
        </span>
      )}
    </span>
  )
}
