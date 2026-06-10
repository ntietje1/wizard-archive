import { EmbedTargetOperationsProvider } from '../context/embed-target-operations'
import { useEmbedUpload } from '../hooks/use-embed-upload'
import type { ReactNode } from 'react'

export function LiveEmbedTargetOperationsProvider({ children }: { children: ReactNode }) {
  const { uploadEmbedFile } = useEmbedUpload()

  return (
    <EmbedTargetOperationsProvider
      operations={{
        uploadFile: async (file) => {
          const result = await uploadEmbedFile(file)
          return result?.id ?? null
        },
      }}
    >
      {children}
    </EmbedTargetOperationsProvider>
  )
}
