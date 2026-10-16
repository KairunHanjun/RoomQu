CREATE TYPE "public"."account_type" AS ENUM('FO', 'HK', 'T', 'H');--> statement-breakpoint
CREATE TYPE "public"."unit_state" AS ENUM('Ready', 'StandBy', 'Working', 'Closed');--> statement-breakpoint
CREATE TABLE "absen" (
	"id" text PRIMARY KEY NOT NULL,
	"who" text NOT NULL,
	"type" "account_type" NOT NULL,
	"whenEntry" timestamp DEFAULT now() NOT NULL,
	"url_foto" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_type" "account_type" NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"email" text NOT NULL,
	"phone_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_who" text NOT NULL,
	CONSTRAINT "accounts_username_unique" UNIQUE("username"),
	CONSTRAINT "accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_name" text NOT NULL,
	"email" text NOT NULL,
	"phone_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_who" text NOT NULL,
	CONSTRAINT "agents_agent_name_unique" UNIQUE("agent_name"),
	CONSTRAINT "agents_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"uuid" text PRIMARY KEY NOT NULL,
	"host_name" text NOT NULL,
	"agent" text NOT NULL,
	"unit_id" text,
	"name" text NOT NULL,
	"duration" integer NOT NULL,
	"from_time" timestamp DEFAULT now() NOT NULL,
	"to_time" timestamp DEFAULT now() NOT NULL,
	"price" integer NOT NULL,
	"komisi" integer NOT NULL,
	"url_fotoKtp" text,
	"isDurationDays" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kebersihan" (
	"id" text PRIMARY KEY NOT NULL,
	"who" text NOT NULL,
	"type" "account_type" NOT NULL,
	"when" timestamp DEFAULT now() NOT NULL,
	"img_ruang" text NOT NULL,
	"img_mandi" text NOT NULL,
	"approve" boolean
);
--> statement-breakpoint
CREATE TABLE "masalah" (
	"id" text PRIMARY KEY NOT NULL,
	"unit_id" text,
	"who" text NOT NULL,
	"type" "account_type" NOT NULL,
	"img_url" text NOT NULL,
	"description" text NOT NULL,
	"when" timestamp DEFAULT now() NOT NULL,
	"berat" boolean DEFAULT false,
	"aman" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"unit_state" "unit_state" DEFAULT 'Ready',
	"from_time" timestamp,
	"to_time" timestamp,
	"created_by_who" text,
	"pending" boolean DEFAULT false,
	"kebersihan_id" text,
	CONSTRAINT "units_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "absen" ADD CONSTRAINT "absen_who_accounts_username_fk" FOREIGN KEY ("who") REFERENCES "public"."accounts"("username") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_host_name_accounts_username_fk" FOREIGN KEY ("host_name") REFERENCES "public"."accounts"("username") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_agent_agents_id_fk" FOREIGN KEY ("agent") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kebersihan" ADD CONSTRAINT "kebersihan_who_accounts_username_fk" FOREIGN KEY ("who") REFERENCES "public"."accounts"("username") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "masalah" ADD CONSTRAINT "masalah_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "masalah" ADD CONSTRAINT "masalah_who_accounts_username_fk" FOREIGN KEY ("who") REFERENCES "public"."accounts"("username") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_kebersihan_id_kebersihan_id_fk" FOREIGN KEY ("kebersihan_id") REFERENCES "public"."kebersihan"("id") ON DELETE no action ON UPDATE no action;
