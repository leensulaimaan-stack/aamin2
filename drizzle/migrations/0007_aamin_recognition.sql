-- Aamin: «تكريم الشهر» — monthly recognition candidates, visible to team managers and admins only.
-- Ranking uses approved points only (points are written on manager approval). Anyone who had a
-- round sent back (rejected) in the month is not eligible that month.

-- track how many times each inspection was sent back, so eligibility survives a later re-approval
alter table public.inspections add column if not exists rejections int not null default 0;
update public.inspections i set rejections = s.c
from (select entity_id, count(*)::int c from public.notifications where type = 'rejected' and entity_type = 'inspection' group by entity_id) s
where s.entity_id = i.id and i.rejections = 0;

create or replace function public.reject_inspection(p_id uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare i public.inspections;
begin
  select * into i from public.inspections where id = p_id;
  if not public.is_manager_of(public.building_team(i.building_id)) then raise exception 'غير مصرح'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'اكتب سبب الرفض'; end if;
  update public.inspections set status = 'مرفوضة', rejection_reason = p_reason, reviewed_by = auth.uid(), reviewed_at = now(), rejections = rejections + 1
  where id = p_id and status = 'بانتظار الاعتماد';
  if not found then raise exception 'الجولة ليست بانتظار الاعتماد'; end if;
  perform public._notify(i.assignee_id, 'rejected', 'inspection', p_id, 'أُعيدت جولتك للتعديل', p_reason, '/jawlati/inspection/' || p_id, 'rejected:' || p_id || ':' || extract(epoch from now())::bigint);
end $$;

-- internal: candidates for a month and (optionally) a team; no permission check
create or replace function public._recognition(p_month date, p_team uuid)
returns table (user_id uuid, full_name text, team_id uuid, points int, rounds_on_time int, same_day int, documented int,
               actions_closed int, rounds_total int, rejections int, eligible boolean, rank int)
language sql stable security definer set search_path = public as $$
  with m as (select date_trunc('month', p_month)::date s, (date_trunc('month', p_month) + interval '1 month')::date e),
  ppl as (
    select p.id, p.full_name, p.team_id from public.profiles p
    where p.is_active and (p_team is null or p.team_id = p_team)
      and not exists (select 1 from public.user_roles r where r.user_id = p.id and r.role in ('admin','manager'))
  ),
  pts as (
    select l.user_id,
      sum(l.points)::int pts,
      count(*) filter (where l.reason = 'جولة في موعدها')::int ot,
      count(*) filter (where l.reason = 'رفع التقرير في نفس اليوم')::int sd,
      count(*) filter (where l.reason = 'توثيق ملاحظة بالصور')::int doc,
      count(*) filter (where l.reason = 'إغلاق إجراء تصحيحي في موعده')::int cl
    from public.points_ledger l, m
    where (l.created_at at time zone 'Asia/Riyadh')::date >= m.s and (l.created_at at time zone 'Asia/Riyadh')::date < m.e
    group by l.user_id
  ),
  ins as (
    select i.assignee_id uid, count(*)::int tot, coalesce(sum(i.rejections),0)::int rj
    from public.inspections i, m where i.due_date >= m.s and i.due_date < m.e group by i.assignee_id
  ),
  base as (
    select p.id, p.full_name, p.team_id, coalesce(pts.pts,0) pts, coalesce(pts.ot,0) ot, coalesce(pts.sd,0) sd,
      coalesce(pts.doc,0) doc, coalesce(pts.cl,0) cl, coalesce(ins.tot,0) tot, coalesce(ins.rj,0) rj,
      (coalesce(ins.rj,0) = 0 and coalesce(pts.pts,0) > 0) ok
    from ppl p left join pts on pts.user_id = p.id left join ins on ins.uid = p.id
  )
  select b.id, b.full_name, b.team_id, b.pts, b.ot, b.sd, b.doc, b.cl, b.tot, b.rj, b.ok,
    case when b.ok then (row_number() over (partition by b.ok order by b.pts desc, b.ot desc, b.cl desc, b.full_name))::int end
  from base b
  where b.pts > 0 or b.tot > 0
  order by b.ok desc, b.pts desc, b.ot desc, b.cl desc, b.full_name
$$;
revoke execute on function public._recognition(date, uuid) from public, anon, authenticated;

-- public: managers see their own team, admins see all teams or one team
create or replace function public.recognition_candidates(p_month date default null, p_team uuid default null)
returns table (user_id uuid, full_name text, team_id uuid, points int, rounds_on_time int, same_day int, documented int,
               actions_closed int, rounds_total int, rejections int, eligible boolean, rank int)
language plpgsql stable security definer set search_path = public as $$
declare t uuid;
begin
  if public.is_admin() then t := p_team;
  elsif public.has_role(auth.uid(), 'manager') then t := public.my_team();
    if t is null then raise exception 'لا يوجد فريق مرتبط بحسابك'; end if;
  else raise exception 'غير مصرح'; end if;
  return query select * from public._recognition(coalesce(p_month, public.riyadh_today()), t);
end $$;
revoke execute on function public.recognition_candidates(date, uuid) from public, anon;
grant execute on function public.recognition_candidates(date, uuid) to authenticated;

-- monthly notice to managers on the first workday of the month, about the previous month
create or replace function public._recognition_notify(p_day date) returns int language plpgsql security definer set search_path = public as $$
declare first_wd date := date_trunc('month', p_day)::date; prev date; mgr record; names text; n int := 0;
  months text[] := array['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
begin
  while not public.is_workday(first_wd) loop first_wd := first_wd + 1; end loop;
  if p_day <> first_wd then return 0; end if;
  prev := (date_trunc('month', p_day) - interval '1 month')::date;
  for mgr in
    select p.id, r.role, p.team_id from public.profiles p join public.user_roles r on r.user_id = p.id
    where p.is_active and (r.role = 'admin' or (r.role = 'manager' and p.team_id is not null))
  loop
    select string_agg(c.full_name || ' (' || c.points || case when c.points between 3 and 10 then ' نقاط' else ' نقطة' end || ')', '، ' order by c.rank) into names
    from public._recognition(prev, case when mgr.role = 'admin' then null else mgr.team_id end) c
    where c.eligible and c.rank <= 3;
    if names is not null then
      n := n + public._notify(mgr.id, 'recognition', null, null,
        'المرشحون للتكريم لشهر ' || months[extract(month from prev)::int],
        'بحسب النقاط المعتمدة: ' || names || '. التفاصيل في لوحة الفريق.',
        '/dashboard', 'recognition:' || to_char(prev, 'YYYY-MM') || ':' || mgr.id);
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public._recognition_notify(date) from public, anon, authenticated;

create or replace function public._daily_job() returns int language plpgsql security definer set search_path = public as $$
begin
  perform public._generate_inspections(public.riyadh_today());
  update public.tasks set updated_at = now() where status not in ('مكتملة','ملغاة');
  return public._run_notifications(public.riyadh_today()) + public._recognition_notify(public.riyadh_today());
end $$;
revoke execute on function public._daily_job() from public, anon, authenticated;
grant execute on function public._daily_job() to service_role;
COMMENT ON FUNCTION public._daily_job() IS 'Aamin daily job: monthly inspections, time-based reclassification, notifications, monthly recognition notice';

create or replace function public.run_notifications_now() returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;
  perform public._generate_inspections(public.riyadh_today());
  update public.tasks set updated_at = now() where status not in ('مكتملة','ملغاة');
  return public._run_notifications(public.riyadh_today()) + public._recognition_notify(public.riyadh_today());
end $$;
