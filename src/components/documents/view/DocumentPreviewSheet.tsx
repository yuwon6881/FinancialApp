import { useEffect, useRef, useState } from 'react'
import { Download, FileWarning, Loader2, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import type { VaultDocument } from '../../../types'
import { downloadDocument, getDocumentContent, getDocumentPreviewUrl } from '../../../lib/api/documents'
import { usesCookieAuth } from '../../../lib/auth'
import { useAppPrefs, useAppUi } from '../../../contexts/AppContext'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { PdfDocumentPreview } from './PdfDocumentPreview'

interface DocumentPreviewSheetProps {
  document: VaultDocument | null
  onClose: () => void
}

type PreviewState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; url: string; blob?: Blob; text?: string; contentType: string }
  | { status: 'unsupported' }
  | { status: 'error' }

function canPreviewAsImage(contentType: string) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(contentType)
}

function normalizedContentType(contentType: string) {
  return contentType.split(';', 1)[0].trim().toLowerCase()
}

export function DocumentPreviewSheet({ document, onClose }: DocumentPreviewSheetProps) {
  const { hideSensitive } = useAppPrefs()
  const { showToast } = useAppUi()
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' })
  const [mediaLoaded, setMediaLoaded] = useState(false)
  const [zoomScale, setZoomScale] = useState(1.0)
  const onCloseRef = useRef(onClose)
  const showToastRef = useRef(showToast)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => { showToastRef.current = showToast }, [showToast])

  useEffect(() => {
    setZoomScale(1.0)
    if (!document || hideSensitive) {
      if (document && hideSensitive) onCloseRef.current()
      return
    }

    let active = true
    let objectUrl: string | null = null
    setMediaLoaded(false)
    setPreview({ status: 'loading' })

    const storedContentType = normalizedContentType(document.contentType)
    const directPreviewUrl = getDocumentPreviewUrl(document.id)
    if (usesCookieAuth && directPreviewUrl.startsWith('/') && canPreviewAsImage(storedContentType)) {
      setPreview({ status: 'ready', url: directPreviewUrl, contentType: storedContentType })
      return () => { active = false }
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
        if (contentType === 'application/pdf') {
          setPreview({ status: 'ready', url: '', blob: content.blob, contentType })
          return
        }
        if (canPreviewAsImage(contentType)) {
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
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [document, hideSensitive])

  const waitingForMedia = preview.status === 'ready' && preview.text === undefined && !mediaLoaded
  const isLoading = preview.status === 'idle' || preview.status === 'loading' || waitingForMedia
  const handleMediaError = () => {
    setMediaLoaded(true)
    setPreview({ status: 'error' })
    showToastRef.current('The document preview could not be loaded.', 'Preview Failed', 'error')
  }

  const handleZoomIn = () => setZoomScale(prev => Math.min(3.0, Number((prev + 0.25).toFixed(2))))
  const handleZoomOut = () => setZoomScale(prev => Math.max(0.5, Number((prev - 0.25).toFixed(2))))
  const handleResetZoom = () => setZoomScale(1.0)

  const isZoomable = preview.status === 'ready' && (canPreviewAsImage(preview.contentType) || preview.contentType === 'application/pdf')

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
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background" aria-busy={isLoading}>
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background p-8 text-xs font-semibold text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin text-accent-ink" aria-hidden="true" />
            Loading preview…
          </div>
        )}

        <div
          className="relative flex-1 min-h-0 w-full overflow-auto text-foreground"
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault()
              setZoomScale(prev => {
                const delta = e.deltaY < 0 ? 0.1 : -0.1
                return Math.min(3.0, Math.max(0.5, Number((prev + delta).toFixed(2))))
              })
            }
          }}
        >
          {preview.status === 'ready' && preview.contentType === 'application/pdf' && preview.blob && (
            <PdfDocumentPreview
              blob={preview.blob}
              fileName={document?.originalFileName ?? 'document.pdf'}
              zoomScale={zoomScale}
              onReady={() => setMediaLoaded(true)}
              onError={handleMediaError}
            />
          )}

          {preview.status === 'ready' && canPreviewAsImage(preview.contentType) && (
            <div className="m-auto flex min-h-full min-w-full w-max items-center justify-center p-4">
              <img
                src={preview.url}
                alt={`Preview of ${document?.originalFileName ?? 'document'}`}
                className="block rounded shadow-md transition-all duration-150"
                style={
                  zoomScale === 1.0
                    ? { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }
                    : { width: `${zoomScale * 100}%`, maxWidth: 'none', maxHeight: 'none' }
                }
                onLoad={() => setMediaLoaded(true)}
                onError={handleMediaError}
              />
            </div>
          )}

          {preview.status === 'ready' && preview.text !== undefined && (
            <pre className="max-h-full min-h-full w-full overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-relaxed text-foreground">
              {preview.text}
            </pre>
          )}

          {(preview.status === 'unsupported' || preview.status === 'error') && (
            <div className="m-auto max-w-sm p-8 text-center">
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

        {isZoomable && !isLoading && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full border border-border/60 bg-card/90 px-3 py-1.5 backdrop-blur-md shadow-lg text-xs">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40"
              onClick={handleZoomOut}
              disabled={zoomScale <= 0.5}
              aria-label="Zoom out preview"
            >
              <ZoomOut className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetZoom}
              className="h-7 px-2 text-xs font-bold text-foreground hover:bg-muted/50 transition min-w-12 text-center"
              title="Reset zoom to fit screen"
            >
              {Math.round(zoomScale * 100)}%
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40"
              onClick={handleZoomIn}
              disabled={zoomScale >= 3.0}
              aria-label="Zoom in preview"
            >
              <ZoomIn className="size-4" />
            </Button>

            <div className="h-4 w-px bg-border/60 mx-1" aria-hidden="true" />

            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-muted-foreground hover:text-foreground"
              onClick={handleResetZoom}
              aria-label="Fit document to screen"
              title="Fit to screen"
            >
              <Maximize2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
