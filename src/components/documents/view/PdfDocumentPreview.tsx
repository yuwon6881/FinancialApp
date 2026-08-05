import { useEffect, useRef, useState } from 'react'

interface PdfDocumentPreviewProps {
  blob: Blob
  fileName: string
  onReady: () => void
  onError: () => void
  zoomScale?: number
}

export function PdfDocumentPreview({ blob, fileName, onReady, onError, zoomScale = 1.0 }: PdfDocumentPreviewProps) {
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const onReadyRef = useRef(onReady)
  const onErrorRef = useRef(onError)
  const [pageCount, setPageCount] = useState(0)

  useEffect(() => { onReadyRef.current = onReady }, [onReady])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  useEffect(() => {
    const canvasHost = canvasHostRef.current
    if (!canvasHost) return

    let active = true
    let loadingTask: { destroy: () => Promise<void> } | undefined
    let loadedDocument: { cleanup?: () => Promise<unknown>; destroy?: () => Promise<void> } | undefined
    const renderTasks: Array<{ cancel: () => void }> = []

    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()

        const data = new Uint8Array(await blob.arrayBuffer())
        if (!active) return
        const task = pdfjs.getDocument({
          data,
          useWasm: false,
        })
        loadingTask = task
        const pdf = await task.promise
        loadedDocument = pdf
        if (!active) return

        setPageCount(pdf.numPages)
        const viewportEl = canvasHost.closest<HTMLElement>('.overflow-auto') || canvasHost.parentElement
        const availableWidth = Math.max(280, (viewportEl?.clientWidth || canvasHost.clientWidth || 600) - 32)
        const availableHeight = Math.max(280, (viewportEl?.clientHeight || 600) - 32)

        canvasHost.replaceChildren()

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (!active) return
          const page = await pdf.getPage(pageNumber)
          const baseViewport = page.getViewport({ scale: 1 })

          const scaleW = availableWidth / baseViewport.width
          const scaleH = availableHeight / baseViewport.height
          const fitScale = Math.min(scaleW, scaleH)
          const cssScale = Math.max(0.2, fitScale * zoomScale)

          const viewport = page.getViewport({ scale: cssScale })
          const outputScale = Math.min(window.devicePixelRatio || 1, 2)
          const canvas = globalThis.document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width * outputScale)
          canvas.height = Math.ceil(viewport.height * outputScale)
          canvas.style.width = `${Math.round(viewport.width)}px`
          canvas.style.height = `${Math.round(viewport.height)}px`
          canvas.style.maxWidth = 'none'
          canvas.style.maxHeight = 'none'
          canvas.className = 'block rounded bg-card shadow-sm'
          canvas.setAttribute('aria-hidden', 'true')
          canvasHost.appendChild(canvas)

          const renderTask = page.render({
            canvas,
            viewport,
            transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
          })
          renderTasks.push(renderTask)
          await renderTask.promise
        }
        if (active) onReadyRef.current()
      } catch (error) {
        if (!active || (error instanceof Error && error.name === 'RenderingCancelledException')) return
        onErrorRef.current()
      }
    })()

    return () => {
      active = false
      renderTasks.forEach(task => task.cancel())
      canvasHost.replaceChildren()
      void loadedDocument?.cleanup?.()
      void loadingTask?.destroy()
    }
  }, [blob, zoomScale])

  return (
    <div
      role="document"
      aria-label={`Preview of ${fileName}`}
      className="m-auto flex min-h-full min-w-full w-max flex-col items-center justify-center p-4"
    >
      <p className="sr-only">
        {pageCount > 0 ? `${fileName}, ${pageCount} PDF ${pageCount === 1 ? 'page' : 'pages'}.` : `Loading ${fileName}.`}
      </p>
      <div ref={canvasHostRef} className="flex flex-col items-center gap-3 w-max min-w-full" />
    </div>
  )
}
