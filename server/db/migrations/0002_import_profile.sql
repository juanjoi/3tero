ALTER TABLE "project_sources" ADD COLUMN "profile" jsonb;--> statement-breakpoint
CREATE INDEX "project_sources_external_idx" ON "project_sources" USING btree ("importer","external_id");