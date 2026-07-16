import { useRef, useState } from 'react'
import type { DragEvent, RefObject } from 'react'
import type { FileResourceSource } from './content-session-contract'

type ReplacementResult =
  | Readonly<{ status: 'completed' }>
  | Readonly<{ status: 'retryable' | 'rejected'; reason: string }>
type ReplacementFailure = Exclude<ReplacementResult, { status: 'completed' }>

type ReplacementState =
  | Readonly<{ status: 'idle' | 'reading' }>
  | Readonly<{ status: 'uploading'; source: FileResourceSource }>
  | Readonly<{ status: 'retry'; message: string; source: FileResourceSource }>
  | Readonly<{ status: 'failed'; message: string }>

export type AssetReplacementController = Readonly<{
  canRetry: boolean
  dragActive: boolean
  failed: boolean
  input: RefObject<HTMLInputElement | null>
  message: string | null
  pending: boolean
  choose(file: File): void
  onDragLeave(event: DragEvent<HTMLDivElement>): void
  onDragOver(event: DragEvent<HTMLDivElement>): void
  onDrop(event: DragEvent<HTMLDivElement>): void
  open(): void
  retry(): void
}>

export function useAssetReplacement(options: {
  replace(source: FileResourceSource): Promise<ReplacementResult>
  validate(file: File): string | null
  message(result: ReplacementFailure): string
  retryable(result: ReplacementFailure): boolean
  readingMessage: string
  uploadingMessage: string
  readFailureMessage: string
  responseLostMessage: string
}): AssetReplacementController {
  const input = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [state, setState] = useState<ReplacementState>({ status: 'idle' })
  const attempt = async (source: FileResourceSource) => {
    setState({ status: 'uploading', source })
    try {
      const result = await options.replace(source)
      if (result.status === 'completed') {
        setState({ status: 'idle' })
        return
      }
      setState(
        options.retryable(result)
          ? { status: 'retry', message: options.message(result), source }
          : { status: 'failed', message: options.message(result) },
      )
    } catch {
      setState({ status: 'retry', message: options.responseLostMessage, source })
    }
  }
  const choose = (file: File) => {
    const error = options.validate(file)
    if (error) {
      setState({ status: 'failed', message: error })
      return
    }
    setState({ status: 'reading' })
    void file.arrayBuffer().then(
      (buffer) => attempt({ bytes: new Uint8Array(buffer), fileName: file.name }),
      () => setState({ status: 'failed', message: options.readFailureMessage }),
    )
  }
  const pending = state.status === 'reading' || state.status === 'uploading'
  return {
    canRetry: state.status === 'retry',
    dragActive,
    failed: state.status === 'failed' || state.status === 'retry',
    input,
    message:
      state.status === 'reading'
        ? options.readingMessage
        : state.status === 'uploading'
          ? options.uploadingMessage
          : state.status === 'retry' || state.status === 'failed'
            ? state.message
            : null,
    pending,
    choose,
    onDragLeave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false)
    },
    onDragOver: (event) => {
      event.preventDefault()
      setDragActive(true)
    },
    onDrop: (event) => {
      event.preventDefault()
      setDragActive(false)
      const file = event.dataTransfer.files[0]
      if (file && !pending) choose(file)
    },
    open: () => input.current?.click(),
    retry: () => {
      if (state.status === 'retry') void attempt(state.source)
    },
  }
}
