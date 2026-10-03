export interface SpeechSegment {
  /** Texto que se envía al sintetizador (sin emojis ni espacios repetidos). */
  text: string;
  /** Fragmento del DOM que corresponde a la frase, para marcarla mientras se lee. */
  range: Range;
}

// Emojis y sus modificadores (selector de variación, unión ZWJ, tonos de piel, banderas, keycaps).
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]/gu;
const LEADING_SKIPPABLE = /^[\s\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]+/u;
const TRAILING_SKIPPABLE = /[\s\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]+$/u;
const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, div';

/**
 * Divide el texto visible de `root` en frases y guarda el Range de cada una.
 * Las frases no cruzan bloques (párrafos, elementos de lista, <br>) y las muy largas
 * se parten por palabras, porque Chrome corta las locuciones de más de ~15 s.
 */
export function buildSpeechSegments(root: HTMLElement, maxLength = 220): SpeechSegment[] {
  const blocks: { node: Text; start: number }[][] = [];
  let current: { node: Text; start: number }[] = [];
  let currentBlock: Element | null = null;
  let offset = 0;
  const flush = () => {
    if (current.length) blocks.push(current);
    current = [];
    offset = 0;
  };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as Element).tagName === 'BR') flush();
      continue;
    }
    const block = node.parentElement?.closest(BLOCK_SELECTOR) ?? null;
    if (block !== currentBlock) {
      flush();
      currentBlock = block;
    }
    current.push({ node: node as Text, start: offset });
    offset += (node as Text).data.length;
  }
  flush();

  const segments: SpeechSegment[] = [];
  for (const parts of blocks) {
    const text = parts.map((p) => p.node.data).join('');
    const pointAt = (index: number) => {
      let part = parts[0];
      for (const p of parts) if (p.start <= index) part = p;
      return { node: part.node, offset: Math.min(index - part.start, part.node.data.length) };
    };
    const addSegment = (start: number, end: number) => {
      // El marcador no incluye los emojis ni los espacios de los extremos.
      const raw = text.slice(start, end);
      start += raw.length - raw.replace(LEADING_SKIPPABLE, '').length;
      end -= raw.length - raw.replace(TRAILING_SKIPPABLE, '').length;
      if (end <= start) return;

      const spoken = text.slice(start, end).replace(EMOJI, '').replace(/\s+/g, ' ').trim();
      if (!/[\p{L}\p{N}]/u.test(spoken)) return;

      const range = document.createRange();
      const from = pointAt(start);
      const to = pointAt(end);
      range.setStart(from.node, from.offset);
      range.setEnd(to.node, to.offset);
      segments.push({ text: spoken, range });
    };

    for (const match of text.matchAll(/[^.!?…]+(?:[.!?…]+["'”»)]*|$)/g)) {
      let start = match.index;
      const end = match.index + match[0].length;
      while (end - start > maxLength) {
        const cut = text.lastIndexOf(' ', start + maxLength);
        const splitAt = cut > start ? cut : start + maxLength;
        addSegment(start, splitAt);
        start = splitAt + 1;
      }
      addSegment(start, end);
    }
  }
  return segments;
}

/** Devuelve el índice de la frase que contiene el punto (x, y) de la pantalla, o -1. */
export function findSegmentAtPoint(segments: SpeechSegment[], x: number, y: number): number {
  const caret = caretFromPoint(x, y);
  if (!caret) return -1;
  return segments.findIndex((s) => {
    try {
      return s.range.isPointInRange(caret.node, caret.offset);
    } catch {
      return false;
    }
  });
}

function caretFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    return pos ? { node: pos.offsetNode, offset: pos.offset } : null;
  }
  if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(x, y);
    return range ? { node: range.startContainer, offset: range.startOffset } : null;
  }
  return null;
}
