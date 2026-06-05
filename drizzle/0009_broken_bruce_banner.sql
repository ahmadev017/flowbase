CREATE TABLE "user_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"scope" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#ef594a' NOT NULL,
	"icon" text DEFAULT 'Tag' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_categories_user_scope_name_unique" UNIQUE("user_id","scope","name")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"theme_preference" text DEFAULT 'system' NOT NULL,
	"notification_settings" jsonb DEFAULT '{"email":true,"desktop":true,"reminders":true,"weeklyDigest":false}'::jsonb NOT NULL,
	"default_calendar_view" text DEFAULT 'month' NOT NULL,
	"default_task_priority" text DEFAULT 'Medium' NOT NULL,
	"auto_save" boolean DEFAULT true NOT NULL,
	"ai_settings" jsonb DEFAULT '{"preferredModel":"gemini-2.5-flash","defaultBehavior":"balanced","responseTone":"friendly","features":{"aiRefine":true,"aiAssistant":true,"aiTemplateBuilder":true,"aiWhiteboard":true}}'::jsonb NOT NULL,
	"privacy_settings" jsonb DEFAULT '{"twoFactorReminder":true,"showProfileInSharedSpaces":true,"allowProductAnalytics":false}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_categories" ADD CONSTRAINT "user_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;