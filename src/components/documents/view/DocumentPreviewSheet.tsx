import { useEffect, useRef, useState } from 'react'
import { Download, FileWarning, Loader2 } from 'lucide-react'
import type { VaultDocument } from '../../../types'
import { downloadDocument, getDocumentContent, getDocumentPreviewUrl } from '../../../lib/api/documents'
import { usesCookieAuth } from '../../../lib/auth'
import { useAppPrefs, useAppUi } from '../../../contexts/AppContext'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'

interface DocumentPreviewSheetProps {
  document: VaultDocument | null
  onClose: () => void
}

type PreviewState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; url: string; text?: string; contentType: string }
  | { status: 'unsupported' }
  | { status: 'error' }

function canPreviewAsImage(contentType: string) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(contentType)
}

function normalizedContentType(contentType: string) {
  return contentType.split(';', 1)[0].trim().toLowerCase()
}

const PDF_VIEWER_PAINT_GRACE_MS = 1500

export function DocumentPreviewSheet({ document, onClose }: DocumentPreviewSheetProps) {
  const { hideSensitive } = useAppPrefs()
  const { showToast } = useAppUi()
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' })
  const [mediaLoaded, setMediaLoaded] = useState(false)
  const pdfPaintTimerRef = useRef<number | null>(null)
  const onCloseRef = useRef(onClose)
  const showToastRef = useRef(showToast)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => { showToastRef.current = showToast }, [showToast])

  useEffect(() => {
    if (!document || hideSensitive) {
      if (document && hideSensitive) onCloseRef.current()
      return
    }

    let active = true
    let objectUrl: string | null = null
    if (pdfPaintTimerRef.current !== null) window.clearTimeout(pdfPaintTimerRef.current)
    setMediaLoaded(false)
    setPreview({ status: 'loading' })

    // Browser PWAs can send the authenticated cookie from an iframe/image request,
    // while a Capacitor WebView cannot attach its bearer token there. Use the direct
    // same-origin response for the browser PDF viewer (and images) so mobile Chrome
    // does not have to open a PDF from a blob URL. Native clients keep the fetched
    // object-URL path below.
    const storedContentType = normalizedContentType(document.contentType)
    const directPreviewUrl = getDocumentPreviewUrl(document.id)
    if (usesCookieAuth && directPreviewUrl.startsWith('/') && (storedContentType === 'application/pdf' || canPreviewAsImage(storedContentType))) {
      setPreview({ status: 'ready', url: directPreviewUrl, contentType: storedContentType })
      return () => {
        active = false
        if (pdfPaintTimerRef.current !== null) {
          window.clearTimeout(pdfPaintTimerRef.current)
          pdfPaintTimerRef.current = null
        }
      }
    }

    void getDocumentContent(document.id, document.originalFileName)
      .then(async content => {
        if (!active) return
        const contentType = normalizedContentType(content.contentType)
        if (contentType === 'application/json' || contentType === 'application/xml') {
          const text = await content.blob.text()
          if (active) setPreview({ status: 'ready', url: '', text, contentType })
          return
        }
        if (contentType === 'application/pdf' || canPreviewAsImage(contentType)) {
          objectUrl = URL.createObjectURL(content.blob)
          setPreview({ status: 'ready', url: objectUrl, contentType })
          return
        }
        setPreview({ status: 'unsupported' })
      })
      .catch(() => {
        if (!active) return
        setPreview({ status: 'error' })
        showToastRef.current('The document preview could not be loaded.', 'Preview Failed', 'error')
      })

    return () => {
      active = false
      if (pdfPaintTimerRef.current !== null) {
        window.clearTimeout(pdfPaintTimerRef.current)
        pdfPaintTimerRef.current = null
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [document, hideSensitive])

  const waitingForMedia = preview.status === 'ready' && preview.text === undefined && !mediaLoaded
  const isLoading = preview.status === 'idle' || preview.status === 'loading' || waitingForMedia
  const handleMediaError = () => {
    if (pdfPaintTimerRef.current !== null) {
      window.clearTimeout(pdfPaintTimerRef.current)
      pdfPaintTimerRef.current = null
    }
    setMediaLoaded(true)
    setPreview({ status: 'error' })
    showToastRef.current('The document preview could not be loaded.', 'Preview Failed', 'error')
  }

  return (
    <BottomSheet
      isOpen={document !== null && !hideSensitive}
      title={document?.originalFileName ?? 'Document preview'}
      description="Preview the stored original without downloading a separate copy."
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
      panelClassName="h-[90vh]"
      headerActions={document ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void downloadDocument(document.id, document.originalFileName)
            .catch(() => showToast('The document could not be downloaded.', 'Download Failed', 'error'))}
          aria-label={`Download ${document.originalFileName} from preview`}
        >
          <Download className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Download</span>
        </Button>
      ) : undefined}
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-background/70" aria-busy={isLoading}>
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background p-8 text-xs font-semibold text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin text-accent-ink" aria-hidden="true" />
            Loading preview…
          </div>
        )}
        {preview.status === 'ready' && preview.contentType === 'application/pdf' && (
          <iframe
            src={preview.url}
            title={`Preview of ${document?.originalFileName ?? 'document'}`}
            className="h-full min-h-[60vh] w-full border-0 bg-card"
            onLoad={() => {
              if (pdfPaintTimerRef.current !== null) window.clearTimeout(pdfPaintTimerRef.current)
              pdfPaintTimerRef.current = window.setTimeout(() => {
                pdfPaintTimerRef.current = null
                setMediaLoaded(true)
              }, PDF_VIEWER_PAINT_GRACE_MS)
            }}
            onError={handleMediaError}
          />
        )}
        {preview.status === 'ready' && canPreviewAsImage(preview.contentType) && (
          <img
            src={preview.url}
            alt={`Preview of ${document?.originalFileName ?? 'document'}`}
            className="max-h-full max-w-full object-contain p-3"
            onLoad={() => setMediaLoaded(true)}
            onError={handleMediaError}
          />
        )}
        {preview.status === 'ready' && preview.text !== undefined && (
          <pre className="max-h-full min-h-full w-full overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-relaxed text-foreground">
            {preview.text}
          </pre>
        )}
        {(preview.status === 'unsupported' || preview.status === 'error') && (
          <div className="max-w-sm p-8 text-center">
            <FileWarning className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-foreground">Preview unavailable</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {preview.status === 'unsupported'
                ? 'This file format is not supported by the preview. Download it to open it with another app.'
                : 'The stored file could not be shown. You can try downloading it instead.'}
            </p>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
