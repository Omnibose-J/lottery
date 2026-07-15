-- Audit remediation: server-side writes only + IP-hash rate limit.
-- Anon/authenticated may SELECT public columns only; INSERT goes via service role API.

alter table public.lotto_draw
  add column if not exists ip_hash text;

create index if not exists lotto_draw_ip_created_idx
  on public.lotto_draw (ip_hash, created_at desc);

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

  if new.ip_hash is not null and length(trim(new.ip_hash)) > 0 then
    select count(*)::integer into recent_count
    from public.lotto_draw
    where ip_hash = new.ip_hash
      and created_at > now() - interval '1 minute';

    if recent_count >= 20 then
      raise exception 'rate limit: too many draws from this network';
    end if;
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

-- Block direct browser inserts (rotatable client_id flood path).
drop policy if exists "Anyone can insert lotto_draw" on public.lotto_draw;

-- Keep public read of draw results only (hide client_id / ip_hash).
revoke all on table public.lotto_draw from anon, authenticated;
grant select (id, numbers, created_at) on table public.lotto_draw to anon, authenticated;

drop policy if exists "Anyone can read lotto_draw" on public.lotto_draw;
create policy "Anyone can read lotto_draw"
  on public.lotto_draw
  for select
  to anon, authenticated
  using (true);
