/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  } | null;
  timestamp: string;
}

/**
 * Handles Firestore "Missing or insufficient permissions" or other errors
 * and prints/throws a JSON string matching FirestoreErrorInfo.
 */
export function handleFirestoreError(
  error: any,
  operationType: OperationType,
  path: string | null
): never {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  const errorInfo: FirestoreErrorInfo = {
    error: errorMessage,
    operationType,
    path,
    authInfo: null, // We are playing in Guest/Anonymous mode, so we have no auth token
    timestamp: new Date().toISOString(),
  };

  const serial = JSON.stringify(errorInfo, null, 2);
  console.error("Firestore Transaction Failed Configuration Context:\n", serial);
  throw new Error(serial);
}
