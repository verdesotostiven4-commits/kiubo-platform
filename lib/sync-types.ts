export type SyncAction = "upsert" | "delete";
export type SyncStatus = "pending" | "syncing" | "synced" | "failed";

export type SyncEntity =
  | "tenants"
  | "branches"
  | "tenantProducts"
  | "customers"
  | "sales"
  | "users"
  | "cashSessions"
  | "cashMovements"
  | "credits"
  | "creditPayments"
  | "settings"
  | "branding"
  | "suppliers"
  | "purchases"
  | "supplierPayments"
  | "stockMovements";

export type SyncQueueRecord = {
  id: string;
  operationId: string;
  tenantId: string;
  branchId?: string;
  entityType: SyncEntity;
  entityId: string;
  action: SyncAction;
  payload: unknown;
  status: SyncStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
};

export type AuditLogRecord = {
  id: string;
  tenantId: string;
  branchId?: string;
  actorUserId?: string;
  action: string;
  entityType: SyncEntity | "system";
  entityId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type SyncPushResult = { operationId:string; ok:boolean; remoteId?:string; error?:string };
export type SyncPullResult = { cursor?:string; changes:Array<{tenantId:string;branchId?:string;entityType:SyncEntity;entityId:string;action:SyncAction;payload?:unknown;updatedAt:string}> };
