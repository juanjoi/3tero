CREATE TYPE "public"."file_format" AS ENUM('stl', '3mf');--> statement-breakpoint
CREATE TYPE "public"."file_kind" AS ENUM('model', 'sliced');--> statement-breakpoint
CREATE TYPE "public"."print_result" AS ENUM('success', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."project_source" AS ENUM('manual', 'makerworld');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('modeling', 'sliced', 'printed');--> statement-breakpoint
CREATE TABLE "filaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"brand" text,
	"color_name" text NOT NULL,
	"color_hex" text NOT NULL,
	"price_per_kg" numeric(8, 2) NOT NULL,
	"bambu_preset_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_filaments" (
	"file_id" uuid NOT NULL,
	"filament_id" uuid NOT NULL,
	"slot" integer DEFAULT 1 NOT NULL,
	"grams" numeric(8, 2) NOT NULL,
	CONSTRAINT "file_filaments_file_id_filament_id_slot_pk" PRIMARY KEY("file_id","filament_id","slot")
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"spec" text,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_log_filaments" (
	"print_log_id" uuid NOT NULL,
	"filament_id" uuid NOT NULL,
	"grams" numeric(8, 2) NOT NULL,
	"price_per_kg" numeric(8, 2) NOT NULL,
	CONSTRAINT "print_log_filaments_print_log_id_filament_id_pk" PRIMARY KEY("print_log_id","filament_id")
);
--> statement-breakpoint
CREATE TABLE "print_log_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"print_log_id" uuid NOT NULL,
	"path" text NOT NULL,
	"thumb_path" text,
	"size" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"file_id" uuid,
	"printed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"result" "print_result" NOT NULL,
	"minutes" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "file_kind" DEFAULT 'model' NOT NULL,
	"format" "file_format" NOT NULL,
	"path" text NOT NULL,
	"size" bigint NOT NULL,
	"sha256" text NOT NULL,
	"original_name" text NOT NULL,
	"label" text,
	"notes" text,
	"est_minutes" integer,
	"plates" integer,
	"printer_model_id" text,
	"bbox_x" real,
	"bbox_y" real,
	"bbox_z" real,
	"fits_printer" boolean,
	"thumbnail_path" text,
	"parsed" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"path" text NOT NULL,
	"thumb_path" text,
	"size" bigint NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_materials" (
	"project_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "project_materials_project_id_material_id_pk" PRIMARY KEY("project_id","material_id")
);
--> statement-breakpoint
CREATE TABLE "project_sources" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"importer" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"raw" jsonb NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tags" (
	"project_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "project_tags_project_id_tag_id_pk" PRIMARY KEY("project_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'modeling' NOT NULL,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"source" "project_source" DEFAULT 'manual' NOT NULL,
	"source_url" text,
	"designer" text,
	"designer_url" text,
	"license" text,
	"notes" text,
	"cover_image_id" uuid,
	"final_file_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"from_status" "project_status",
	"to_status" "project_status" NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text
);
--> statement-breakpoint
ALTER TABLE "file_filaments" ADD CONSTRAINT "file_filaments_file_id_project_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."project_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_filaments" ADD CONSTRAINT "file_filaments_filament_id_filaments_id_fk" FOREIGN KEY ("filament_id") REFERENCES "public"."filaments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_log_filaments" ADD CONSTRAINT "print_log_filaments_print_log_id_print_logs_id_fk" FOREIGN KEY ("print_log_id") REFERENCES "public"."print_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_log_filaments" ADD CONSTRAINT "print_log_filaments_filament_id_filaments_id_fk" FOREIGN KEY ("filament_id") REFERENCES "public"."filaments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_log_images" ADD CONSTRAINT "print_log_images_print_log_id_print_logs_id_fk" FOREIGN KEY ("print_log_id") REFERENCES "public"."print_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_logs" ADD CONSTRAINT "print_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_logs" ADD CONSTRAINT "print_logs_file_id_project_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."project_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_images" ADD CONSTRAINT "project_images_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sources" ADD CONSTRAINT "project_sources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "print_logs_project_idx" ON "print_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_files_project_idx" ON "project_files" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_images_project_idx" ON "project_images" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_priority_idx" ON "projects" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "projects_title_trgm_idx" ON "projects" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "status_history_project_idx" ON "status_history" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_uq" ON "tags" USING btree (lower("name"));