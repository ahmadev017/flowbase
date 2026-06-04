CREATE TABLE "space_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"email" text NOT NULL,
	"user_id" integer,
	"role" text DEFAULT 'editor' NOT NULL,
	"invited_by_user_id" integer NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "space_shares_space_email_unique" UNIQUE("space_id","email")
);
--> statement-breakpoint
ALTER TABLE "workspace_pages" ADD COLUMN "content" jsonb DEFAULT '{"text":""}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "space_shares" ADD CONSTRAINT "space_shares_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_shares" ADD CONSTRAINT "space_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_shares" ADD CONSTRAINT "space_shares_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;