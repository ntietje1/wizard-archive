import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { Input } from '@wizard-archive/ui/shadcn/components/input'
import type { useEditableEmbedTargetControls } from '../hooks/use-editable-target-controls'

type EditableEmbedTargetControls = ReturnType<typeof useEditableEmbedTargetControls>

export function EditableEmbedUploadStatus({
  className,
  controls,
}: {
  className: string
  controls: EditableEmbedTargetControls
}) {
  if (!controls.isUploading && !controls.uploadError) return null

  return (
    <div className={className}>
      {controls.uploadError ? (
        <span role="alert" className="text-destructive">
          {controls.uploadError}
        </span>
      ) : (
        <span role="status" className="text-muted-foreground">
          Uploading&hellip;
        </span>
      )}
    </div>
  )
}

export function EditableEmbedLinkDraftForm({
  className,
  controls,
  errorClassName,
}: {
  className: string
  controls: EditableEmbedTargetControls
  errorClassName: string
}) {
  if (!controls.linkDraftOpen) return null

  return (
    <form className={className} action={controls.submitLinkDraft}>
      <Input
        value={controls.linkDraft}
        aria-label="External file URL"
        placeholder="https://example.com/file.pdf"
        onChange={(event) => {
          controls.setLinkDraftValue(event.target.value)
        }}
      />
      <Button type="submit" size="sm">
        Link
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={controls.closeLinkDraft}>
        Cancel
      </Button>
      {controls.linkError ? <span className={errorClassName}>{controls.linkError}</span> : null}
    </form>
  )
}
