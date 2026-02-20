/**
 * auth.module.ts
 * Authentication routes: register, login, refresh, logout
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { validate } from '../middleware/validate.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { AuthenticatedRequest, JWTPayload } from '../types/index';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';
const JWT_REFRESH_EXPIRES_IN = '30d';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Nieprawidłowy adres email').toLowerCase(),
  password: z
    .string()
    .min(8, 'Hasło musi mieć co najmniej 8 znaków')
    .regex(/[A-Z]/, 'Hasło musi zawierać wielką literę')
    .regex(/[0-9]/, 'Hasło musi zawierać cyfrę'),
  firstName: z.string().min(1, 'Imię jest wymagane').max(50),
  lastName: z.string().min(1, 'Nazwisko jest wymagane').max(50),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1, 'Hasło jest wymagane'),
});

function generateTokens(userId: string, email: string) {
  const payload: JWTPayload = { userId, email };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  const refreshToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  return { accessToken, refreshToken };
}

function setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

// POST /api/v1/auth/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body as z.infer<typeof registerSchema>;

  try {
    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'Użytkownik z tym adresem email już istnieje.',
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    const { accessToken, refreshToken } = generateTokens(user.id, user.email);
    setTokenCookies(res, accessToken, refreshToken);

    logger.info('User registered', { userId: user.id, email: user.email });

    res.status(201).json({
      success: true,
      data: { user, accessToken },
      message: 'Konto zostało pomyślnie utworzone.',
    });
  } catch (err) {
    logger.error('Registration error', { error: err, email });
    res.status(500).json({
      success: false,
      error: 'Błąd serwera podczas rejestracji. Spróbuj ponownie.',
    });
  }
});

// POST /api/v1/auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Nieprawidłowy email lub hasło.',
      });
      return;
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      res.status(401).json({
        success: false,
        error: 'Nieprawidłowy email lub hasło.',
      });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.email);
    setTokenCookies(res, accessToken, refreshToken);

    const { password: _pwd, ...userWithoutPassword } = user;

    logger.info('User logged in', { userId: user.id, email: user.email });

    res.json({
      success: true,
      data: { user: userWithoutPassword, accessToken },
      message: 'Zalogowano pomyślnie.',
    });
  } catch (err) {
    logger.error('Login error', { error: err, email });
    res.status(500).json({
      success: false,
      error: 'Błąd serwera podczas logowania.',
    });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  if (!refreshToken) {
    res.status(401).json({
      success: false,
      error: 'Brak tokenu odświeżania.',
    });
    return;
  }

  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET) as JWTPayload;
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      payload.userId,
      payload.email
    );
    setTokenCookies(res, accessToken, newRefreshToken);

    res.json({
      success: true,
      data: { accessToken },
    });
  } catch {
    res.status(401).json({
      success: false,
      error: 'Token odświeżania jest nieprawidłowy lub wygasł.',
    });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authMiddleware, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  logger.info('User logged out', { userId: authReq.userId });

  res.json({
    success: true,
    message: 'Wylogowano pomyślnie.',
  });
});

export default router;
