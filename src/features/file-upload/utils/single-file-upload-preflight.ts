import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import { validateFileForUpload } from 'shared/storage/validation'
import { deduplicateName } from 'shared/sidebar-items/default-name'

interface SingleFileUploadPreflightArgs {
  campaignId: Id<'campaigns'> | null | undefined
  file: File
  parentId: Id<'sidebarItems'> | null
  silent: boolean
  getSiblings: (parentId: Id<'sidebarItems'> | null) => Array<{ name: string }>
}

export function prepareSingleFileUpload({
  campaignId,
  file,
  getSiblings,
  parentId,
  silent,
}: SingleFileUploadPreflightArgs): { fileName: string } | null {
  if (!campaignId) {
    toast.error('No campaign selected')
    return null
  }

  const siblingNames = getSiblings(parentId).map((s) => s.name)
  const fileName = deduplicateName(file.name, siblingNames)
  const validation = validateFileForUpload(file)
  if (!validation.valid) {
    if (!silent) toast.error(`${fileName}: ${validation.error}`)
    return null
  }

  return { fileName }
}
