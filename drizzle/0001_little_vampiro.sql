CREATE TABLE "calendar_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'task' NOT NULL,
	"category" text NOT NULL,
	"category_color" text NOT NULL,
	"scheduled_date" date,
	"scheduled_time" time,
	"is_draft" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_tasks" ADD CONSTRAINT "calendar_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;