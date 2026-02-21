/**
 * users.routes.ts
 * User profile and settings management
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { PrismaClient, ContractType } from '@prisma/client';
import { authMiddleware } from '@/middleware/auth.middleware';
import { validate } from '@/middleware/validate.middleware';
import { AuthenticatedRequest } from '@/types/index';
import logger from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .optional(),
});

const updateSettingsSchema = z.object({
  contractType: z.nativeEnum(ContractType).optional(),
  voluntarySocialSecurity: z.boolean().optional(),
  ppkEnabled: z.boolean().optional(),
  ppkPercentage: z.number().min(0.5).max(4.0).optional(),
  csvColumnMapping: z.string().optional(), // JSON string
  csvClassificationRules: z.string().optional(), // JSON string
});

// GET /api/v1/users/me
router.get('/me', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;

  try {
    const user = await prisma.user.findUnique({
      where: { id: authReq.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        contractType: true,
        voluntarySocialSecurity: true,
        ppkEnabled: true,
        ppkPercentage: true,
        csvColumnMapping: true,
        csvClassificationRules: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'Użytkownik nie znaleziony.' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (err) {
    logger.error('Get user error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// PUT /api/v1/users/me
router.put('/me', validate(updateProfileSchema), async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const body = req.body as z.infer<typeof updateProfileSchema>;

  try {
    const user = await prisma.user.findUnique({ where: { id: authReq.userId } });
    if (!user) {
      res.status(404).json({ success: false, error: 'Użytkownik nie znaleziony.' });
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (body.firstName !== undefined) updateData.firstName = body.firstName;
    if (body.lastName !== undefined) updateData.lastName = body.lastName;

    // Password change
    if (body.newPassword) {
      if (!body.currentPassword) {
        res.status(400).json({
          success: false,
          error: 'Aktualne hasło jest wymagane do zmiany hasła.',
        });
        return;
      }

      const passwordValid = await bcrypt.compare(body.currentPassword, user.password);
      if (!passwordValid) {
        res.status(401).json({ success: false, error: 'Nieprawidłowe aktualne hasło.' });
        return;
      }

      updateData.password = await bcrypt.hash(body.newPassword, 12);
    }

    const updatedUser = await prisma.user.update({
      where: { id: authReq.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      data: updatedUser,
      message: 'Profil zaktualizowany.',
    });
  } catch (err) {
    logger.error('Update user error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

// PUT /api/v1/users/me/settings
router.put('/me/settings', validate(updateSettingsSchema), async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const body = req.body as z.infer<typeof updateSettingsSchema>;

  try {
    // Validate JSON fields
    if (body.csvColumnMapping) {
      try {
        JSON.parse(body.csvColumnMapping);
      } catch {
        res.status(400).json({
          success: false,
          error: 'csvColumnMapping musi być prawidłowym JSON.',
        });
        return;
      }
    }

    if (body.csvClassificationRules) {
      try {
        JSON.parse(body.csvClassificationRules);
      } catch {
        res.status(400).json({
          success: false,
          error: 'csvClassificationRules musi być prawidłowym JSON.',
        });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.contractType !== undefined) updateData.contractType = body.contractType;
    if (body.voluntarySocialSecurity !== undefined) updateData.voluntarySocialSecurity = body.voluntarySocialSecurity;
    if (body.ppkEnabled !== undefined) updateData.ppkEnabled = body.ppkEnabled;
    if (body.ppkPercentage !== undefined) updateData.ppkPercentage = body.ppkPercentage;
    if (body.csvColumnMapping !== undefined) updateData.csvColumnMapping = body.csvColumnMapping;
    if (body.csvClassificationRules !== undefined) updateData.csvClassificationRules = body.csvClassificationRules;

    const user = await prisma.user.update({
      where: { id: authReq.userId },
      data: updateData,
      select: {
        contractType: true,
        voluntarySocialSecurity: true,
        ppkEnabled: true,
        ppkPercentage: true,
        csvColumnMapping: true,
        csvClassificationRules: true,
      },
    });

    res.json({
      success: true,
      data: user,
      message: 'Ustawienia zaktualizowane.',
    });
  } catch (err) {
    logger.error('Update settings error', { error: err });
    res.status(500).json({ success: false, error: 'Błąd serwera.' });
  }
});

export default router;
