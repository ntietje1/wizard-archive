import { createContext, createElement, useContext } from 'react'
import type { FileWithContent } from 'shared/files/types'
import type { ReactNode } from 'react'
import type { FileUploadControl } from '~/features/file-upload/file-upload-control'

export interface ResolvedFileViewerFile {
  allowObjectUrl: boolean
  contentType: string | null
  downloadUrl: string | null
  name: string
  size: number | null
}

interface FileViewerUploadCapability {
  fileUpload: FileUploadControl
  isSubmitting: boolean
}

export interface FileViewerSource {
  getEmptyFileUpload: (file: FileWithContent) => FileViewerUploadCapability | null
  resolveFile: (file: FileWithContent) => ResolvedFileViewerFile
  replaceFile?: (file: FileWithContent, replacement: File) => Promise<void> | void
}

const FileViewerSourceContext = createContext<FileViewerSource | null>(null)

export function FileViewerSourceProvider({
  children,
  value,
}: {
  children?: ReactNode
  value: FileViewerSource
}) {
  return createElement(FileViewerSourceContext.Provider, { value }, children)
}

export function useFileViewerSource() {
  const source = useContext(FileViewerSourceContext)
  if (!source) {
    throw new Error('useFileViewerSource must be used within FileViewerSourceProvider')
  }
  return source
}
