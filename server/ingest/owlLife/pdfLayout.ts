import { readFileSync } from 'node:fs';
import { OPS, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { LayoutImage, LayoutText, PdfLayout } from './types';

/**
 * Reads a browser-printed PDF into positioned text and image placements.
 * This is the only module that touches pdfjs; everything downstream works on
 * the plain `PdfLayout` so it can be unit-tested without a PDF.
 */

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/** Decoded pixels for an image, fetched lazily because most callers only need placements. */
export interface PixelData {
  width: number;
  height: number;
  channels: 1 | 3 | 4;
  data: Uint8Array;
}

interface PdfImageObject {
  width: number;
  height: number;
  kind?: number;
  data?: Uint8Array | Uint8ClampedArray;
}

// pdfjs ImageKind: 1 = 1-bit grayscale, 2 = RGB, 3 = RGBA.
const CHANNELS_BY_KIND: Record<number, 3 | 4> = { 2: 3, 3: 4 };

export interface LoadedPdf {
  layout: PdfLayout;
  /** Returns decoded pixels for an image placement, or null if pdfjs can't expose them. */
  pixels(image: LayoutImage): Promise<PixelData | null>;
  close(): Promise<void>;
}

export async function loadPdfLayout(filePath: string): Promise<LoadedPdf> {
  const data = new Uint8Array(readFileSync(filePath));
  const doc = await getDocument({ data, verbosity: 0, isOffscreenCanvasSupported: false }).promise;
  const pages: PdfLayout['pages'] = [];
  const pageObjects = new Map<number, Awaited<ReturnType<typeof doc.getPage>>>();

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    pageObjects.set(pageNumber, page);
    const viewport = page.getViewport({ scale: 1 });
    const height = viewport.height;

    const content = await page.getTextContent();
    const texts: LayoutText[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      texts.push({
        str: item.str.replace(/\s+/g, ' ').trim(),
        x: item.transform[4],
        // Top-down y of the baseline, which is what reading order cares about.
        y: height - item.transform[5],
        size: item.height,
        font: item.fontName,
      });
    }

    const images: LayoutImage[] = [];
    const ops = await page.getOperatorList();
    const stack: Matrix[] = [];
    let ctm: Matrix = [...IDENTITY];
    for (let i = 0; i < ops.fnArray.length; i += 1) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i] as unknown[];
      if (fn === OPS.save) stack.push(ctm);
      else if (fn === OPS.restore) ctm = stack.pop() ?? [...IDENTITY];
      else if (fn === OPS.transform) ctm = multiply(ctm, args as Matrix);
      else if (fn === OPS.paintFormXObjectBegin) {
        stack.push(ctm);
        if (Array.isArray(args[0])) ctm = multiply(ctm, args[0] as Matrix);
      } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? [...IDENTITY];
      else if (fn === OPS.paintImageXObject) {
        // The image fills the unit square under the current matrix.
        const xs = [ctm[4], ctm[0] + ctm[4], ctm[2] + ctm[4], ctm[0] + ctm[2] + ctm[4]];
        const ys = [ctm[5], ctm[1] + ctm[5], ctm[3] + ctm[5], ctm[1] + ctm[3] + ctm[5]];
        const top = height - Math.max(...ys);
        const bottom = height - Math.min(...ys);
        images.push({
          id: String(args[0]),
          page: pageNumber,
          x: Math.min(...xs),
          top,
          width: Math.max(...xs) - Math.min(...xs),
          height: bottom - top,
          pixelWidth: Number(args[1]) || 0,
          pixelHeight: Number(args[2]) || 0,
        });
      }
    }
    pages.push({ number: pageNumber, width: viewport.width, height, texts, images });
  }

  async function pixels(image: LayoutImage): Promise<PixelData | null> {
    const page = pageObjects.get(image.page);
    if (!page) return null;
    const store = image.id.startsWith('g_') ? page.commonObjs : page.objs;
    const obj = (await new Promise((resolve) => store.get(image.id, resolve))) as PdfImageObject | null;
    const channels = obj?.kind ? CHANNELS_BY_KIND[obj.kind] : undefined;
    if (!obj?.data || !channels) return null;
    return { width: obj.width, height: obj.height, channels, data: new Uint8Array(obj.data.buffer, obj.data.byteOffset, obj.data.byteLength) };
  }

  return { layout: { pages }, pixels, close: () => doc.destroy() };
}
