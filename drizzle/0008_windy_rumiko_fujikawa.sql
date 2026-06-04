CREATE TABLE "generated_apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"app_name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT 'LayoutTemplate' NOT NULL,
	"color" text DEFAULT '#ef594a' NOT NULL,
	"layout" text DEFAULT 'single-page' NOT NULL,
	"schema" jsonb NOT NULL,
	"is_sidebar_pinned" boolean DEFAULT false NOT NULL,
	"sidebar_position" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_apps" ADD CONSTRAINT "generated_apps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;