import { createElement, useEffect, useRef, useState } from 'react'
import { FileViewerSourceProvider } from '~/features/editor/components/viewer/file/file-viewer-source'
import { demoFileForItem } from './demo-workspace-model'
import type {
  FileViewerSource,
  ResolvedFileViewerFile,
} from '~/features/editor/components/viewer/file/file-viewer-source'
import type { INITIAL_DEMO_WORKSPACE } from './demo-workspace-model'
import type { ReactNode } from 'react'

type DemoWorkspaceState = typeof INITIAL_DEMO_WORKSPACE

export function LocalDemoFileViewerSourceProvider({
  children,
  source,
}: {
  children: ReactNode
  source: FileViewerSource
}) {
  return createElement(FileViewerSourceProvider, { value: source }, children)
}

export function useLocalDemoFileViewerSource(workspace: DemoWorkspaceState): FileViewerSource {
  const [replacementsById, setReplacementsById] = useState<Record<string, ResolvedFileViewerFile>>(
    {},
  )
  const replacementsByIdRef = useRef(replacementsById)

  useEffect(() => {
    replacementsByIdRef.current = replacementsById
  }, [replacementsById])

  useEffect(() => {
    return () => {
      Object.values(replacementsByIdRef.current).forEach((file) => {
        if (file.allowObjectUrl && file.downloadUrl) {
          URL.revokeObjectURL(file.downloadUrl)
        }
      })
    }
  }, [])

  return {
    resolveFile: (sidebarFile) => {
      const itemId = String(sidebarFile._id)
      const localFile = replacementsById[itemId] ?? resolveSeededDemoFile(workspace, itemId)

      return (
        localFile ?? {
          allowObjectUrl: false,
          contentType: sidebarFile.contentType,
          downloadUrl: sidebarFile.downloadUrl,
          name: sidebarFile.name,
          size: null,
        }
      )
    },
    getEmptyFileUpload: () => null,
    replaceFile: (sidebarFile, replacement) => {
      const nextFile: ResolvedFileViewerFile = {
        allowObjectUrl: true,
        contentType: replacement.type || 'application/octet-stream',
        downloadUrl: URL.createObjectURL(replacement),
        name: replacement.name,
        size: replacement.size,
      }

      setReplacementsById((current) => {
        const previous = current[String(sidebarFile._id)]
        if (previous?.allowObjectUrl && previous.downloadUrl) {
          URL.revokeObjectURL(previous.downloadUrl)
        }
        return { ...current, [String(sidebarFile._id)]: nextFile }
      })
    },
  }
}

function resolveSeededDemoFile(
  workspace: DemoWorkspaceState,
  itemId: string,
): ResolvedFileViewerFile | null {
  const item = workspace.items.find((candidate) => candidate.id === itemId)
  if (!item || item.type !== 'file') return null

  const demoFile = demoFileForItem(workspace, item)
  const blob = new Blob([demoFile.body], { type: demoFile.contentType })

  return {
    allowObjectUrl: false,
    contentType: demoFile.contentType,
    downloadUrl: `data:${demoFile.contentType};charset=utf-8,${encodeURIComponent(demoFile.body)}`,
    name: demoFile.name,
    size: blob.size,
  }
}
