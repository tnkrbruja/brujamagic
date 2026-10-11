import 'server-only'
import QRCode from 'qrcode'

const QR_OPTIONS = {
  errorCorrectionLevel: 'M',
  margin: 2,
  width: 512,
  color: { dark: '#2a1838', light: '#ffffff' },
} as const

export async function createQrPng(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, { ...QR_OPTIONS, type: 'png' })
}

export function pngToDataUrl(png: Buffer): string {
  return `data:image/png;base64,${png.toString('base64')}`
}
