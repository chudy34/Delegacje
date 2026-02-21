/**
 * receipts.routes.ts
 * Receipt upload, OCR processing, AI extraction, duplicate detection
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '@/middleware/auth.middleware';
import { validate } from '@/middleware/validate.middleware';
import { AuthenticatedRequest } from '@/types/index';
import { generateDocumentFingerprint, detectDuplicateDocument } from '@/core/detectDuplicateDocument';
import logger from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/app/uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE ?? '52428800'); // 50MB default

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const authReq = req as AuthenticatedRequest;
    const dir = path.join(UPLOAD_DIR, authReq.userId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Dozwolone typy plików: JPEG, PNG, WebP, PDF'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

const uploadQuerySchema = z.object({
  projectId: z.string().cuid().optional(),
});

// GET /api/v1/receipts
router.get('/', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const projectId = req.query.projectId as string | undefined;
  const page = parseInt((req.query.page as string) ?? '1');
  const limit = parseInt((req.query.limit as string) ?? '20');

  try {
    const where = {
      userId: authReq.userId,
      ...(projectId ? { projectId } : {}),
    };

    const [receipts, total] = await Promise.all([
      prisma.receipt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          originalFilename: true,
          mimeType: true,
          fileSize: true,
          processingStatus: true,
          isDuplicate: true,
          invoiceNumber: true,
          detectedDate: true,
          detectedAmount: true,
          vendorName: true,
          currency: true,
          ocrConfidence: true,
          createdAt: true,
          projectId: true,
        },
      }),
      prisma.receipt.count({ where }),
    ]);

    res.json({
      success: true,
      data: receipts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('List receipts error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// POST /api/v1/receipts/upload
router.post(
  '/upload',
  upload.single('file'),
  async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    if (!req.file) {
      res.status(400).json({ success: false, error: 'Brak pliku w żądaniu.' });
      return;
    }

    const projectId = req.body.projectId as string | undefined;

    try {
      // Validate projectId if provided
      if (projectId) {
        const project = await prisma.project.findFirst({
          where: { id: projectId, userId: authReq.userId },
        });
        if (!project) {
          // Remove uploaded file
          fs.unlinkSync(req.file.path);
          res.status(404).json({ success: false, error: 'Projekt nie znaleziony.' });
          return;
        }
      }

      // Compute file hash for dedup
      const fileBuffer = fs.readFileSync(req.file.path);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Create receipt record in PENDING state
      const receipt = await prisma.receipt.create({
        data: {
          userId: authReq.userId,
          projectId: projectId ?? null,
          originalFilename: req.file.originalname,
          filePath: req.file.path,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          processingStatus: 'PENDING',
        },
      });

      // Trigger async processing (don't await)
      processReceiptAsync(receipt.id, req.file.path, fileHash, authReq.userId).catch((err) => {
        logger.error('Receipt processing failed', { receiptId: receipt.id, error: err });
      });

      res.status(202).json({
        success: true,
        data: receipt,
        message: 'Dokument przesłany. Przetwarzanie w toku...',
      });
    } catch (err) {
      // Cleanup file on error
      if (req.file?.path) {
        fs.unlinkSync(req.file.path).toString();
      }
      logger.error('Upload receipt error', { error: err });
      res.status(500).json({ success: false, error: 'Błąd serwera podczas przesyłania.' });
    }
  }
);

// GET /api/v1/receipts/:id
router.get('/:id', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const receipt = await prisma.receipt.findFirst({
      where: { id: req.params.id, userId: authReq.userId },
      include: { transactions: { where: { isDeleted: false } } },
    });

    if (!receipt) {
      res.status(404).json({ success: false, error: 'Dokument nie znaleziony.' });
      return;
    }

    res.json({ success: true, data: receipt });
  } catch (err) {
    logger.error('Get receipt error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// POST /api/v1/receipts/:id/process (re-process)
router.post('/:id/process', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const receipt = await prisma.receipt.findFirst({
      where: { id: req.params.id, userId: authReq.userId },
    });

    if (!receipt) {
      res.status(404).json({ success: false, error: 'Dokument nie znaleziony.' });
      return;
    }

    // Reset status and re-queue
    await prisma.receipt.update({
      where: { id: receipt.id },
      data: { processingStatus: 'PENDING', processingError: null },
    });

    processReceiptAsync(receipt.id, receipt.filePath, undefined, authReq.userId).catch(
      (err) => logger.error('Re-process receipt failed', { receiptId: receipt.id, error: err })
    );

    res.json({ success: true, message: 'Ponowne przetwarzanie zostało zlecone.' });
  } catch (err) {
    logger.error('Re-process receipt error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// GET /api/v1/receipts/:id/duplicate-check
router.get('/:id/duplicate-check', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const receipt = await prisma.receipt.findFirst({
      where: { id: req.params.id, userId: authReq.userId },
    });

    if (!receipt) {
      res.status(404).json({ success: false, error: 'Dokument nie znaleziony.' });
      return;
    }

    // Get all other receipts for this user
    const otherReceipts = await prisma.receipt.findMany({
      where: { userId: authReq.userId, id: { not: receipt.id } },
      select: {
        id: true,
        fingerprint: true,
        invoiceNumber: true,
        detectedAmount: true,
        detectedDate: true,
        vendorName: true,
        originalFilename: true,
      },
    });

    const result = detectDuplicateDocument(
      {
        invoiceNumber: receipt.invoiceNumber ?? undefined,
        amount: receipt.detectedAmount ?? undefined,
        date: receipt.detectedDate ?? undefined,
      },
      otherReceipts.map((r) => ({
        ...r,
        detectedAmount: r.detectedAmount ?? undefined,
        detectedDate: r.detectedDate ?? undefined,
        invoiceNumber: r.invoiceNumber ?? undefined,
        vendorName: r.vendorName ?? undefined,
        fingerprint: r.fingerprint ?? undefined,
      }))
    );

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Duplicate check error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

/**
 * Async receipt processing pipeline:
 * 1. OCR (Tesseract)
 * 2. AI extraction (Gemini/OpenAI)
 * 3. Duplicate detection
 * 4. Update receipt record
 */
async function processReceiptAsync(
  receiptId: string,
  filePath: string,
  fileHash: string | undefined,
  userId: string
): Promise<void> {
  await prisma.receipt.update({
    where: { id: receiptId },
    data: { processingStatus: 'PROCESSING' },
  });

  try {
    let ocrText: string | undefined;
    let ocrLanguage: string | undefined;
    let ocrConfidence: number | undefined;

    // OCR step (lazy import to avoid startup cost)
    try {
      const { runOCR } = await import('../utils/ocr');
      const ocrResult = await runOCR(filePath);
      ocrText = ocrResult.text;
      ocrLanguage = ocrResult.language;
      ocrConfidence = ocrResult.confidence;
    } catch (err) {
      logger.warn('OCR failed, continuing without OCR', { receiptId, error: err });
    }

    // AI extraction step
    let invoiceNumber: string | undefined;
    let detectedDate: Date | undefined;
    let detectedAmount: number | undefined;
    let vendorName: string | undefined;
    let currency: string | undefined;

    if (ocrText) {
      try {
        const { extractReceiptData } = await import('../utils/aiExtractor');
        const aiResult = await extractReceiptData(ocrText, filePath);
        invoiceNumber = aiResult.invoiceNumber;
        vendorName = aiResult.vendorName;
        currency = aiResult.currency;

        if (aiResult.amount !== undefined) detectedAmount = aiResult.amount;
        if (aiResult.date) {
          const parsed = new Date(aiResult.date);
          if (!isNaN(parsed.getTime())) detectedDate = parsed;
        }
      } catch (err) {
        logger.warn('AI extraction failed, continuing', { receiptId, error: err });
      }
    }

    // Generate fingerprint if we have enough data
    let fingerprint = fileHash;
    if (invoiceNumber && detectedAmount !== undefined && detectedDate) {
      fingerprint = generateDocumentFingerprint({
        invoiceNumber,
        amount: detectedAmount,
        date: detectedDate,
      });
    }

    // Duplicate detection
    const otherReceipts = await prisma.receipt.findMany({
      where: { userId, id: { not: receiptId } },
      select: {
        id: true, fingerprint: true, invoiceNumber: true,
        detectedAmount: true, detectedDate: true, vendorName: true, originalFilename: true,
      },
    });

    const dupResult = detectDuplicateDocument(
      {
        invoiceNumber,
        amount: detectedAmount,
        date: detectedDate,
      },
      otherReceipts.map((r) => ({
        ...r,
        detectedAmount: r.detectedAmount ?? undefined,
        detectedDate: r.detectedDate ?? undefined,
        invoiceNumber: r.invoiceNumber ?? undefined,
        vendorName: r.vendorName ?? undefined,
        fingerprint: r.fingerprint ?? undefined,
      }))
    );

    // Update receipt with all results
    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        processingStatus: 'COMPLETED',
        ocrText: ocrText ?? null,
        ocrLanguage: ocrLanguage ?? null,
        ocrConfidence: ocrConfidence ?? null,
        invoiceNumber: invoiceNumber ?? null,
        detectedDate: detectedDate ?? null,
        detectedAmount: detectedAmount ?? null,
        vendorName: vendorName ?? null,
        currency: currency ?? null,
        fingerprint: fingerprint ?? null,
        isDuplicate: dupResult.isDuplicate,
        duplicateOfId:
          dupResult.isDuplicate && dupResult.matchedDocuments.length > 0
            ? dupResult.matchedDocuments[0].id
            : null,
      },
    });

    logger.info('Receipt processed successfully', { receiptId });
  } catch (err) {
    logger.error('Receipt processing pipeline error', { receiptId, error: err });
    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        processingStatus: 'FAILED',
        processingError: err instanceof Error ? err.message : 'Unknown error',
      },
    });
  }
}

export default router;
