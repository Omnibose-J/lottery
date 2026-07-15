create or replace function public.get_my_lotto_draws(
  p_client_id text,
  p_limit int default 40,
  p_offset int default 0
)
returns table (id bigint, numbers smallint[], created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_client_id is null
     or p_client_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'invalid client_id';
  end if;

  return query
  select d.id, d.numbers, d.created_at
  from public.lotto_draw d
  where d.client_id = lower(p_client_id)
  order by d.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.get_my_lotto_draws(text, int, int) from public;
grant execute on function public.get_my_lotto_draws(text, int, int) to anon, authenticated;
