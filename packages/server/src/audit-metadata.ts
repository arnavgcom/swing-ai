export function buildInsertAuditFields(actorUserId?: string | null) {
  const actor = String(actorUserId || "").trim() || null;
  const now = new Date();
  return {
    createdAt: now,
    updatedAt: now,
    createdByUserId: actor,
    updatedByUserId: actor,
  };
}

export function buildUpdateAuditFields(actorUserId?: string | null) {
  const actor = String(actorUserId || "").trim() || null;
  return {
    updatedAt: new Date(),
    updatedByUserId: actor,
  };
}
