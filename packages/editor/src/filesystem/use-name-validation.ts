import { validateResourceTitle } from '../workspace/items'
interface UseNameValidationOptions {
  name: string
  initialName: string
  isActive: boolean
}

export function useNameValidation({ name, initialName, isActive }: UseNameValidationOptions) {
  const validation = isActive ? validateResourceTitle(name) : { valid: true as const }
  const validationError = validation.valid ? undefined : validation.error

  return {
    debouncedName: name,
    shouldValidate: isActive && name !== initialName,
    isUnique: validation.valid,
    isNotUnique: false,
    validateName: (value: string) => {
      if (!isActive) return undefined
      const result = validateResourceTitle(value)
      return result.valid ? undefined : result.error
    },
    validationError,
    hasError: !validation.valid,
  }
}
