import { Capacitor } from '@capacitor/core'

export function isReceiptCameraCancelled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const details = error as { code?: unknown; message?: unknown }
  return details.code === 'UserCancelled'
    || (typeof details.message === 'string' && /user cancelled photos app/i.test(details.message))
}

/** Opens the native camera and returns a File for the existing durable scan-upload queue. */
export async function captureReceiptPhoto(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) return null
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
  const photo = await Camera.getPhoto({
    source: CameraSource.Camera,
    resultType: CameraResultType.Uri,
    quality: 82,
    correctOrientation: true,
  })
  if (!photo.webPath) throw new Error('The camera did not return a receipt image.')
  const response = await fetch(photo.webPath)
  const blob = await response.blob()
  const extension = photo.format === 'png' ? 'png' : 'jpg'
  return new File([blob], `receipt-${Date.now()}.${extension}`, {
    type: blob.type || (extension === 'png' ? 'image/png' : 'image/jpeg'),
    lastModified: Date.now(),
  })
}
