/**
 * ocr.ts
 * Tesseract OCR wrapper for receipt/invoice text extraction
 */

import Tesseract from 'tesseract.js';
import logger from './logger';

export interface OCRResult {
  text: string;
  language: string;
  confidence: number; // 0-100
}

// Languages to try for OCR (ordered by priority)
const OCR_LANGUAGES = ['pol', 'eng', 'deu', 'fra', 'spa'];

/**
 * Run OCR on a file, trying multiple languages and picking best result
 */
export async function runOCR(filePath: string): Promise<OCRResult> {
  logger.info('Starting OCR', { filePath });

  // Try with combined language pack first
  const combinedLang = OCR_LANGUAGES.join('+');

  try {
    const result = await Tesseract.recognize(filePath, combinedLang, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          logger.debug('OCR progress', { progress: Math.round(m.progress * 100) });
        }
      },
    });

    const text = result.data.text.trim();
    const confidence = result.data.confidence;

    // Detect dominant language from result
    const language = detectLanguage(text);

    logger.info('OCR completed', {
      filePath,
      confidence,
      textLength: text.length,
      language,
    });

    return { text, language, confidence };
  } catch (err) {
    logger.error('OCR failed', { filePath, error: err });
    throw new Error(`OCR failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Simple heuristic language detection from text
 */
function detectLanguage(text: string): string {
  const lowerText = text.toLowerCase();

  // Polish indicators
  const polishChars = (text.match(/[ąćęłńóśźż]/gi) ?? []).length;
  const polishWords = ['złoty', 'zł', 'paragon', 'faktura', 'razem', 'suma', 'kwota', 'data'].filter(
    (w) => lowerText.includes(w)
  ).length;

  if (polishChars > 5 || polishWords > 1) return 'pol';

  // German indicators
  const germanWords = ['rechnung', 'betrag', 'steuer', 'gesamt', 'datum', 'mwst'].filter(
    (w) => lowerText.includes(w)
  ).length;
  if (germanWords > 1) return 'deu';

  // French indicators
  const frenchWords = ['facture', 'montant', 'total', 'taxe', 'date'].filter(
    (w) => lowerText.includes(w)
  ).length;
  if (frenchWords > 1) return 'fra';

  return 'eng';
}
