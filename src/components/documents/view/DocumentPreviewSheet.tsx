import { useEffect, useRef, useState } from 'react'
import { Download, FileWarning, Loader2, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import type { VaultDocument } from '../../../types'
import { downloadDocument, getDocumentContent, getDocumentPreviewUrl } from '../../../lib/api/documents'
import { usesCookieAuth } from '../../../lib/auth'
import { useAppPrefs, useAppUi } from '../../../contexts/AppContext'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'
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

/** 1.0 *is* the fitted view, not one image pixel per screen pixel — see the image frame below. */
const MIN_ZOOM = 1.0
const MAX_ZOOM = 3.0

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
  const [zoomScale, setZoomScale] = useState(MIN_ZOOM)
  const onCloseRef = useRef(onClose)
  const showToastRef = useRef(showToast)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => { showToastRef.current = showToast }, [showToast])

  useEffect(() => {
    setZoomScale(MIN_ZOOM)
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

  // 100% is the fit, so it is also the floor: once the whole page is on screen there is nothing below
  // it worth offering, and the old 0.5 minimum only looked useful because 100% was not actually a fit.
  const handleZoomIn = () => setZoomScale(prev => Math.min(MAX_ZOOM, Number((prev + 0.25).toFixed(2))))
  const handleZoomOut = () => setZoomScale(prev => Math.max(MIN_ZOOM, Number((prev - 0.25).toFixed(2))))
  const handleResetZoom = () => setZoomScale(MIN_ZOOM)

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
          variant="secondary"
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
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background p-8 text-caption font-semibold text-muted-foreground" role="status">
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
                return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((prev + delta).toFixed(2))))
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

          {/* Zoom scales the *frame*, and the image is contained inside it, so 100% means "the whole
              page fits" rather than "one image pixel per screen pixel". The frame previously sized to
              `w-max` — the image's intrinsic width — which made the `maxWidth: 100%` at 100% resolve
              against the image's own width and therefore constrain nothing: a phone photo opened at
              full sensor resolution, and 50% was the first step that happened to fit. Growing the
              frame rather than transforming the image also keeps real scroll area to pan into. */}
          {preview.status === 'ready' && canPreviewAsImage(preview.contentType) && (
            <div
              className="flex items-center justify-center p-4"
              style={{ width: `${zoomScale * 100}%`, height: `${zoomScale * 100}%` }}
            >
              <img
                src={preview.url}
                alt={`Preview of ${document?.originalFileName ?? 'document'}`}
                className="block h-auto w-auto max-h-full max-w-full rounded shadow-md transition-all duration-150"
                onLoad={() => setMediaLoaded(true)}
                onError={handleMediaError}
              />
            </div>
          )}

          {preview.status === 'ready' && preview.text !== undefined && (
            <pre className="max-h-full min-h-full w-full overflow-auto whitespace-pre-wrap break-words p-4 text-caption leading-relaxed text-foreground">
              {preview.text}
            </pre>
          )}

          {(preview.status === 'unsupported' || preview.status === 'error') && (
            <div className="m-auto max-w-sm p-8 text-center">
              <FileWarning className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-foreground">Preview unavailable</p>
              <p className="mt-1 text-caption leading-relaxed text-muted-foreground">
                {preview.status === 'unsupported'
                  ? 'This file format is not supported by the preview. Download it to open it with another app.'
                  : 'The stored file could not be shown. You can try downloading it instead.'}
              </p>
            </div>
          )}
        </div>

        {isZoomable && !isLoading && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full border border-border/60 bg-card/90 px-3 py-1.5 backdrop-blur-md shadow-lg text-caption">
            <IconButton
              className="size-11 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40 sm:size-8"
              onClick={handleZoomOut}
              disabled={zoomScale <= MIN_ZOOM}
              label="Zoom out preview"
            >
              <ZoomOut className="size-4" />
            </IconButton>

            <Button
              variant="tertiary"
              size="sm"
              onClick={handleResetZoom}
              className="h-11 min-w-14 px-2 text-caption font-bold text-foreground hover:bg-muted/50 transition sm:h-8 sm:min-w-12"
              title="Reset zoom to fit screen"
            >
              {Math.round(zoomScale * 100)}%
            </Button>

            <IconButton
              className="size-11 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40 sm:size-8"
              onClick={handleZoomIn}
              disabled={zoomScale >= MAX_ZOOM}
              label="Zoom in preview"
            >
              <ZoomIn className="size-4" />
            </IconButton>

            <div className="h-4 w-px bg-border/60 mx-1" aria-hidden="true" />

            <IconButton
              className="size-11 rounded-full text-muted-foreground hover:text-foreground sm:size-8"
              onClick={handleResetZoom}
              label="Fit document to screen"
              tooltip="Fit to screen"
            >
              <Maximize2 className="size-3.5" />
            </IconButton>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
