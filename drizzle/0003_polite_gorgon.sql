CREATE TABLE "kanban_board_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"email" text NOT NULL,
	"user_id" integer,
	"role" text DEFAULT 'editor' NOT NULL,
	"invited_by_user_id" integer NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kanban_board_shares_board_email_unique" UNIQUE("board_id","email")
);
--> statement-breakpoint
ALTER TABLE "kanban_board_shares" ADD CONSTRAINT "kanban_board_shares_board_id_kanban_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_board_shares" ADD CONSTRAINT "kanban_board_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_board_shares" ADD CONSTRAINT "kanban_board_shares_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;