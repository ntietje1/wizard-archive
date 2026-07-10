import type { LocalFilePayload } from './local-workspace-model'
import type { WizardEditorFileSessionReplaceInput } from '@wizard-archive/editor/adapter'

export const MAX_LOCAL_IMPORT_BYTES = 10 * 1024 * 1024
type LocalImportFile = WizardEditorFileSessionReplaceInput['file']

export function assertLocalCanMutate(canEdit: boolean): asserts canEdit {
  if (!canEdit) throw new Error('This local workspace is read-only')
}

export async function createLocalFilePayload(file: LocalImportFile): Promise<LocalFilePayload> {
  const contentType = getFileContentType(file)
  return {
    allowDataUrl: true,
    allowObjectUrl: false,
    contentType,
    downloadUrl: await readLocalFileAsDataUrl(file, contentType),
    name: file.name,
    size: file.size,
    status: 'available',
  }
}

export async function readLocalFileAsDataUrl(
  file: LocalImportFile,
  contentType = getFileContentType(file),
) {
  if (file.size > MAX_LOCAL_IMPORT_BYTES) {
    throw new Error('Files larger than 10 MB are not supported in the local demo')
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const chunks: Array<string> = []
  for (let index = 0; index < bytes.length; index += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(index, index + 0x8000)))
  }
  const binary = chunks.join('')
  return `data:${contentType};base64,${btoa(binary)}`
}

function getFileContentType(file: LocalImportFile) {
  return file.contentType || 'application/octet-stream'
}
