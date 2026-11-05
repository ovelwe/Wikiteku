CREATE TABLE "design_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"fandom_id" text NOT NULL,
	"revision" integer NOT NULL,
	"document" jsonb NOT NULL,
	"published" boolean NOT NULL,
	"editor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fandom_designs" (
	"fandom_id" text PRIMARY KEY NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"revision" integer DEFAULT 0 NOT NULL,
	"published_revision" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_themes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"theme" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_versions" ADD CONSTRAINT "design_versions_fandom_id_fandoms_id_fk" FOREIGN KEY ("fandom_id") REFERENCES "public"."fandoms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_versions" ADD CONSTRAINT "design_versions_editor_id_user_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fandom_designs" ADD CONSTRAINT "fandom_designs_fandom_id_fandoms_id_fk" FOREIGN KEY ("fandom_id") REFERENCES "public"."fandoms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_themes" ADD CONSTRAINT "user_themes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "design_versions_fandom_revision" ON "design_versions" USING btree ("fandom_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "user_themes_user_name" ON "user_themes" USING btree ("user_id","name");