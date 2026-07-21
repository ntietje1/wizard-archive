import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { FileResourceSource } from './content-session-contract'

type ReplacementResult =
  | Readonly<{ status: 'completed' }>
  | Readonly<{ status: 'retryable' | 'rejected'; reason: string }>
type ReplacementFailure = Exclude<ReplacementResult, { status: 'completed' }>

type ReplacementTarget<T> = Readonly<{
  key: string
  owner: object
  value: T
}>

type ReplacementTargetIdentity = Pick<ReplacementTarget<unknown>, 'key' | 'owner'>

type ReplacementAttempt<T> = ReplacementTarget<T> &
  Readonly<{
    id: number
    source: FileResourceSource
  }>

type ReplacementState<T> =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'reading'; target: ReplacementTarget<T>; id: number }>
  | Readonly<{ status: 'uploading'; attempt: ReplacementAttempt<T> }>
  | Readonly<{ status: 'retry'; message: string; attempt: ReplacementAttempt<T> }>
  | Readonly<{ status: 'failed'; message: string; target: ReplacementTarget<T> }>

export type AssetReplacementController = Readonly<{
  canRetry: boolean
  failed: boolean
  input: RefObject<HTMLInputElement | null>
  message: string | null
  pending: boolean
  choose(file: File): void
  open(): void
  retry(): void
}>

export function useAssetReplacement<T>(options: {
  target: ReplacementTarget<T>
  replace(target: T, source: FileResourceSource): Promise<ReplacementResult>
  validate(file: File): string | null
  message(result: ReplacementFailure): string
  retryable(result: ReplacementFailure): boolean
  readingMessage: string
  uploadingMessage: string
  readFailureMessage: string
  responseLostMessage: string
}): AssetReplacementController {
  const input = useRef<HTMLInputElement>(null)
  const activeAttemptId = useRef(0)
  const targetKey = options.target.key
  const targetOwner = options.target.owner
  const currentTarget = useRef<ReplacementTargetIdentity>({ key: targetKey, owner: targetOwner })
  const [state, setState] = useState<ReplacementState<T>>({ status: 'idle' })
  useEffect(() => {
    currentTarget.current = { key: targetKey, owner: targetOwner }
    activeAttemptId.current += 1
    return () => {
      activeAttemptId.current += 1
    }
  }, [targetKey, targetOwner])
  const isCurrent = (target: ReplacementTarget<T>, id: number) =>
    activeAttemptId.current === id && sameTarget(target, currentTarget.current)
  const attempt = async (replacement: ReplacementAttempt<T>) => {
    if (!isCurrent(replacement, replacement.id)) return
    setState({ status: 'uploading', attempt: replacement })
    try {
      const result = await options.replace(replacement.value, replacement.source)
      if (!isCurrent(replacement, replacement.id)) return
      if (result.status === 'completed') {
        setState({ status: 'idle' })
        return
      }
      setState(
        options.retryable(result)
          ? { status: 'retry', message: options.message(result), attempt: replacement }
          : { status: 'failed', message: options.message(result), target: replacement },
      )
    } catch {
      if (isCurrent(replacement, replacement.id)) {
        setState({ status: 'retry', message: options.responseLostMessage, attempt: replacement })
      }
    }
  }
  const choose = (file: File) => {
    const target = options.target
    const error = options.validate(file)
    if (error) {
      setState({ status: 'failed', message: error, target })
      return
    }
    const id = activeAttemptId.current + 1
    activeAttemptId.current = id
    setState({ status: 'reading', target, id })
    void file.arrayBuffer().then(
      (buffer) =>
        attempt({
          ...target,
          id,
          source: { bytes: new Uint8Array(buffer), fileName: file.name },
        }),
      () => {
        if (isCurrent(target, id)) {
          setState({ status: 'failed', message: options.readFailureMessage, target })
        }
      },
    )
  }
  const replacementTarget = stateTarget(state)
  const visibleState =
    replacementTarget === null || sameTarget(replacementTarget, options.target)
      ? state
      : ({ status: 'idle' } as const)
  const pending = visibleState.status === 'reading' || visibleState.status === 'uploading'
  return {
    canRetry: visibleState.status === 'retry',
    failed: visibleState.status === 'failed' || visibleState.status === 'retry',
    input,
    message:
      visibleState.status === 'reading'
        ? options.readingMessage
        : visibleState.status === 'uploading'
          ? options.uploadingMessage
          : visibleState.status === 'retry' || visibleState.status === 'failed'
            ? visibleState.message
            : null,
    pending,
    choose,
    open: () => input.current?.click(),
    retry: () => {
      if (visibleState.status !== 'retry') return
      const id = activeAttemptId.current + 1
      activeAttemptId.current = id
      void attempt({ ...visibleState.attempt, id })
    },
  }
}

function sameTarget(left: ReplacementTargetIdentity, right: ReplacementTargetIdentity): boolean {
  return left.owner === right.owner && left.key === right.key
}

function stateTarget<T>(state: ReplacementState<T>): ReplacementTarget<T> | null {
  switch (state.status) {
    case 'idle':
      return null
    case 'reading':
    case 'failed':
      return state.target
    case 'uploading':
    case 'retry':
      return state.attempt
  }
}
