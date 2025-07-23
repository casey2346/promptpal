import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuditLog extends Document {
  actorId: string;
  action: string;
  operationName?: string;              // Semantic label, e.g. 'user.login'
  userLevel?: 'admin' | 'user' | 'internal';
  status: 'success' | 'failure';
  endpoint: string;
  method: string;
  httpStatus?: number;
  ip?: string;
  userAgent?: string;
  geo?: {
    country?: string;
    region?: string;
  };
  tenantId?: string;
  latencyMs?: number;
  requestId?: string;
  eventId?: string;
  sourceModule?: string;
  expiresAt?: Date;
  messageI18n?: {
    en?: string;
    zh?: string;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: String, required: true },
    action: { type: String, required: true },
    operationName: { type: String },
    userLevel: { type: String, enum: ['admin', 'user', 'internal'] },
    status: { type: String, enum: ['success', 'failure'], required: true },
    endpoint: { type: String, required: true },
    method: { type: String, required: true },
    httpStatus: { type: Number },
    ip: { type: String },
    userAgent: { type: String },
    geo: {
      country: { type: String },
      region: { type: String },
    },
    tenantId: { type: String },
    latencyMs: { type: Number },
    requestId: { type: String },
    eventId: { type: String },
    sourceModule: { type: String },
    expiresAt: {
      type: Date,
      expires: '30d',
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // TTL expiry
    },
    messageI18n: {
      en: { type: String },
      zh: { type: String },
    },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// 📈 Indexes for observability and analytics
AuditLogSchema.index({ tenantId: 1, action: 1, createdAt: -1 });
AuditLogSchema.index({ operationName: 1 });
AuditLogSchema.index({ requestId: 1 });
AuditLogSchema.index({ eventId: 1 });
AuditLogSchema.index({ expiresAt: 1 });
AuditLogSchema.index({ sourceModule: 1 });
AuditLogSchema.index({ geo: 1 });
AuditLogSchema.index({ userLevel: 1 });

const AuditLogModel: Model<IAuditLog> = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
export default AuditLogModel;

// 📜 OpenAPI-compatible schema for Swagger
export const AuditLogDto = {
  type: 'object',
  properties: {
    actorId: { type: 'string' },
    action: { type: 'string' },
    operationName: { type: 'string' },
    userLevel: { type: 'string', enum: ['admin', 'user', 'internal'] },
    status: { type: 'string', enum: ['success', 'failure'] },
    endpoint: { type: 'string' },
    method: { type: 'string' },
    httpStatus: { type: 'integer' },
    ip: { type: 'string' },
    userAgent: { type: 'string' },
    geo: {
      type: 'object',
      properties: {
        country: { type: 'string' },
        region: { type: 'string' },
      },
    },
    tenantId: { type: 'string' },
    latencyMs: { type: 'number' },
    requestId: { type: 'string' },
    eventId: { type: 'string' },
    sourceModule: { type: 'string' },
    messageI18n: {
      type: 'object',
      properties: {
        en: { type: 'string' },
        zh: { type: 'string' },
      },
    },
    metadata: { type: 'object' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['actorId', 'action', 'status', 'endpoint', 'method', 'createdAt'],
};
