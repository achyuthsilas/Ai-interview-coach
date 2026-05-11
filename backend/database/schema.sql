-- AI Interview Coach — Supabase schema
-- Run this once in the Supabase SQL Editor to create all required tables.

-- ============================================================
-- SESSIONS
-- ============================================================
create table if not exists interview_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null default 'anonymous',
  company       text not null,
  job_description text not null,
  resume        text not null,
  interview_type text not null,
  persona       text not null,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

-- ============================================================
-- MESSAGES
-- ============================================================
create table if not exists interview_messages (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references interview_sessions(id) on delete cascade,
  role            text not null,  -- 'interviewer' | 'candidate'
  content         text not null,
  question_number int,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- ANSWER EVALUATIONS  (one row per candidate answer)
-- ============================================================
create table if not exists answer_evaluations (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references interview_sessions(id) on delete cascade,
  question         text,
  answer           text,
  relevance_score  int,
  structure_score  int,
  depth_score      int,
  overall_score    int,
  strengths        text,
  weaknesses       text,
  better_answer    text,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- COACHING REPORTS  (one row per completed session)
-- ============================================================
create table if not exists coaching_reports (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references interview_sessions(id) on delete cascade,
  overall_score       int,
  summary             text,
  top_strengths       text,
  top_weaknesses      text,
  action_items        text,
  recurring_patterns  text,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- USER MEMORY  (cross-session pattern tracking)
-- ============================================================
create table if not exists user_memory (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  pattern_type  text not null,
  description   text not null,
  occurrences   int not null default 1,
  last_seen     timestamptz not null default now()
);

-- Basic indexes
create index if not exists idx_messages_session   on interview_messages(session_id);
create index if not exists idx_evals_session      on answer_evaluations(session_id);
create index if not exists idx_reports_session    on coaching_reports(session_id);
create index if not exists idx_memory_user        on user_memory(user_id);
