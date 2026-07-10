import type { WizardEditorFileSessionReplaceInput } from '@wizard-archive/editor/adapter'

type LocalImportFile = WizardEditorFileSessionReplaceInput['file']

export function createImportFile(
  parts: Array<BlobPart>,
  name: string,
  options: FilePropertyBag,
): LocalImportFile {
  const file = new File(parts, name, options)
  return {
    name: file.name,
    contentType: file.type,
    size: file.size,
    arrayBuffer: () => file.arrayBuffer(),
    text: () => file.text(),
  }
}
