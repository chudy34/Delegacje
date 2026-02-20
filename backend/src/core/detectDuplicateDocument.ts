/**
 * detectDuplicateDocument.ts
 * Multi-strategy duplicate detection for receipts/invoices
 */

import crypto from 'crypto';

export type DuplicateConfidence = 'exact' | 'high' | 'medium' | 'low';

export interface DocumentFingerprint {
  invoiceNumber?: string;
  amount?: number;
  date?: Date;
  vendorName?: string;
}

export interface ExistingDocument {
  id: string;
  fingerprint?: string;
  invoiceNumber?: string;
  detectedAmount?: number;
  detectedDate?: Date;
  vendorName?: string;
  originalFilename: string;
}

export interface DuplicateMatch {
  id: string;
  invoiceNumber?: string;
  amount?: number;
  date?: Date;
  vendorName?: string;
  originalFilename: string;
  similarity: number;
  matchReason: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  confidence: DuplicateConfidence | null;
  matchedDocuments: DuplicateMatch[];
  suggestedAction: 'merge' | 'add_new' | 'review' | null;
}

/**
 * Generate SHA-256 fingerprint from document key fields
 * Used for exact duplicate detection
 */
export function generateDocumentFingerprint(doc: DocumentFingerprint): string {
  const normalized = [
    (doc.invoiceNumber ?? '').trim().toLowerCase(),
    (doc.amount ?? 0).toFixed(2),
    doc.date ? normalizeDate(doc.date) : '',
  ].join('|');

  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Normalize date to YYYY-MM-DD for comparison
 */
function normalizeDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Check if two dates are within N days of each other
 */
function datesWithinDays(date1: Date, date2: Date, days: number): boolean {
  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

/**
 * Check if two amounts are the same (within floating point tolerance)
 */
function amountsMatch(amount1: number, amount2: number): boolean {
  return Math.abs(amount1 - amount2) < 0.01;
}

/**
 * Main duplicate detection function
 * Checks against existing documents in multiple strategies
 */
export function detectDuplicateDocument(
  newDoc: DocumentFingerprint,
  existingDocs: ExistingDocument[]
): DuplicateCheckResult {
  if (existingDocs.length === 0) {
    return { isDuplicate: false, confidence: null, matchedDocuments: [], suggestedAction: null };
  }

  const matches: DuplicateMatch[] = [];

  // Generate fingerprint for new document (if enough data)
  const newFingerprint =
    newDoc.invoiceNumber && newDoc.amount && newDoc.date
      ? generateDocumentFingerprint(newDoc)
      : null;

  for (const existing of existingDocs) {
    let matchReason: string | null = null;
    let similarity = 0;
    let confidence: DuplicateConfidence | null = null;

    // Strategy 1: Exact fingerprint match (SHA-256)
    if (
      newFingerprint &&
      existing.fingerprint &&
      newFingerprint === existing.fingerprint
    ) {
      matchReason = 'Identyczny dokument (faktura + kwota + data)';
      similarity = 1.0;
      confidence = 'exact';
    }

    // Strategy 2: Amount + exact date
    else if (
      newDoc.amount !== undefined &&
      newDoc.date &&
      existing.detectedAmount !== undefined &&
      existing.detectedDate &&
      amountsMatch(newDoc.amount, existing.detectedAmount) &&
      normalizeDate(newDoc.date) === normalizeDate(existing.detectedDate)
    ) {
      matchReason = 'Identyczna kwota i data';
      similarity = 0.92;
      confidence = 'high';
    }

    // Strategy 3: Amount + date ±1 day (fuzzy date)
    else if (
      newDoc.amount !== undefined &&
      newDoc.date &&
      existing.detectedAmount !== undefined &&
      existing.detectedDate &&
      amountsMatch(newDoc.amount, existing.detectedAmount) &&
      datesWithinDays(newDoc.date, existing.detectedDate, 1)
    ) {
      matchReason = 'Identyczna kwota, data ±1 dzień';
      similarity = 0.78;
      confidence = 'medium';
    }

    // Strategy 4: Invoice number match only
    else if (
      newDoc.invoiceNumber &&
      existing.invoiceNumber &&
      newDoc.invoiceNumber.trim().toLowerCase() ===
        existing.invoiceNumber.trim().toLowerCase()
    ) {
      matchReason = 'Identyczny numer faktury';
      similarity = 0.6;
      confidence = 'low';
    }

    if (matchReason && confidence) {
      matches.push({
        id: existing.id,
        invoiceNumber: existing.invoiceNumber,
        amount: existing.detectedAmount,
        date: existing.detectedDate,
        vendorName: existing.vendorName,
        originalFilename: existing.originalFilename,
        similarity,
        matchReason,
      });
    }
  }

  // Sort by similarity descending
  matches.sort((a, b) => b.similarity - a.similarity);

  if (matches.length === 0) {
    return {
      isDuplicate: false,
      confidence: null,
      matchedDocuments: [],
      suggestedAction: null,
    };
  }

  // Determine overall confidence from best match
  const bestMatch = matches[0];
  const confidence = getSimilarityConfidence(bestMatch.similarity);

  // Suggest action based on confidence
  let suggestedAction: 'merge' | 'add_new' | 'review';
  if (confidence === 'exact' || confidence === 'high') {
    suggestedAction = 'merge';
  } else if (confidence === 'medium') {
    suggestedAction = 'review';
  } else {
    suggestedAction = 'add_new';
  }

  return {
    isDuplicate: true,
    confidence,
    matchedDocuments: matches,
    suggestedAction,
  };
}

function getSimilarityConfidence(similarity: number): DuplicateConfidence {
  if (similarity >= 0.99) return 'exact';
  if (similarity >= 0.85) return 'high';
  if (similarity >= 0.70) return 'medium';
  return 'low';
}
