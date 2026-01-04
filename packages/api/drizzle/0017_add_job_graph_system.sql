-- Job Graph System Migration
-- Adds tables for job graph orchestration, milestones, facts, decisions, and conflicts

-- Create spine_job_graphs table
CREATE TABLE IF NOT EXISTS "spine_job_graphs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL UNIQUE,
	"property_id" uuid NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"overall_confidence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create spine_milestones table
CREATE TABLE IF NOT EXISTS "spine_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_graph_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"blockers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create spine_facts table
CREATE TABLE IF NOT EXISTS "spine_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_graph_id" uuid NOT NULL,
	"source_event_id" uuid,
	"category" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"unit" text,
	"confidence" integer DEFAULT 50 NOT NULL,
	"extracted_by" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create spine_decisions table
CREATE TABLE IF NOT EXISTS "spine_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_graph_id" uuid NOT NULL,
	"milestone_id" uuid,
	"decision_type" text NOT NULL,
	"decision" text NOT NULL,
	"reasoning" text NOT NULL,
	"rule_applied" jsonb,
	"evidence_fact_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"confidence" integer DEFAULT 50 NOT NULL,
	"risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL
);

-- Create spine_conflicts table
CREATE TABLE IF NOT EXISTS "spine_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_graph_id" uuid NOT NULL,
	"conflict_type" text NOT NULL,
	"severity" text NOT NULL,
	"description" text NOT NULL,
	"rule_1" jsonb,
	"rule_2" jsonb,
	"resolution" text,
	"affected_fact_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"affected_decision_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "spine_job_graphs" ADD CONSTRAINT "spine_job_graphs_visit_id_spine_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."spine_visits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "spine_job_graphs" ADD CONSTRAINT "spine_job_graphs_property_id_spine_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."spine_properties"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "spine_milestones" ADD CONSTRAINT "spine_milestones_job_graph_id_spine_job_graphs_id_fk" FOREIGN KEY ("job_graph_id") REFERENCES "public"."spine_job_graphs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "spine_facts" ADD CONSTRAINT "spine_facts_job_graph_id_spine_job_graphs_id_fk" FOREIGN KEY ("job_graph_id") REFERENCES "public"."spine_job_graphs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "spine_facts" ADD CONSTRAINT "spine_facts_source_event_id_spine_timeline_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."spine_timeline_events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "spine_decisions" ADD CONSTRAINT "spine_decisions_job_graph_id_spine_job_graphs_id_fk" FOREIGN KEY ("job_graph_id") REFERENCES "public"."spine_job_graphs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "spine_decisions" ADD CONSTRAINT "spine_decisions_milestone_id_spine_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."spine_milestones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "spine_conflicts" ADD CONSTRAINT "spine_conflicts_job_graph_id_spine_job_graphs_id_fk" FOREIGN KEY ("job_graph_id") REFERENCES "public"."spine_job_graphs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "spine_job_graphs_visit_idx" ON "spine_job_graphs" USING btree ("visit_id");
CREATE INDEX IF NOT EXISTS "spine_job_graphs_property_idx" ON "spine_job_graphs" USING btree ("property_id");
CREATE INDEX IF NOT EXISTS "spine_milestones_job_graph_idx" ON "spine_milestones" USING btree ("job_graph_id");
CREATE INDEX IF NOT EXISTS "spine_facts_job_graph_idx" ON "spine_facts" USING btree ("job_graph_id");
CREATE INDEX IF NOT EXISTS "spine_facts_category_idx" ON "spine_facts" USING btree ("category");
CREATE INDEX IF NOT EXISTS "spine_decisions_job_graph_idx" ON "spine_decisions" USING btree ("job_graph_id");
CREATE INDEX IF NOT EXISTS "spine_conflicts_job_graph_idx" ON "spine_conflicts" USING btree ("job_graph_id");
