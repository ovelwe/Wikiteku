CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"fandom_id" text NOT NULL,
	"uploader_id" text NOT NULL,
	"name" text NOT NULL,
	"alt" text NOT NULL,
	"data" text NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_design_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"revision" integer NOT NULL,
	"document" jsonb NOT NULL,
	"published" boolean NOT NULL,
	"editor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_designs" (
	"page_id" text PRIMARY KEY NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"revision" integer DEFAULT 0 NOT NULL,
	"published_revision" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "page_revisions" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "categories" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "cover" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_fandom_id_fandoms_id_fk" FOREIGN KEY ("fandom_id") REFERENCES "public"."fandoms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploader_id_user_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_design_versions" ADD CONSTRAINT "page_design_versions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_design_versions" ADD CONSTRAINT "page_design_versions_editor_id_user_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_designs" ADD CONSTRAINT "page_designs_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_fandom_idx" ON "media" USING btree ("fandom_id");--> statement-breakpoint
CREATE UNIQUE INDEX "page_design_versions_fandom_revision" ON "page_design_versions" USING btree ("page_id","revision");