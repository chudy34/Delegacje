/**
 * aiExtractor.ts
 * Modular AI extraction for receipt data
 * Supports: Gemini, OpenAI, or none (pattern matching only)
 */

import logger from './logger';
import { AIExtractionResult, AIProvider } from '../types/index';

const AI_PROVIDER = (process.env.AI_PROVIDER ?? 'none') as AIProvider;

/**
 * Extract structured data from OCR text using AI
 */
export async function extractReceiptData(
  ocrText: string,
  _filePath: string
): Promise<AIExtractionResult> {
  logger.info('Starting AI extraction', { provider: AI_PROVIDER, textLength: ocrText.length });

  switch (AI_PROVIDER) {
    case 'gemini':
      return extractWithGemini(ocrText);
    case 'openai':
      return extractWithOpenAI(ocrText);
    default:
      return extractWithRegex(ocrText);
  }
}

const EXTRACTION_PROMPT = `Analyze this receipt/invoice text and extract the following fields.
Return ONLY valid JSON, no markdown, no explanation.

Text to analyze:
---
{TEXT}
---

Return this exact JSON structure (use null for missing fields):
{
  "invoiceNumber": "string or null",
  "date": "YYYY-MM-DD or null",
  "amount": number or null,
  "currency": "3-letter ISO code or null",
  "vendorName": "string or null",
  "confidence": number between 0 and 1
}`;

async function extractWithGemini(ocrText: string): Promise<AIExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.warn('GEMINI_API_KEY not set, falling back to regex');
    return extractWithRegex(ocrText);
  }

  const prompt = EXTRACTION_PROMPT.replace('{TEXT}', ocrText.slice(0, 4000));

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 512,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return parseAIResponse(text, 'gemini');
  } catch (err) {
    logger.error('Gemini extraction failed', { error: err });
    return extractWithRegex(ocrText);
  }
}

async function extractWithOpenAI(ocrText: string): Promise<AIExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not set, falling back to regex');
    return extractWithRegex(ocrText);
  }

  const prompt = EXTRACTION_PROMPT.replace('{TEXT}', ocrText.slice(0, 4000));

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? '';

    return parseAIResponse(text, 'openai');
  } catch (err) {
    logger.error('OpenAI extraction failed', { error: err });
    return extractWithRegex(ocrText);
  }
}

function parseAIResponse(text: string, provider: string): AIExtractionResult {
  try {
    // Remove markdown code blocks if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as {
      invoiceNumber?: string | null;
      date?: string | null;
      amount?: number | null;
      currency?: string | null;
      vendorName?: string | null;
      confidence?: number;
    };

    return {
      invoiceNumber: parsed.invoiceNumber ?? undefined,
      date: parsed.date ?? undefined,
      amount: typeof parsed.amount === 'number' ? parsed.amount : undefined,
      currency: parsed.currency ?? undefined,
      vendorName: parsed.vendorName ?? undefined,
      confidence: parsed.confidence ?? 0.7,
      rawResponse: text,
    };
  } catch {
    logger.warn(`Failed to parse ${provider} AI response`, { text: text.slice(0, 200) });
    return { confidence: 0, rawResponse: text };
  }
}

/**
 * Fallback regex-based extraction when AI is not available
 */
function extractWithRegex(text: string): AIExtractionResult {
  const result: AIExtractionResult = { confidence: 0.4 };

  // Extract amounts (Polish format: 123,45 or 123.45)
  const amountRegex = /(?:razem|suma|total|łącznie|do zapłaty|kwota)[\s:]*(\d+[.,]\d{2})/i;
  const amountMatch = text.match(amountRegex);
  if (amountMatch) {
    result.amount = parseFloat(amountMatch[1].replace(',', '.'));
    result.confidence = Math.max(result.confidence, 0.5);
  }

  // Extract dates (multiple formats)
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2})/,                      // ISO: 2024-01-15
    /(\d{2})\.(\d{2})\.(\d{4})/,                // DD.MM.YYYY
    /(\d{2})\/(\d{2})\/(\d{4})/,                // DD/MM/YYYY
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern === datePatterns[0]) {
        result.date = match[1];
      } else {
        result.date = `${match[3]}-${match[2]}-${match[1]}`;
      }
      result.confidence = Math.max(result.confidence, 0.45);
      break;
    }
  }

  // Extract invoice number
  const invoiceRegex = /(?:faktura|FV|VAT|nr|numer)\s*[:\s]*([A-Z0-9\/\-]{4,20})/i;
  const invoiceMatch = text.match(invoiceRegex);
  if (invoiceMatch) {
    result.invoiceNumber = invoiceMatch[1].trim();
    result.confidence = Math.max(result.confidence, 0.5);
  }

  // Detect currency
  if (/\bPLN\b|\bzł\b|\bzłoty\b/i.test(text)) result.currency = 'PLN';
  else if (/\bEUR\b|\b€\b/i.test(text)) result.currency = 'EUR';
  else if (/\bUSD\b|\b\$\b/i.test(text)) result.currency = 'USD';
  else if (/\bGBP\b|\b£\b/i.test(text)) result.currency = 'GBP';

  return result;
}
