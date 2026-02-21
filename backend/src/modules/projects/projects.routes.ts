/**
 * projects.routes.ts
 * Project CRUD and balance/stats endpoints
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '@/middleware/auth.middleware';
import { validate } from '@/middleware/validate.middleware';
import { AuthenticatedRequest } from '@/types/index';
import { calculateProjectBalance } from '@/core/calculateProjectBalance';
import { calculateSalaryNet, TAX_RATES_2024_2025 } from '@/core/calculateSalaryNet';
import { encryptNumber, decryptNumber } from '@/utils/encryption';
import { getCountryByCode } from '@/core/countries';
import logger from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Apply auth to all project routes
router.use(authMiddleware);

// Zod schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  countryCode: z.string().length(2).toUpperCase(),
  startDatetime: z.string().datetime(),
  plannedEndDatetime: z.string().datetime().optional(),
  breakfastCount: z.number().int().min(0).default(0),
  salaryBrutto: z.number().positive().optional(),
});

const updateProjectSchema = createProjectSchema.partial().extend({
  plannedEndDatetime: z.string().datetime().optional().nullable(),
});

const closeProjectSchema = z.object({
  actualEndDatetime: z.string().datetime(),
});

const listProjectsSchema = z.object({
  status: z.enum(['ACTIVE', 'CLOSED', 'DRAFT']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/v1/projects
router.get('/', validate(listProjectsSchema, 'query'), async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { status, page, limit } = req.query as z.infer<typeof listProjectsSchema>;

  try {
    const where = {
      userId: authReq.userId,
      ...(status ? { status } : {}),
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { startDatetime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          status: true,
          countryCode: true,
          countryName: true,
          currency: true,
          dietAmountSnapshot: true,
          hotelLimitSnapshot: true,
          breakfastCount: true,
          startDatetime: true,
          plannedEndDatetime: true,
          actualEndDatetime: true,
          createdAt: true,
          _count: {
            select: { transactions: true, advances: true },
          },
        },
      }),
      prisma.project.count({ where }),
    ]);

    res.json({
      success: true,
      data: projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error('List projects error', { error: err, userId: authReq.userId });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// POST /api/v1/projects
router.post('/', validate(createProjectSchema), async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const body = req.body as z.infer<typeof createProjectSchema>;

  try {
    const country = getCountryByCode(body.countryCode);
    if (!country) {
      res.status(400).json({
        success: false,
        error: `Nieznany kod kraju: ${body.countryCode}`,
      });
      return;
    }

    // Get user tax settings for snapshot
    const user = await prisma.user.findUnique({
      where: { id: authReq.userId },
      select: {
        contractType: true,
        voluntarySocialSecurity: true,
        ppkEnabled: true,
        ppkPercentage: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'Użytkownik nie znaleziony.' });
      return;
    }

    // Calculate netto from brutto if provided
    let encryptedBrutto: string | undefined;
    let encryptedNetto: string | undefined;

    if (body.salaryBrutto) {
      const salaryCalc = calculateSalaryNet({
        brutto: body.salaryBrutto,
        voluntarySocialSecurity: user.voluntarySocialSecurity,
        ppkEnabled: user.ppkEnabled,
        ppkPercentage: user.ppkPercentage,
        taxRates: TAX_RATES_2024_2025,
      });

      encryptedBrutto = encryptNumber(body.salaryBrutto);
      encryptedNetto = encryptNumber(salaryCalc.netto);
    }

    // Snapshot current tax rates
    const taxSnapshotData = JSON.stringify(TAX_RATES_2024_2025);

    const project = await prisma.project.create({
      data: {
        userId: authReq.userId,
        name: body.name,
        countryCode: body.countryCode,
        countryName: country.name,
        currency: country.currency,
        dietAmountSnapshot: country.dailyRate,
        hotelLimitSnapshot: country.accommodation,
        startDatetime: new Date(body.startDatetime),
        plannedEndDatetime: body.plannedEndDatetime ? new Date(body.plannedEndDatetime) : null,
        breakfastCount: body.breakfastCount,
        salaryBrutto: encryptedBrutto ?? null,
        salaryNetto: encryptedNetto ?? null,
        taxSnapshotData,
      },
    });

    logger.info('Project created', { projectId: project.id, userId: authReq.userId });

    res.status(201).json({
      success: true,
      data: sanitizeProject(project),
      message: 'Projekt został utworzony.',
    });
  } catch (err) {
    logger.error('Create project error', { error: err, userId: authReq.userId });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// GET /api/v1/projects/:id
router.get('/:id', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: authReq.userId },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Projekt nie znaleziony.' });
      return;
    }

    res.json({ success: true, data: sanitizeProject(project) });
  } catch (err) {
    logger.error('Get project error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// PUT /api/v1/projects/:id
router.put('/:id', validate(updateProjectSchema), async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const body = req.body as z.infer<typeof updateProjectSchema>;

  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, userId: authReq.userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Projekt nie znaleziony.' });
      return;
    }

    if (existing.status === 'CLOSED') {
      res.status(400).json({
        success: false,
        error: 'Nie można edytować zamkniętego projektu.',
      });
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.startDatetime !== undefined) updateData.startDatetime = new Date(body.startDatetime);
    if (body.plannedEndDatetime !== undefined) {
      updateData.plannedEndDatetime = body.plannedEndDatetime
        ? new Date(body.plannedEndDatetime)
        : null;
    }
    if (body.breakfastCount !== undefined) updateData.breakfastCount = body.breakfastCount;

    if (body.countryCode !== undefined) {
      const country = getCountryByCode(body.countryCode);
      if (!country) {
        res.status(400).json({ success: false, error: `Nieznany kod kraju: ${body.countryCode}` });
        return;
      }
      updateData.countryCode = body.countryCode;
      updateData.countryName = country.name;
      updateData.currency = country.currency;
      updateData.dietAmountSnapshot = country.dailyRate;
      updateData.hotelLimitSnapshot = country.accommodation;
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({
      success: true,
      data: sanitizeProject(project),
      message: 'Projekt zaktualizowany.',
    });
  } catch (err) {
    logger.error('Update project error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// POST /api/v1/projects/:id/close
router.post('/:id/close', validate(closeProjectSchema), async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const body = req.body as z.infer<typeof closeProjectSchema>;

  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, userId: authReq.userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Projekt nie znaleziony.' });
      return;
    }

    if (existing.status === 'CLOSED') {
      res.status(400).json({ success: false, error: 'Projekt już jest zamknięty.' });
      return;
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        status: 'CLOSED',
        actualEndDatetime: new Date(body.actualEndDatetime),
      },
    });

    logger.info('Project closed', { projectId: project.id, userId: authReq.userId });

    res.json({
      success: true,
      data: sanitizeProject(project),
      message: 'Projekt zamknięty pomyślnie.',
    });
  } catch (err) {
    logger.error('Close project error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// GET /api/v1/projects/:id/balance
router.get('/:id/balance', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: authReq.userId },
      include: {
        transactions: {
          where: { isDeleted: false },
          select: {
            id: true, date: true, amount: true,
            category: true, isPrivate: true, excludedFromProject: true,
          },
        },
        advances: {
          where: { isDeleted: false },
          select: { id: true, date: true, amount: true },
        },
      },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Projekt nie znaleziony.' });
      return;
    }

    const balance = calculateProjectBalance({
      project: {
        startDatetime: project.startDatetime,
        plannedEndDatetime: project.plannedEndDatetime ?? undefined,
        actualEndDatetime: project.actualEndDatetime ?? undefined,
        status: project.status as 'ACTIVE' | 'CLOSED' | 'DRAFT',
        dietAmountSnapshot: project.dietAmountSnapshot,
        hotelLimitSnapshot: project.hotelLimitSnapshot,
        currency: project.currency,
        breakfastCount: project.breakfastCount,
      },
      transactions: project.transactions.map((t) => ({
        ...t,
        date: t.date,
        category: t.category,
      })),
      advances: project.advances,
    });

    res.json({ success: true, data: balance });
  } catch (err) {
    logger.error('Get balance error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// DELETE /api/v1/projects/:id
router.delete('/:id', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, userId: authReq.userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Projekt nie znaleziony.' });
      return;
    }

    // Soft delete by closing or hard delete? For projects we do hard delete with cascade.
    await prisma.project.delete({ where: { id: req.params.id } });

    logger.info('Project deleted', { projectId: req.params.id, userId: authReq.userId });

    res.json({ success: true, message: 'Projekt usunięty.' });
  } catch (err) {
    logger.error('Delete project error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// Helper: remove encrypted salary from response, optionally decrypt
function sanitizeProject(project: Record<string, unknown>) {
  const { salaryBrutto, salaryNetto, taxSnapshotData, ...rest } = project;

  const result: Record<string, unknown> = { ...rest };

  // Decrypt salary if present
  if (salaryBrutto) {
    try {
      result.salaryBrutto = decryptNumber(salaryBrutto as string);
    } catch {
      result.salaryBrutto = null;
    }
  }

  if (salaryNetto) {
    try {
      result.salaryNetto = decryptNumber(salaryNetto as string);
    } catch {
      result.salaryNetto = null;
    }
  }

  return result;
}

export default router;
