import type { NextFunction, RequestHandler, Response } from 'express';
import type { AuthenticatedRequest } from '../auth/types.js';

export type AsyncHandler = (request: AuthenticatedRequest, response: Response) => Promise<unknown>;

/** Encaminha rejeições assíncronas ao error handler central do Express. */
export function asyncRoute(handler: AsyncHandler): RequestHandler {
  return (request, response, next: NextFunction) => {
    Promise.resolve(handler(request as AuthenticatedRequest, response)).catch(next);
  };
}
