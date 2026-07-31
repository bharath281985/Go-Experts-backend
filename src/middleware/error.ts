import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../core/response.js';
import { mapError } from '../core/error-mapper.js';

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) {
    return;
  }

  if (err instanceof SyntaxError && 'body' in (err as unknown as Record<string, unknown>)) {
    res.status(400).json(
      errorResponse('Invalid JSON payload', 'INVALID_JSON')
    );
    return;
  }

  const bodyError = err as { type?: string; status?: number };
  if (bodyError.type === 'entity.too.large') {
    res.status(bodyError.status || 413).json(
      errorResponse('Payload too large', 'PAYLOAD_TOO_LARGE')
    );
    return;
  }

  if (err instanceof Error && err.message === 'Not allowed by CORS') {
    res.status(403).json(
      errorResponse('Origin is not allowed to access this API', 'CORS_NOT_ALLOWED')
    );
    return;
  }

  const mapped = mapError(err);
  if (mapped.status >= 500) {
    console.error('[Error]', req.method, req.path, err);
  }
  res.status(mapped.status).json(
    errorResponse(mapped.message, mapped.code, mapped.errors as any[])
  );
};
