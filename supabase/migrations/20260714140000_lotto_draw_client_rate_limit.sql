-- Harden lotto_draw writes: require client_id, rate-limit per client.

alter table public.lotto_draw
  add column if not exists client_id text;

create index if not exists lotto_draw_client_created_idx
  on public.lotto_draw (client_id, created_at desc);

create or replace function public.lotto_draw_rate_limit()
returns trigger
language plpgsql
as $$
declare
  recent_count integer;
begin
  if new.client_id is null or length(trim(new.client_id)) = 0 then
    raise exception 'client_id required';
  end if;

  select count(*)::integer into recent_count
  from public.lotto_draw
  where client_id = new.client_id
    and created_at > now() - interval '1 minute';

  if recent_count >= 30 then
    raise exception 'rate limit: too many draws from this client';
  end if;

  return new;
end;
$$;

drop trigger if exists lotto_draw_rate_limit_trg on public.lotto_draw;
create trigger lotto_draw_rate_limit_trg
  before insert on public.lotto_draw
  for each row
  execute function public.lotto_draw_rate_limit();

drop policy if exists "Anyone can insert lotto_draw" on public.lotto_draw;
create policy "Anyone can insert lotto_draw"
  on public.lotto_draw
  for insert
  to anon, authenticated
  with check (
    cardinality(numbers) = 6
    and (select count(distinct n) from unnest(numbers) as n) = 6
    and (select bool_and(n between 1 and 45) from unnest(numbers) as n)
    and client_id is not null
    and client_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  );
