/**
 * transactions.routes.ts
 * Transaction CRUD with soft delete
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient, TransactionCategory } from '@prisma/client';
import { authMiddleware } from '@/middleware/auth.middleware';
import { validate } from '@/middleware/validate.middleware';
import { AuthenticatedRequest } from '@/types/index';
import logger from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

const createTransactionSchema = z.object({
  projectId: z.string().cuid(),
  date: z.string().datetime(),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  currency: z.string().length(3).toUpperCase(),
  category: z.nativeEnum(TransactionCategory).default(TransactionCategory.OTHER),
  isPrivate: z.boolean().default(false),
  excludedFromProject: z.boolean().default(false),
  receiptId: z.string().cuid().optional(),
});

const updateTransactionSchema = createTransactionSchema
  .omit({ projectId: true })
  .partial();

const listTransactionsSchema = z.object({
  projectId: z.string().cuid().optional(),
  category: z.nativeEnum(TransactionCategory).optional(),
  includeDeleted: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/v1/transactions
router.get('/', validate(listTransactionsSchema, 'query'), async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { projectId, category, includeDeleted, page, limit } =
    req.query as z.infer<typeof listTransactionsSchema>;

  try {
    const where = {
      userId: authReq.userId,
      ...(projectId ? { projectId } : {}),
      ...(category ? { category } : {}),
      ...(includeDeleted ? {} : { isDeleted: false }),
    };

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          receipt: {
            select: { id: true, originalFilename: true, processingStatus: true },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('List transactions error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// POST /api/v1/transactions
router.post('/', validate(createTransactionSchema), async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const body = req.body as z.infer<typeof createTransactionSchema>;

  try {
    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: { id: body.projectId, userId: authReq.userId },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Projekt nie znaleziony.' });
      return;
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: authReq.userId,
        projectId: body.projectId,
        date: new Date(body.date),
        description: body.description,
        amount: body.amount,
        currency: body.currency,
        category: body.category,
        isPrivate: body.isPrivate,
        excludedFromProject: body.excludedFromProject,
        receiptId: body.receiptId ?? null,
      },
    });

    res.status(201).json({
      success: true,
      data: transaction,
      message: 'Transakcja dodana.',
    });
  } catch (err) {
    logger.error('Create transaction error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// GET /api/v1/transactions/:id
router.get('/:id', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const transaction = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: authReq.userId, isDeleted: false },
      include: { receipt: true },
    });

    if (!transaction) {
      res.status(404).json({ success: false, error: 'Transakcja nie znaleziona.' });
      return;
    }

    res.json({ success: true, data: transaction });
  } catch (err) {
    logger.error('Get transaction error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// PUT /api/v1/transactions/:id
router.put('/:id', validate(updateTransactionSchema), async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const body = req.body as z.infer<typeof updateTransactionSchema>;

  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: authReq.userId, isDeleted: false },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Transakcja nie znaleziona.' });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (body.date !== undefined) updateData.date = new Date(body.date);
    if (body.description !== undefined) updateData.description = body.description;
    if (body.amount !== undefined) updateData.amount = body.amount;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.isPrivate !== undefined) updateData.isPrivate = body.isPrivate;
    if (body.excludedFromProject !== undefined) updateData.excludedFromProject = body.excludedFromProject;

    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ success: true, data: transaction, message: 'Transakcja zaktualizowana.' });
  } catch (err) {
    logger.error('Update transaction error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// DELETE /api/v1/transactions/:id (soft delete)
router.delete('/:id', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: authReq.userId, isDeleted: false },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Transakcja nie znaleziona.' });
      return;
    }

    await prisma.transaction.update({
      where: { id: req.params.id },
      data: { isDeleted: true },
    });

    res.json({ success: true, message: 'Transakcja usunięta.' });
  } catch (err) {
    logger.error('Delete transaction error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

export default router;
