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

// Black text on white for app screenshots: big coloured amounts ("S/ 70.00" in blue,
// "S/ 50" over a purple banner) are only read once the image is binarized. Dark-mode
// screenshots are inverted so the text stays dark.
async function binarize(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  let dark = 0;
  for (let i = 0; i < px.length; i += 4) {
    const v = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2] >= 170 ? 255 : 0;
    if (!v) dark++;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  if (dark > px.length / 8) {
    for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = 255 - px[i];
  }
  ctx.putImageData(img, 0, 0);
  return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/png'));
}

// Reads the image as is; if `accept` rejects that text (e.g. no movement found), reads it
// again binarized with automatic page layout and keeps that text when it is accepted.
export async function readImageText(
  file: Blob,
  onProgress?: (fraction: number) => void,
  accept?: (text: string) => boolean
): Promise<string> {
  const { createWorker, PSM } = await import('tesseract.js');
  // Progress of the first read is 0–50 % when a second read may follow.
  let phase: [number, number] = accept ? [0, 0.5] : [0, 1];
  const worker = await createWorker('spa', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr',
    langPath: '/ocr',
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(phase[0] + m.progress * phase[1]);
    },
  });
  try {
    const image = await prepare(file);
    const first = cleanOcrText((await worker.recognize(image)).data.text ?? '');
    if (!accept || accept(first)) return first;
    phase = [0.5, 0.5];
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const second = cleanOcrText((await worker.recognize(await binarize(image))).data.text ?? '');
    return accept(second) ? second : first;
  } finally {
    await worker.terminate();
  }
}
