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

function firestoreFailure(error: unknown): { code: string; message: string } | null {
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  if (code === 8 || code === '8' || code === 'RESOURCE_EXHAUSTED' || code === 'resource-exhausted'
    || /RESOURCE_EXHAUSTED|Quota exceeded/i.test(message)) {
    return {
      code: 'FIRESTORE_QUOTA_EXHAUSTED',
      message: 'A quota diária do Firestore foi esgotada. Use o modo local e tente sincronizar novamente após a renovação.',
    };
  }
  if (code === 14 || code === '14' || code === 'UNAVAILABLE' || code === 'unavailable'
    || /Firestore.*unavailable|DEADLINE_EXCEEDED/i.test(message)) {
    return {
      code: 'FIRESTORE_UNAVAILABLE',
      message: 'O Firestore está temporariamente indisponível. Use o modo local e tente sincronizar novamente mais tarde.',
    };
  }
  return null;
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

  const dependencyFailure = firestoreFailure(error);
  if (dependencyFailure) {
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'firestore_dependency_failed',
      requestId: res.getHeader('x-request-id') || null,
      method: req.method,
      path: req.path,
      errorCode: dependencyFailure.code,
    }));
    res.status(503).json({ error: dependencyFailure });
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
