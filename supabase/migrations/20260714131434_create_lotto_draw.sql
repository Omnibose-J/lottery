create table if not exists public.lotto_draw (
  id bigint generated always as identity primary key,
  numbers smallint[] not null,
  created_at timestamptz not null default now(),
  constraint lotto_draw_numbers_len check (cardinality(numbers) = 6)
);

create index if not exists lotto_draw_created_at_idx
  on public.lotto_draw (created_at desc);

alter table public.lotto_draw enable row level security;

drop policy if exists "Anyone can read lotto_draw" on public.lotto_draw;
create policy "Anyone can read lotto_draw"
  on public.lotto_draw
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can insert lotto_draw" on public.lotto_draw;
create policy "Anyone can insert lotto_draw"
  on public.lotto_draw
  for insert
  to anon, authenticated
  with check (
    cardinality(numbers) = 6
    and (select count(distinct n) from unnest(numbers) as n) = 6
    and (select bool_and(n between 1 and 45) from unnest(numbers) as n)
  );