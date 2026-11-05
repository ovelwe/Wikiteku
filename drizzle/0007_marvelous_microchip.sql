CREATE TABLE "article_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"source_revision" integer NOT NULL,
	"source_language" text NOT NULL,
	"target_language" text NOT NULL,
	"source_hash" text NOT NULL,
	"provider" text NOT NULL,
	"engine_version" text NOT NULL,
	"status" text NOT NULL,
	"attempt_id" text NOT NULL,
	"retry_at" timestamp NOT NULL,
	"content" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translation_corrections" (
	"translation_id" text PRIMARY KEY NOT NULL,
	"content" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"editor_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_translations" ADD CONSTRAINT "article_translations_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_corrections" ADD CONSTRAINT "translation_corrections_translation_id_article_translations_id_fk" FOREIGN KEY ("translation_id") REFERENCES "public"."article_translations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_corrections" ADD CONSTRAINT "translation_corrections_editor_id_user_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_translations_page_idx" ON "article_translations" USING btree ("page_id");