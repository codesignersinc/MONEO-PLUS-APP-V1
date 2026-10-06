'use client';
import { cleanOcrText } from '@/lib/auto/receipt';

// Reads the text of an image (screenshot or photo of a receipt) in the browser with
// tesseract.js. The engine and the Spanish data are served from /ocr on moneo.plus
// (copied by scripts/copy-ocr-assets.mjs); the image never leaves the device.

const MAX_SIDE = 2000;

// Large phone photos are downscaled: faster and as accurate for receipts.
async function prepare(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), 'image/png')
    );
  } catch {
    return file;
  }
}

export async function readImageText(
  file: Blob,
  onProgress?: (fraction: number) => void
): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('spa', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr',
    langPath: '/ocr',
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(await prepare(file));
    return cleanOcrText(data.text ?? '');
  } finally {
    await worker.terminate();
  }
}
