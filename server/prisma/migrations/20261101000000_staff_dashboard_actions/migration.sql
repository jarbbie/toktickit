-- Support bounded, current-user Action summaries on the Staff Dashboard.
CREATE INDEX "ActionTaken_performedById_actionAt_id_idx"
  ON "ActionTaken"("performedById", "actionAt", "id");
