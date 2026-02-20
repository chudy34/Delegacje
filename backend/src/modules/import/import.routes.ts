/**
 * import.routes.ts
 * CSV bank statement import with column mapping and auto-classification
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { PrismaClient, TransactionCategory } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.middleware';
import { AuthenticatedRequest, CSVColumnMapping, CSVClassificationRule } from '../types/index';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for CSV
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Dozwolony format: CSV'));
    }
  },
});

/**
 * Detect CSV separator by counting occurrences
 */
function detectSeparator(content: string): ';' | ',' {
  const firstLine = content.split('\n')[0] ?? '';
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Detect date format from a sample date string
 */
function detectDateFormat(sample: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(sample)) return 'YYYY-MM-DD';
  if (/^\d{2}\.\d{2}\.\d{4}/.test(sample)) return 'DD.MM.YYYY';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(sample)) return 'DD/MM/YYYY';
  return 'YYYY-MM-DD';
}

/**
 * Parse date string according to detected format
 */
function parseDate(dateStr: string, format: string): Date | null {
  try {
    let isoDate: string;

    if (format === 'DD.MM.YYYY') {
      const [day, month, year] = dateStr.split('.');
      isoDate = `${year}-${month}-${day}`;
    } else if (format === 'DD/MM/YYYY') {
      const [day, month, year] = dateStr.split('/');
      isoDate = `${year}-${month}-${day}`;
    } else {
      isoDate = dateStr.split(' ')[0]; // strip time if present
    }

    const date = new Date(isoDate);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Parse amount string (handle Polish comma decimals, negative values)
 */
function parseAmount(amountStr: string): number {
  // Remove spaces, replace comma with dot
  const cleaned = amountStr.replace(/\s/g, '').replace(',', '.');
  // Remove currency symbols
  const numberOnly = cleaned.replace(/[^0-9.-]/g, '');
  return parseFloat(numberOnly) || 0;
}

/**
 * Parse CSV content into rows
 */
function parseCSV(content: string, separator: ';' | ',' = ',') {
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(separator).map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) => {
    const values = line.split(separator).map((v) => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });

  return { headers, rows };
}

/**
 * Auto-classify transaction by keyword rules
 */
function classifyTransaction(
  description: string,
  rules: CSVClassificationRule[]
): TransactionCategory {
  const lower = description.toLowerCase();

  for (const rule of rules) {
    if (rule.isRegex) {
      try {
        if (new RegExp(rule.keyword, 'i').test(lower)) {
          return rule.category as TransactionCategory;
        }
      } catch {
        // Invalid regex, skip
      }
    } else if (lower.includes(rule.keyword.toLowerCase())) {
      return rule.category as TransactionCategory;
    }
  }

  // Built-in heuristics
  if (/hotel|apart|accommodation|nocleg|b&b|airbnb|booking/i.test(lower)) {
    return TransactionCategory.HOTEL;
  }
  if (/parking|parkhaus|parkhous/i.test(lower)) {
    return TransactionCategory.PARKING;
  }
  if (/restaurant|cafe|bar|food|pizza|burger|mcdonald|kfc|subway|bistro|lunch|dinner|breakfast|jadłodajnia|restauracja|karczma/i.test(lower)) {
    return TransactionCategory.FOOD;
  }
  if (/taxi|uber|bolt|lyft|tram|bus|metro|train|flight|airline|ryanair|wizz|lot|pkp|mpk/i.test(lower)) {
    return TransactionCategory.TRANSPORT;
  }
  if (/fuel|petrol|diesel|bp|shell|orlen|lotos|tankstelle/i.test(lower)) {
    return TransactionCategory.FUEL;
  }

  return TransactionCategory.OTHER;
}

// POST /api/v1/import/csv
router.post('/csv', csvUpload.single('file'), async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  if (!req.file) {
    res.status(400).json({ success: false, error: 'Brak pliku CSV.' });
    return;
  }

  const projectId = req.body.projectId as string | undefined;
  const mappingJson = req.body.mapping as string | undefined;
  const preview = req.body.preview === 'true';

  try {
    const content = req.file.buffer.toString('utf-8');
    const separator = detectSeparator(content);
    const { headers, rows } = parseCSV(content, separator);

    if (!mappingJson && preview) {
      // Return preview for column mapping
      const sampleRows = rows.slice(0, 5);
      const firstDate = rows[0] ? Object.values(rows[0]).find((v) => /\d{2}[./-]\d{2}[./-]\d{4}|\d{4}-\d{2}-\d{2}/.test(v)) : undefined;
      const dateFormat = firstDate ? detectDateFormat(firstDate) : 'YYYY-MM-DD';

      res.json({
        success: true,
        data: {
          headers,
          sampleRows,
          separator,
          dateFormat,
          totalRows: rows.length,
        },
        message: 'Podgląd CSV. Wybierz mapowanie kolumn przed importem.',
      });
      return;
    }

    if (!projectId) {
      res.status(400).json({ success: false, error: 'projectId jest wymagany do importu.' });
      return;
    }

    // Verify project
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: authReq.userId },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Projekt nie znaleziony.' });
      return;
    }

    // Parse or load mapping
    let mapping: CSVColumnMapping;
    if (mappingJson) {
      mapping = JSON.parse(mappingJson) as CSVColumnMapping;
      // Save mapping to user settings
      await prisma.user.update({
        where: { id: authReq.userId },
        data: { csvColumnMapping: mappingJson },
      });
    } else {
      const user = await prisma.user.findUnique({ where: { id: authReq.userId } });
      if (!user?.csvColumnMapping) {
        res.status(400).json({ success: false, error: 'Brak mapowania kolumn. Prześlij mapping.' });
        return;
      }
      mapping = JSON.parse(user.csvColumnMapping) as CSVColumnMapping;
    }

    // Load classification rules
    const user = await prisma.user.findUnique({ where: { id: authReq.userId } });
    const classificationRules: CSVClassificationRule[] = user?.csvClassificationRules
      ? (JSON.parse(user.csvClassificationRules) as CSVClassificationRule[])
      : [];

    // Detect date format from first date value
    const firstDateValue = rows[0]?.[mapping.date] ?? '';
    const dateFormat = detectDateFormat(firstDateValue);

    // Process rows
    const importedTransactions = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      try {
        const dateStr = row[mapping.date];
        const amountStr = row[mapping.amount];
        const description = row[mapping.description] ?? '';

        if (!dateStr || !amountStr) {
          errors.push({ row: i + 2, error: 'Brak daty lub kwoty' });
          continue;
        }

        const date = parseDate(dateStr, dateFormat);
        if (!date) {
          errors.push({ row: i + 2, error: `Nieprawidłowa data: ${dateStr}` });
          continue;
        }

        const amount = parseAmount(amountStr);
        if (isNaN(amount) || amount === 0) {
          errors.push({ row: i + 2, error: `Nieprawidłowa kwota: ${amountStr}` });
          continue;
        }

        // Skip negative amounts (debits from account) - they are expenses
        // Positive amounts = credits (money coming in), negative = money going out
        const finalAmount = Math.abs(amount);
        const currency = (mapping.currency ? row[mapping.currency] : null) ?? project.currency;

        // Auto-classify
        const category = mapping.category && row[mapping.category]
          ? (row[mapping.category] as TransactionCategory)
          : classifyTransaction(description, classificationRules);

        const transaction = await prisma.transaction.create({
          data: {
            userId: authReq.userId,
            projectId,
            date,
            description: description || 'Import CSV',
            amount: finalAmount,
            currency,
            category,
          },
        });

        importedTransactions.push(transaction);
      } catch (err) {
        errors.push({ row: i + 2, error: err instanceof Error ? err.message : 'Błąd' });
      }
    }

    logger.info('CSV import completed', {
      userId: authReq.userId,
      projectId,
      imported: importedTransactions.length,
      errors: errors.length,
    });

    res.json({
      success: true,
      data: {
        imported: importedTransactions.length,
        failed: errors.length,
        errors: errors.slice(0, 20), // limit error list
        transactions: importedTransactions,
      },
      message: `Zaimportowano ${importedTransactions.length} transakcji.${errors.length > 0 ? ` ${errors.length} wierszy pominięto.` : ''}`,
    });
  } catch (err) {
    logger.error('CSV import error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd podczas importu CSV.' });
  }
});

// GET /api/v1/import/mappings
router.get('/mappings', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const user = await prisma.user.findUnique({
      where: { id: authReq.userId },
      select: { csvColumnMapping: true, csvClassificationRules: true },
    });

    res.json({
      success: true,
      data: {
        columnMapping: user?.csvColumnMapping ? JSON.parse(user.csvColumnMapping) : null,
        classificationRules: user?.csvClassificationRules
          ? JSON.parse(user.csvClassificationRules)
          : [],
      },
    });
  } catch (err) {
    logger.error('Get mappings error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// PUT /api/v1/import/mappings
router.put('/mappings', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { columnMapping, classificationRules } = req.body as {
    columnMapping?: CSVColumnMapping;
    classificationRules?: CSVClassificationRule[];
  };

  try {
    const updateData: Record<string, string> = {};

    if (columnMapping !== undefined) {
      updateData.csvColumnMapping = JSON.stringify(columnMapping);
    }
    if (classificationRules !== undefined) {
      updateData.csvClassificationRules = JSON.stringify(classificationRules);
    }

    await prisma.user.update({ where: { id: authReq.userId }, data: updateData });

    res.json({ success: true, message: 'Mapowanie zapisane.' });
  } catch (err) {
    logger.error('Save mappings error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

export default router;
