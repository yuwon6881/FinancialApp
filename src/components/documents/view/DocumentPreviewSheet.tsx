import { useEffect, useRef } from 'react'
import { Download } from 'lucide-react'
import type { VaultDocument } from '../../../types'
import { downloadDocument } from '../../../lib/api/documents'
import { useAppPrefs, useAppUi } from '../../../contexts/AppContext'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { DocumentPreviewPane } from './DocumentPreviewPane'

interface DocumentPreviewSheetProps {
  document: VaultDocument | null
  onClose: () => void
}

export function DocumentPreviewSheet({ document, onClose }: DocumentPreviewSheetProps) {
  const { hideSensitive } = useAppPrefs()
  const { showToast } = useAppUi()
  const onCloseRef = useRef(onClose)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  // Sensitive mode closes an open preview rather than leaving the document on screen behind it.
  useEffect(() => {
    if (document && hideSensitive) onCloseRef.current()
  }, [document, hideSensitive])

  return (
    <BottomSheet
      isOpen={document !== null && !hideSensitive}
      title={document?.originalFileName ?? 'Document preview'}
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
      // A drawer along the side from the medium tier up, rather than a dialog centred over the list.
      placement="end"
      dockedMaxWidthClassName="max-w-[min(44rem,60vw)]"
      panelClassName="h-[90vh] sm:h-full"
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
      {document && <DocumentPreviewPane document={document} />}
    </BottomSheet>
  )
}
