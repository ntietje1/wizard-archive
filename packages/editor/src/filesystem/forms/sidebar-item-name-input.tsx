import { useId } from 'react'
import { Loader } from 'lucide-react'
import { Label } from '@wizard-archive/ui/shadcn/components/label'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@wizard-archive/ui/shadcn/components/input-group'

interface SidebarItemNameInputProps {
  disabled: boolean
  errors: Array<string | Error>
  isValidating: boolean
  label: string
  name: string
  onBlur: () => void
  onChange: (value: string) => void
  placeholder: string
  value: string
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return undefined
}

export function SidebarItemNameInput({
  disabled,
  errors,
  isValidating,
  label,
  name,
  onBlur,
  onChange,
  placeholder,
  value,
}: SidebarItemNameInputProps) {
  const errorMessage = getErrorMessage(errors[0])
  const inputId = useId()
  const errorId = useId()

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <InputGroup>
        <InputGroupInput
          id={inputId}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus
          aria-invalid={errors.length > 0}
          aria-describedby={errorMessage ? errorId : undefined}
        />
        {isValidating && (
          <InputGroupAddon
            align="inline-end"
            role="status"
            tabIndex={-1}
            aria-label={`Checking ${label}`}
          >
            <Loader aria-hidden="true" className="size-4 animate-spin" />
          </InputGroupAddon>
        )}
      </InputGroup>
      {errorMessage ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
