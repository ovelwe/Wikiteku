ALTER TABLE "fandoms" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;