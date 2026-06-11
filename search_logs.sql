-- ============================================================
-- 벨로르(BELLORE) · 검색 기록(인기검색어 적립) + 할인가 컬럼
-- Supabase SQL Editor 에서 그대로 실행하세요.
-- ============================================================

-- 1) 할인 판매가(이전 작업) — 이미 했다면 건너뛰어도 됩니다.
alter table public.listings
  add column if not exists sale_price bigint;

-- 2) 검색 기록 테이블
create table if not exists public.search_logs (
  id         bigserial primary key,
  q          text not null,
  user_id    uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists search_logs_q_idx on public.search_logs (q);
create index if not exists search_logs_created_idx on public.search_logs (created_at);

-- 3) RLS: 누구나(익명 포함) 검색어를 적재만 할 수 있게
alter table public.search_logs enable row level security;

drop policy if exists "search_logs insert" on public.search_logs;
create policy "search_logs insert"
  on public.search_logs for insert
  to anon, authenticated
  with check (true);

-- 4) 인기검색어 집계 함수(상위 N + 검색횟수)
create or replace function public.popular_searches(lim int default 10)
returns table(q text, cnt bigint)
language sql
stable
as $$
  select q, count(*)::bigint as cnt
  from public.search_logs
  group by q
  order by cnt desc
  limit lim
$$;

grant execute on function public.popular_searches(int) to anon, authenticated;

-- 참고: 검색 데이터가 1,000건 이상 쌓이면 인기검색어를 실제 랭킹으로 전환합니다.
-- 현재는 데이터가 부족하므로 화면에는 '핫 브랜드'를 노출하고, 검색어는 계속 수집됩니다.
