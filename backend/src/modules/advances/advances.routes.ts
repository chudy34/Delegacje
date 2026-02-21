/**
 * advances.routes.ts
 * Advances (zaliczki) CRUD
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '@/middleware/auth.middleware';
import { validate } from '@/middleware/validate.middleware';
import { AuthenticatedRequest } from '@/types/index';
import logger from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

const createAdvanceSchema = z.object({
  projectId: z.string().cuid(),
  date: z.string().datetime(),
  amount: z.number().positive(),
  currency: z.string().length(3).toUpperCase(),
  description: z.string().max(500).optional(),
});

const listAdvancesSchema = z.object({
  projectId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/v1/advances
router.get('/', validate(listAdvancesSchema, 'query'), async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { projectId, page, limit } = req.query as unknown as z.infer<typeof listAdvancesSchema>;

  try {
    const where = {
      userId: authReq.userId,
      isDeleted: false,
      ...(projectId ? { projectId } : {}),
    };

    const [advances, total] = await Promise.all([
      prisma.advance.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.advance.count({ where }),
    ]);

    res.json({
      success: true,
      data: advances,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('List advances error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// POST /api/v1/advances
router.post('/', validate(createAdvanceSchema), async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const body = req.body as z.infer<typeof createAdvanceSchema>;

  try {
    const project = await prisma.project.findFirst({
      where: { id: body.projectId, userId: authReq.userId },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Projekt nie znaleziony.' });
      return;
    }

    const advance = await prisma.advance.create({
      data: {
        userId: authReq.userId,
        projectId: body.projectId,
        date: new Date(body.date),
        amount: body.amount,
        currency: body.currency,
        description: body.description ?? null,
      },
    });

    res.status(201).json({
      success: true,
      data: advance,
      message: 'Zaliczka dodana.',
    });
  } catch (err) {
    logger.error('Create advance error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// DELETE /api/v1/advances/:id (soft delete)
router.delete('/:id', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;

  try {
    const existing = await prisma.advance.findFirst({
      where: { id: req.params.id, userId: authReq.userId, isDeleted: false },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Zaliczka nie znaleziona.' });
      return;
    }

    await prisma.advance.update({
      where: { id: req.params.id },
      data: { isDeleted: true },
    });

    res.json({ success: true, message: 'Zaliczka usunięta.' });
  } catch (err) {
    logger.error('Delete advance error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

export default router;
