# File Upload Generalization Guide

## Overview

A fully generalized, explicit file upload system with customizable preview support. No wrappers, no hidden abstractions - just clear, composable components and hooks.

## Architecture

### Single Generic Hook: `useFileWithPreview`

**Location**: `src/hooks/useImageUpload.ts`

The only hook you need for any file upload scenario:

- ✅ Any file type (images, PDFs, documents, audio, video, etc.)
- ✅ Custom file type validation
- ✅ Configurable file size limits
- ✅ Automatic preview generation (data URLs)
- ✅ Drag-and-drop functionality
- ✅ Optional auto-upload on file selection
- ✅ Upload progress tracking

**No wrappers, no hidden behavior** - fully explicit and type-safe.

### Generic Component: `FileUploadSection`

**Location**: `src/components/forms/category-tag-dialogs/generic-tag-dialog/image-upload-section.tsx`

Core component requiring explicit configuration:

- ✅ Customizable file type validation patterns
- ✅ Configurable labels and messages
- ✅ Custom preview rendering (required, not optional)
- ✅ Custom preview dialog component (required, not optional)
- ✅ Upload error display
- ✅ Upload progress visualization

### Specialized Wrappers: `ImageUploadSection` and `PdfUploadSection`

**Location**: Same file as `FileUploadSection`

Pre-configured convenience components for common use cases:

- `ImageUploadSection` - Images with automatic preview
- `PdfUploadSection` - PDFs with download preview

These are explicit wrappers that show exactly what configuration they're using.

## Quick Start

### For Images

```typescript
import { useFileWithPreview } from '~/hooks/useImageUpload'
import { ImageUploadSection } from '~/components/forms/category-tag-dialogs/generic-tag-dialog/image-upload-section'

const MyComponent = () => {
  const imageUpload = useFileWithPreview({
    isOpen: isDialogOpen,
    uploadOnSelect: false,
    fileTypeValidator: (file) => {
      if (!file.type.startsWith('image/')) {
        return { success: false, error: 'Only image files are allowed' }
      }
      return { success: true }
    },
  })

  return (
    <ImageUploadSection
      label="Profile Picture"
      fileUpload={imageUpload}
      handleFileSelect={(file) => {
        const result = imageUpload.handleFileSelect(file)
        if (!result.success) {
          toast.error(result.error)
        }
      }}
      isSubmitting={isSubmitting}
    />
  )
}
```

### For PDFs

```typescript
import { useFileWithPreview } from '~/hooks/useImageUpload'
import { PdfUploadSection } from '~/components/forms/category-tag-dialogs/generic-tag-dialog/image-upload-section'

const MyComponent = () => {
  const pdfUpload = useFileWithPreview({
    isOpen: isDialogOpen,
    uploadOnSelect: false,
    fileTypeValidator: (file) => {
      if (!file.type.includes('pdf')) {
        return { success: false, error: 'Only PDF files are allowed' }
      }
      return { success: true }
    },
    maxFileSize: 10 * 1024 * 1024, // 10MB
  })

  return (
    <PdfUploadSection
      label="Document"
      fileUpload={pdfUpload}
      handleFileSelect={handleSelectFile}
      isSubmitting={isSubmitting}
    />
  )
}
```

## Hook API Reference

### `useFileWithPreview(options: FileWithPreviewOptions)`

**Options:**

- `isOpen: boolean` - Controls when the hook is active
- `fileStorageId?: Id<'_storage'>` - Existing file to load preview for
- `uploadOnSelect?: boolean` (default: `true`) - Auto-upload when file is selected
- `fileTypeValidator?: (file: File) => { success: boolean; error?: string }` - Custom validation
- `maxFileSize?: number` (default: 5MB) - Maximum file size in bytes

**Returns:**

```typescript
{
  file: File | null                              // Currently selected file
  preview: string                                // Data URL preview or download URL
  isUploading: boolean                           // Upload in progress
  uploadError: string                            // Error message if any
  isDragActive: boolean                          // Drag-over state
  uploadProgress: { loaded, total, percentage }  // Upload progress
  fileInputRef: RefObject<HTMLInputElement>      // Ref to hidden input

  handleFileSelect(file: File): { success, error? }
  handleDrag(e: DragEvent): void
  handleDrop(e: DragEvent): void
  removeFile(): void
  handleSubmit(): Promise<Id<'_storage'>>
}
```

## Component API Reference

### `<FileUploadSection />`

**All props are required - explicit configuration:**

```typescript
interface FileUploadSectionProps {
  label?: string
  fileUpload: UseFileWithPreviewReturn
  handleFileSelect: (file: File) => void
  isSubmitting: boolean
  acceptPattern: string // HTML accept attribute
  fileTypeLabel: string // e.g. "PNG, JPG or GIF"
  maxSizeLabel: string // e.g. "Max 5MB"
  dragDropText: string // e.g. "Drag file here..."
  renderPreview: (previewUrl: string) => ReactNode // Required custom preview
  renderPreviewDialog: (previewUrl: string, onClose: () => void) => ReactNode // Required custom dialog
}
```

### `<ImageUploadSection />`

Pre-configured wrapper for images:

```typescript
interface ImageUploadSectionProps {
  label?: string
  fileUpload: UseFileWithPreviewReturn
  handleFileSelect: (file: File) => void
  isSubmitting: boolean
}
```

Pre-configured with:

- Accept: `image/*`
- Labels: `"PNG, JPG or GIF"` + `"Max 5MB"`
- Preview: Displays image directly
- Dialog: Fullscreen image view

### `<PdfUploadSection />`

Pre-configured wrapper for PDFs:

```typescript
interface PdfUploadSectionProps {
  label?: string
  fileUpload: UseFileWithPreviewReturn
  handleFileSelect: (file: File) => void
  isSubmitting: boolean
}
```

Pre-configured with:

- Accept: `.pdf,application/pdf`
- Labels: `"PDF only"` + `"Max 10MB"`
- Preview: PDF icon + filename
- Dialog: Download button + info

## Custom File Types

To create custom uploads for other file types, use `FileUploadSection` with custom preview components:

### Video Upload Example

```typescript
const VideoPreview = ({ previewUrl }: { previewUrl: string }) => (
  <video src={previewUrl} className="w-full h-full object-contain" />
)

const VideoPreviewDialog = ({ previewUrl, onClose }: { previewUrl: string; onClose: () => void }) => (
  <div className="w-full h-full flex items-center justify-center bg-black" onClick={onClose}>
    <video src={previewUrl} className="w-full h-full max-h-[90vh]" controls autoPlay />
  </div>
)

const videoUpload = useFileWithPreview({
  isOpen,
  uploadOnSelect: false,
  fileTypeValidator: (file) => {
    if (!file.type.startsWith('video/')) {
      return { success: false, error: 'Only video files allowed' }
    }
    return { success: true }
  },
  maxFileSize: 100 * 1024 * 1024,
})

<FileUploadSection
  label="Video"
  fileUpload={videoUpload}
  handleFileSelect={handleSelect}
  isSubmitting={isSubmitting}
  acceptPattern="video/*"
  fileTypeLabel="MP4, WebM, or OGG"
  maxSizeLabel="Max 100MB"
  dragDropText="Drag a video here or click to browse"
  renderPreview={(url) => <VideoPreview previewUrl={url} />}
  renderPreviewDialog={(url, onClose) => <VideoPreviewDialog previewUrl={url} onClose={onClose} />}
/>
```

### Audio Upload Example

```typescript
const AudioPreview = () => (
  <div className="w-full h-full flex flex-col items-center justify-center gap-3">
    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
      <Music className="w-8 h-8 text-blue-600" />
    </div>
    <p className="text-sm font-medium">Audio file ready</p>
  </div>
)

const AudioPreviewDialog = ({ previewUrl, onClose }: { previewUrl: string; onClose: () => void }) => (
  <div className="w-full h-full flex items-center justify-center" onClick={onClose}>
    <audio src={previewUrl} controls className="w-full max-w-md" autoPlay />
  </div>
)

const audioUpload = useFileWithPreview({
  isOpen,
  uploadOnSelect: false,
  fileTypeValidator: (file) => {
    if (!['audio/mpeg', 'audio/wav', 'audio/ogg'].includes(file.type)) {
      return { success: false, error: 'Only MP3, WAV, or OGG allowed' }
    }
    return { success: true }
  },
  maxFileSize: 50 * 1024 * 1024,
})

<FileUploadSection
  label="Audio"
  fileUpload={audioUpload}
  handleFileSelect={handleSelect}
  isSubmitting={isSubmitting}
  acceptPattern="audio/*"
  fileTypeLabel="MP3, WAV, or OGG"
  maxSizeLabel="Max 50MB"
  dragDropText="Drag an audio file here or click to browse"
  renderPreview={(url) => <AudioPreview />}
  renderPreviewDialog={(url, onClose) => <AudioPreviewDialog previewUrl={url} onClose={onClose} />}
/>
```

## Full PDF Rendering with react-pdf

For actual PDF rendering (not just download), install and use `react-pdf`:

```bash
pnpm add react-pdf
```

Then create a custom component:

```typescript
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

const AdvancedPdfPreview = ({ previewUrl }: { previewUrl: string }) => {
  const [numPages, setNumPages] = useState<number | null>(null)

  return (
    <div className="w-full h-full flex items-center justify-center overflow-auto">
      <Document
        file={previewUrl}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
      >
        <Page pageNumber={1} width={280} />
      </Document>
    </div>
  )
}

<FileUploadSection
  label="PDF"
  fileUpload={pdfUpload}
  handleFileSelect={handleSelect}
  isSubmitting={isSubmitting}
  acceptPattern=".pdf,application/pdf"
  fileTypeLabel="PDF only"
  maxSizeLabel="Max 10MB"
  dragDropText="Drag a PDF here or click to browse"
  renderPreview={(url) => <AdvancedPdfPreview previewUrl={url} />}
  renderPreviewDialog={(url, onClose) => <AdvancedPdfPreview previewUrl={url} />}
/>
```

## Files Modified

- `src/hooks/useImageUpload.ts` - Single `useFileWithPreview` hook (removed wrappers)
- `src/components/forms/category-tag-dialogs/generic-tag-dialog/image-upload-section.tsx` - Generic + Image + PDF components
- `src/components/forms/category-tag-dialogs/generic-tag-dialog/generic-dialog.tsx` - Updated to use explicit hook

## Key Principles

✅ **Explicit Over Implicit** - No hidden defaults, all configuration is clear
✅ **Composable** - Mix and match hooks and components
✅ **Type Safe** - Full TypeScript support
✅ **DRY** - Single source of truth for file upload logic
✅ **Testable** - No magic, easy to test
✅ **Extensible** - Easy to create new file type components
