import { NOTE_VALUE_FUNCTION_BY_NAME } from './constants'
import { FormulaError } from './formula-errors'
import type { NoteValueCompiledFormula, NoteValueErrorCode } from './model'
import type { NoteValueBinding } from './state-contract'

type FormulaDependencyState =
  | { status: 'ok'; rawValue: number }
  | { status: 'error'; errorCode: NoteValueErrorCode; errorMessage: string }

type FormulaDependency<TNoteId> = (
  noteId: TNoteId,
  valueId: string,
) => FormulaDependencyState | null

export function validateFormulaFunctionCall(name: string, argCount: number): void {
  const metadata = NOTE_VALUE_FUNCTION_BY_NAME.get(name)
  if (!metadata) {
    throw new FormulaError('invalid_function_usage', `Unknown function "${name}"`)
  }
  if (argCount < metadata.minArgs) {
    throw new FormulaError(
      'invalid_function_usage',
      `${name} expects ${metadata.minArgs === 1 ? 'at least 1 argument' : `at least ${metadata.minArgs} arguments`}`,
    )
  }
  if (metadata.maxArgs !== undefined && argCount > metadata.maxArgs) {
    throw new FormulaError(
      'invalid_function_usage',
      `${name} expects exactly ${metadata.maxArgs} argument${metadata.maxArgs === 1 ? '' : 's'}`,
    )
  }
}

export function evaluateCompiledFormula<TNoteId>(
  formula: NoteValueCompiledFormula,
  bindings: Array<NoteValueBinding<TNoteId>>,
  getDependencyState: FormulaDependency<TNoteId>,
): number {
  return evaluateCompiledNode(
    formula,
    new Map(bindings.map((binding) => [binding.key, binding])),
    getDependencyState,
  )
}

function evaluateFunction(name: string, args: Array<number>): number {
  validateFormulaFunctionCall(name, args.length)

  switch (name) {
    case 'min':
      return Math.min(...args)
    case 'max':
      return Math.max(...args)
    case 'round':
      return Math.round(args[0])
    case 'floor':
      return Math.floor(args[0])
    case 'ceil':
      return Math.ceil(args[0])
    case 'abs':
      return Math.abs(args[0])
    default:
      throw new FormulaError('invalid_function_usage', `Unknown function "${name}"`)
  }
}

function evaluateCompiledNode<TNoteId>(
  node: NoteValueCompiledFormula,
  bindingMap: Map<string, NoteValueBinding<TNoteId>>,
  getDependencyState: FormulaDependency<TNoteId>,
): number {
  switch (node.kind) {
    case 'number':
      return node.value
    case 'binding':
      return evaluateCompiledBinding(node.key, bindingMap, getDependencyState)
    case 'unary': {
      const value = evaluateCompiledNode(node.argument, bindingMap, getDependencyState)
      return node.operator === '-' ? -value : value
    }
    case 'binary':
      return evaluateCompiledBinary(node, bindingMap, getDependencyState)
    case 'call':
      return evaluateFunction(
        node.callee,
        node.args.map((arg) => evaluateCompiledNode(arg, bindingMap, getDependencyState)),
      )
  }
}

function evaluateCompiledBinding<TNoteId>(
  key: string,
  bindingMap: Map<string, NoteValueBinding<TNoteId>>,
  getDependencyState: FormulaDependency<TNoteId>,
): number {
  const binding = bindingMap.get(key)
  if (!binding) {
    throw new FormulaError('missing_target', `Missing binding "${key}"`)
  }
  return evaluateBindingDependency(binding, getDependencyState)
}

function evaluateBindingDependency<TNoteId>(
  binding: NoteValueBinding<TNoteId>,
  getDependencyState: FormulaDependency<TNoteId>,
): number {
  const dependencyState = getDependencyState(binding.targetNoteId, binding.targetValueId)
  if (!dependencyState) {
    throw new FormulaError('missing_target', 'Referenced value could not be found')
  }
  if (dependencyState.status === 'ok') {
    return dependencyState.rawValue
  }
  if (dependencyState.errorCode === 'cyclic_dependency') {
    throw new FormulaError('cyclic_dependency', dependencyState.errorMessage)
  }
  throw new FormulaError('dependency_error', dependencyState.errorMessage)
}

function evaluateCompiledBinary<TNoteId>(
  node: Extract<NoteValueCompiledFormula, { kind: 'binary' }>,
  bindingMap: Map<string, NoteValueBinding<TNoteId>>,
  getDependencyState: FormulaDependency<TNoteId>,
): number {
  const left = evaluateCompiledNode(node.left, bindingMap, getDependencyState)
  const right = evaluateCompiledNode(node.right, bindingMap, getDependencyState)
  switch (node.operator) {
    case '+':
      return left + right
    case '-':
      return left - right
    case '*':
      return left * right
    case '/':
      if (right === 0) {
        throw new FormulaError('division_by_zero', 'Division by zero')
      }
      return left / right
  }
}
