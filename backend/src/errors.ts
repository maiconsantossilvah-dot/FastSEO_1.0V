import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Os dados enviados são inválidos.',
        details: error.issues,
      },
    });
    return;
  }

  console.error(JSON.stringify({
    level: 'error',
    event: 'unhandled_error',
    requestId: res.getHeader('x-request-id') || null,
    method: req.method,
    path: req.path,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
  }));
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a operação.' },
  });
};
