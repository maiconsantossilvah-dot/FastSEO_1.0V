import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Request } from 'express';
import type { UserDocument } from '../users/types.js';

export interface AuthenticatedRequest extends Request {
  firebaseUser?: DecodedIdToken;
  currentUser?: UserDocument;
}
