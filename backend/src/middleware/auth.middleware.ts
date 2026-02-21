/**
 * auth.middleware.ts
 * JWT authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JWTPayload } from '@/types/index';
import logger from '@/utils/logger';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;

  // Extract token from Authorization header or cookie
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken as string;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Brak tokenu autoryzacji. Zaloguj się, aby kontynuować.',
    });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET!) as JWTPayload;

    authReq.userId = payload.userId;
    authReq.userEmail = payload.email;

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token wygasł. Zaloguj się ponownie.',
        code: 'TOKEN_EXPIRED',
      });
    } else if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Nieprawidłowy token autoryzacji.',
        code: 'TOKEN_INVALID',
      });
    } else {
      logger.error('Auth middleware error', { error: err });
      res.status(500).json({
        success: false,
        error: 'Błąd serwera podczas autoryzacji.',
      });
    }
  }
}
