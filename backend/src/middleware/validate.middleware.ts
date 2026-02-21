/**
 * validate.middleware.ts
 * Request body/query validation using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import logger from '@/utils/logger';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = target === 'body' ? req.body
        : target === 'query' ? req.query
        : req.params;

      const parsed = schema.parse(data);

      // Replace the target with parsed (coerced) data
      if (target === 'body') req.body = parsed;
      else if (target === 'query') req.query = parsed as typeof req.query;
      else req.params = parsed as typeof req.params;

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(422).json({
          success: false,
          error: 'Błąd walidacji danych wejściowych.',
          validationErrors: errors,
        });
      } else {
        logger.error('Validation middleware unexpected error', { error: err });
        res.status(500).json({
          success: false,
          error: 'Błąd serwera podczas walidacji.',
        });
      }
    }
  };
}
