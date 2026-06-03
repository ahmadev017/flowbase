CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"content" jsonb DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb NOT NULL,
	"color" text DEFAULT '#55cdb4' NOT NULL,
	"icon" text DEFAULT 'FileText' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;