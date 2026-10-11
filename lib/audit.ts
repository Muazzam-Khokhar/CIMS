import mongoose from "mongoose";
import AuditLog, {
  AuditAction,
  AuditEntity,
} from "@/models/AuditLog";

type AuditActor = {
  userId: string;
  role: "OWNER" | "MANAGER" | "STAFF";
  name?: string;
};

type CreateAuditLogParams = {
  actor: AuditActor;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  description: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  session?: mongoose.ClientSession;
};

export async function createAuditLog({
  actor,
  action,
  entity,
  entityId,
  description,
  before,
  after,
  session,
}: CreateAuditLogParams) {
  const payload = {
    actorId: new mongoose.Types.ObjectId(actor.userId),
    actorName: actor.name,
    actorRole: actor.role,
    action,
    entity,
    entityId: entityId
      ? new mongoose.Types.ObjectId(entityId)
      : undefined,
    description,
    before,
    after,
  };

  if (session) {
    await AuditLog.create([payload], { session });
    return;
  }

  await AuditLog.create(payload);
}