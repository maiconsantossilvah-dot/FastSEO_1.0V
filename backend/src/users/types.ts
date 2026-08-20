import type { Timestamp } from 'firebase-admin/firestore';

export const USER_ROLES = ['owner', 'admin', 'collaborator', 'viewer'] as const;
export const USER_STATUSES = ['pending', 'active', 'rejected', 'suspended'] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

export interface UserDocument {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole | null;
  status: UserStatus;
  createdAt: Timestamp;
  approvedAt: Timestamp | null;
  approvedBy: string | null;
}
