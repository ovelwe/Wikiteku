CREATE TABLE "moderation_events" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"page_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"note" text NOT NULL,
	"moderation_revision" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"reporter_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"decision" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "blocked_at" timestamp;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "moderation_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moderation_events_page_idx" ON "moderation_events" USING btree ("page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_open_reporter_page" ON "reports" USING btree ("reporter_id","page_id") WHERE "reports"."status" = 'open';--> statement-breakpoint
CREATE INDEX "reports_status_created_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter_id");