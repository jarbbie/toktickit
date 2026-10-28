-- Add Lab 4 workflow data without rewriting Lab 1-3 records.
BEGIN;

CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ActionEventType" AS ENUM ('CREATED', 'EDITED', 'ASSIGNED', 'STATUS_CHANGED');

ALTER TABLE "Ticket"
  ADD COLUMN "workflowVersion" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "Ticket_workflowVersion_positive_check" CHECK ("workflowVersion" > 0);

CREATE TABLE "ActionTaken" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "actionAt" TIMESTAMP(3) NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "result" VARCHAR(2000),
  "performedById" INTEGER NOT NULL,
  "assigneeId" INTEGER,
  "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "followUpNote" VARCHAR(1000),
  "attachmentNotes" VARCHAR(1000),
  "version" INTEGER NOT NULL DEFAULT 1,
  "idempotencyKey" UUID NOT NULL,
  "creationFingerprint" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActionTaken_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "ActionTaken_completion_result_check" CHECK (
    "status" <> 'COMPLETED' OR ("result" IS NOT NULL AND char_length(btrim("result")) BETWEEN 1 AND 2000)
  ),
  CONSTRAINT "ActionTaken_description_check" CHECK (char_length(btrim("description")) BETWEEN 1 AND 2000),
  CONSTRAINT "ActionTaken_result_check" CHECK ("result" IS NULL OR char_length(btrim("result")) BETWEEN 1 AND 2000),
  CONSTRAINT "ActionTaken_followUpNote_check" CHECK (
    ("followUpRequired" AND "followUpNote" IS NOT NULL AND char_length(btrim("followUpNote")) BETWEEN 1 AND 1000)
    OR (NOT "followUpRequired" AND "followUpNote" IS NULL)
  ),
  CONSTRAINT "ActionTaken_attachmentNotes_check" CHECK (
    "attachmentNotes" IS NULL OR char_length(btrim("attachmentNotes")) BETWEEN 1 AND 1000
  ),
  CONSTRAINT "ActionTaken_creationFingerprint_check" CHECK ("creationFingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ActionTaken_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ActionTaken_idempotencyKey_key" ON "ActionTaken"("idempotencyKey");
CREATE INDEX "ActionTaken_ticketId_actionAt_id_idx" ON "ActionTaken"("ticketId", "actionAt", "id");
CREATE INDEX "ActionTaken_assigneeId_status_idx" ON "ActionTaken"("assigneeId", "status");
CREATE INDEX "ActionTaken_ticketId_status_idx" ON "ActionTaken"("ticketId", "status");

CREATE TABLE "ActionEvent" (
  "id" SERIAL NOT NULL,
  "actionId" INTEGER NOT NULL,
  "actorId" INTEGER NOT NULL,
  "type" "ActionEventType" NOT NULL,
  "before" JSONB,
  "after" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActionEvent_snapshot_check" CHECK (
    ("type" = 'CREATED' AND "before" IS NULL)
    OR ("type" <> 'CREATED' AND "before" IS NOT NULL)
  ),
  CONSTRAINT "ActionEvent_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ActionEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ActionEvent_actionId_createdAt_id_idx" ON "ActionEvent"("actionId", "createdAt", "id");

CREATE TABLE "TicketStatusEvent" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "fromStatus" "TicketStatus" NOT NULL,
  "toStatus" "TicketStatus" NOT NULL,
  "actorId" INTEGER NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketStatusEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketStatusEvent_status_change_check" CHECK ("fromStatus" <> "toStatus"),
  CONSTRAINT "TicketStatusEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TicketStatusEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TicketStatusEvent_ticketId_changedAt_id_idx" ON "TicketStatusEvent"("ticketId", "changedAt", "id");
CREATE INDEX "TicketStatusEvent_toStatus_changedAt_ticketId_id_idx" ON "TicketStatusEvent"("toStatus", "changedAt", "ticketId", "id");

CREATE INDEX "Ticket_requesterId_status_updatedAt_id_idx" ON "Ticket"("requesterId", "status", "updatedAt", "id");
CREATE INDEX "Ticket_ownerId_status_updatedAt_id_idx" ON "Ticket"("ownerId", "status", "updatedAt", "id");
CREATE INDEX "Ticket_status_itPriority_updatedAt_id_idx" ON "Ticket"("status", "itPriority", "updatedAt", "id");

CREATE FUNCTION "reject_audit_event_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ActionEvent_append_only"
  BEFORE UPDATE OR DELETE ON "ActionEvent"
  FOR EACH ROW EXECUTE FUNCTION "reject_audit_event_mutation"();
CREATE TRIGGER "TicketStatusEvent_append_only"
  BEFORE UPDATE OR DELETE ON "TicketStatusEvent"
  FOR EACH ROW EXECUTE FUNCTION "reject_audit_event_mutation"();
CREATE TRIGGER "ActionEvent_no_truncate"
  BEFORE TRUNCATE ON "ActionEvent"
  FOR EACH STATEMENT EXECUTE FUNCTION "reject_audit_event_mutation"();
CREATE TRIGGER "TicketStatusEvent_no_truncate"
  BEFORE TRUNCATE ON "TicketStatusEvent"
  FOR EACH STATEMENT EXECUTE FUNCTION "reject_audit_event_mutation"();

COMMIT;
