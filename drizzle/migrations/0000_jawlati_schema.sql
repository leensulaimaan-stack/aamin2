
create type public.app_role as enum ('employee','manager');

create table public.teams (id uuid primary key default gen_random_uuid(), name text not null unique);
grant select on public.teams to authenticated;
grant all on public.teams to service_role;
alter table public.teams enable row level security;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  team_id uuid references public.teams(id),
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "teams read" on public.teams for select to authenticated using (true);
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'manager'));
create policy "manager update profiles" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'manager'));
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'manager'));

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name text not null,
  team_id uuid references public.teams(id)
);
grant select, insert, update, delete on public.buildings to authenticated;
grant all on public.buildings to service_role;
alter table public.buildings enable row level security;
create policy "buildings read" on public.buildings for select to authenticated using (true);
create policy "buildings manage" on public.buildings for all to authenticated using (public.has_role(auth.uid(),'manager')) with check (public.has_role(auth.uid(),'manager'));

create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'تفتيش دوري' check (type in ('تفتيش دوري','جولة سلامة','فحص طفايات','فحص صناديق الإسعافات','تحديث سجلات','أخرى')),
  building_id uuid not null references public.buildings(id) on delete cascade,
  default_assignee_id uuid references public.profiles(id) on delete set null,
  recurrence text not null default 'monthly' check (recurrence in ('weekly','monthly','quarterly')),
  due_day int not null default 25 check (due_day between 1 and 31),
  checklist_items jsonb not null default '[]'::jsonb,
  requires_photo boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.task_templates to authenticated;
grant all on public.task_templates to service_role;
alter table public.task_templates enable row level security;
create policy "templates read" on public.task_templates for select to authenticated using (true);
create policy "templates manage" on public.task_templates for all to authenticated using (public.has_role(auth.uid(),'manager')) with check (public.has_role(auth.uid(),'manager'));

create table public.task_instances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.task_templates(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  building_id uuid not null references public.buildings(id) on delete cascade,
  due_date date not null,
  status text not null default 'لم تبدأ' check (status in ('لم تبدأ','قيد التنفيذ','بانتظار الاعتماد','معتمدة','مرفوضة')),
  submitted_at timestamptz,
  report_submitted_same_day boolean not null default false,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  unique (template_id, due_date)
);
create index on public.task_instances (assignee_id, due_date);
create index on public.task_instances (building_id, due_date);
grant select, insert, update, delete on public.task_instances to authenticated;
grant all on public.task_instances to service_role;
alter table public.task_instances enable row level security;
create policy "instances read" on public.task_instances for select to authenticated using (assignee_id = auth.uid() or public.has_role(auth.uid(),'manager'));
create policy "instances manage" on public.task_instances for all to authenticated using (public.has_role(auth.uid(),'manager')) with check (public.has_role(auth.uid(),'manager'));

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  task_instance_id uuid not null references public.task_instances(id) on delete cascade,
  checklist_results jsonb not null default '{}'::jsonb,
  photos text[] not null default '{}',
  findings_count int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.submissions (task_instance_id, created_at desc);
grant select on public.submissions to authenticated;
grant all on public.submissions to service_role;
alter table public.submissions enable row level security;
create policy "submissions read" on public.submissions for select to authenticated using (
  public.has_role(auth.uid(),'manager') or exists (select 1 from public.task_instances t where t.id = task_instance_id and t.assignee_id = auth.uid()));

create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  task_instance_id uuid references public.task_instances(id) on delete cascade,
  points int not null,
  reason text not null,
  created_at timestamptz not null default now()
);
grant select on public.points_ledger to authenticated;
grant all on public.points_ledger to service_role;
alter table public.points_ledger enable row level security;
create policy "points read" on public.points_ledger for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'manager'));

create table public.badges (id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, description text not null, icon text not null);
grant select on public.badges to authenticated;
grant all on public.badges to service_role;
alter table public.badges enable row level security;
create policy "badges read" on public.badges for select to authenticated using (true);

create table public.user_badges (
  user_id uuid not null, badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(), primary key (user_id, badge_id)
);
grant select on public.user_badges to authenticated;
grant all on public.user_badges to service_role;
alter table public.user_badges enable row level security;
create policy "user badges read" on public.user_badges for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'manager'));

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null, team_id uuid references public.teams(id),
  start_date date not null, end_date date not null,
  target_percent int not null default 100,
  metric text not null default 'on_time_inspection_rate'
);
grant select, insert, update, delete on public.challenges to authenticated;
grant all on public.challenges to service_role;
alter table public.challenges enable row level security;
create policy "challenges read" on public.challenges for select to authenticated using (true);
create policy "challenges manage" on public.challenges for all to authenticated using (public.has_role(auth.uid(),'manager')) with check (public.has_role(auth.uid(),'manager'));

-- signup trigger
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, team_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), (select id from public.teams order by name limit 1));
  insert into public.user_roles (user_id, role) values (new.id, 'employee');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- helpers
create or replace function public.riyadh_today() returns date language sql stable as $$ select (now() at time zone 'Asia/Riyadh')::date $$;

create or replace function public._on_time(t public.task_instances) returns boolean language sql stable as $$
  select t.submitted_at is not null and (t.submitted_at at time zone 'Asia/Riyadh')::date <= t.due_date
$$;

-- generation
create or replace function public._generate_tasks(p_month date) returns int language plpgsql security definer set search_path = public as $$
declare m_start date := date_trunc('month', p_month)::date; m_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date; n int := 0; c int; r record; d date;
begin
  for r in select * from public.task_templates where active loop
    if r.recurrence = 'weekly' then
      for d in select g::date from generate_series(m_start, m_end, interval '1 day') g where extract(isodow from g) = least(greatest(r.due_day,1),7) loop
        insert into public.task_instances (template_id, assignee_id, building_id, due_date) values (r.id, r.default_assignee_id, r.building_id, d) on conflict (template_id, due_date) do nothing;
        get diagnostics c = row_count; n := n + c;
      end loop;
    elsif r.recurrence = 'monthly' or (r.recurrence = 'quarterly' and extract(month from m_start)::int in (1,4,7,10)) then
      d := m_start + (least(r.due_day, extract(day from m_end)::int) - 1);
      insert into public.task_instances (template_id, assignee_id, building_id, due_date) values (r.id, r.default_assignee_id, r.building_id, d) on conflict (template_id, due_date) do nothing;
      get diagnostics c = row_count; n := n + c;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public._generate_tasks(date) from public, anon, authenticated;

create or replace function public.generate_month_tasks(p_month date default null) returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'manager') then raise exception 'غير مصرح'; end if;
  return public._generate_tasks(coalesce(p_month, public.riyadh_today()));
end $$;

-- start task
create or replace function public.start_task(p_instance uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.task_instances set status = 'قيد التنفيذ' where id = p_instance and assignee_id = auth.uid() and status = 'لم تبدأ';
end $$;

-- submit
create or replace function public.submit_task(p_instance uuid, p_results jsonb, p_photos text[], p_notes text, p_same_day boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare t public.task_instances; tpl public.task_templates; item text; v text; findings int := 0; sid uuid;
begin
  select * into t from public.task_instances where id = p_instance for update;
  if t.id is null or t.assignee_id is distinct from auth.uid() then raise exception 'غير مصرح'; end if;
  if t.status not in ('لم تبدأ','قيد التنفيذ','مرفوضة') then raise exception 'لا يمكن إرسال هذه المهمة الآن'; end if;
  select * into tpl from public.task_templates where id = t.template_id;
  for item in select jsonb_array_elements_text(tpl.checklist_items) loop
    v := p_results->item->>'result';
    if v is null or v not in ('ok','issue','na') then raise exception 'يجب تقييم جميع بنود القائمة'; end if;
    if v = 'issue' then findings := findings + 1; end if;
  end loop;
  if tpl.requires_photo and coalesce(array_length(p_photos,1),0) = 0 then raise exception 'يجب إرفاق صورة واحدة على الأقل'; end if;
  if exists (select 1 from unnest(coalesce(p_photos,'{}')) p where p not like auth.uid()::text || '/%') then raise exception 'مسار صورة غير صالح'; end if;
  insert into public.submissions (task_instance_id, checklist_results, photos, findings_count, notes)
  values (p_instance, p_results, coalesce(p_photos,'{}'), findings, p_notes) returning id into sid;
  update public.task_instances set status = 'بانتظار الاعتماد', submitted_at = now(), report_submitted_same_day = coalesce(p_same_day,false), rejection_reason = null where id = p_instance;
  return sid;
end $$;

-- points
create or replace function public._award_points(p_instance uuid) returns int language plpgsql security definer set search_path = public as $$
declare t public.task_instances; s public.submissions; total int := 0;
begin
  select * into t from public.task_instances where id = p_instance;
  select * into s from public.submissions where task_instance_id = p_instance order by created_at desc limit 1;
  delete from public.points_ledger where task_instance_id = p_instance;
  if public._on_time(t) then
    insert into public.points_ledger (user_id, task_instance_id, points, reason, created_at) values (t.assignee_id, p_instance, 10, 'إنجاز في الموعد', coalesce(t.approved_at, now()));
    total := total + 10;
  else
    insert into public.points_ledger (user_id, task_instance_id, points, reason, created_at) values (t.assignee_id, p_instance, 0, 'إنجاز متأخر ' || greatest(((t.submitted_at at time zone 'Asia/Riyadh')::date - t.due_date),0) || ' يوم', coalesce(t.approved_at, now()));
  end if;
  if t.report_submitted_same_day then
    insert into public.points_ledger (user_id, task_instance_id, points, reason, created_at) values (t.assignee_id, p_instance, 5, 'رفع التقرير في نفس اليوم', coalesce(t.approved_at, now()));
    total := total + 5;
  end if;
  if s.findings_count > 0 and coalesce(array_length(s.photos,1),0) > 0 then
    insert into public.points_ledger (user_id, task_instance_id, points, reason, created_at) values (t.assignee_id, p_instance, 3, 'توثيق ملاحظة بالصور', coalesce(t.approved_at, now()));
    total := total + 3;
  end if;
  return total;
end $$;
revoke execute on function public._award_points(uuid) from public, anon, authenticated;

create or replace function public._give_badge(p_user uuid, p_code text) returns void language sql security definer set search_path = public as $$
  insert into public.user_badges (user_id, badge_id) select p_user, id from public.badges where code = p_code on conflict do nothing
$$;
revoke execute on function public._give_badge(uuid, text) from public, anon, authenticated;

create or replace function public._award_badges(p_instance uuid) returns void language plpgsql security definer set search_path = public as $$
declare t public.task_instances; u uuid; ok boolean := true; i int; m date; cnt int; bad int;
begin
  select * into t from public.task_instances where id = p_instance;
  u := t.assignee_id;
  if u is null then return; end if;
  perform public._give_badge(u, 'first_round');
  if (select coalesce(sum(s.findings_count),0) from public.submissions s join public.task_instances ti on ti.id = s.task_instance_id
      where ti.assignee_id = u and ti.status = 'معتمدة' and coalesce(array_length(s.photos,1),0) > 0
      and s.id = (select s2.id from public.submissions s2 where s2.task_instance_id = ti.id order by s2.created_at desc limit 1)) >= 10 then
    perform public._give_badge(u, 'safety_eye');
  end if;
  for i in 0..2 loop
    m := (date_trunc('month', t.due_date) - make_interval(months => i))::date;
    select count(*), count(*) filter (where not (ti.status = 'معتمدة' and public._on_time(ti))) into cnt, bad
      from public.task_instances ti where ti.assignee_id = u and date_trunc('month', ti.due_date) = m;
    if cnt = 0 or bad > 0 then ok := false; end if;
  end loop;
  if ok then perform public._give_badge(u, 'streak_3'); end if;
  select count(*), count(*) filter (where not (ti.status = 'معتمدة' and public._on_time(ti))) into cnt, bad
    from public.task_instances ti where ti.building_id = t.building_id and date_trunc('month', ti.due_date) = date_trunc('month', t.due_date);
  if cnt > 0 and bad = 0 then
    insert into public.user_badges (user_id, badge_id)
    select distinct ti.assignee_id, b.id from public.task_instances ti, public.badges b
    where b.code = 'building_no_delay' and ti.building_id = t.building_id and ti.assignee_id is not null
      and date_trunc('month', ti.due_date) = date_trunc('month', t.due_date)
    on conflict do nothing;
  end if;
end $$;
revoke execute on function public._award_badges(uuid) from public, anon, authenticated;

create or replace function public.approve_submission(p_instance uuid) returns int language plpgsql security definer set search_path = public as $$
declare pts int;
begin
  if not public.has_role(auth.uid(),'manager') then raise exception 'غير مصرح'; end if;
  update public.task_instances set status = 'معتمدة', approved_by = auth.uid(), approved_at = now()
  where id = p_instance and status = 'بانتظار الاعتماد';
  if not found then raise exception 'المهمة ليست بانتظار الاعتماد'; end if;
  pts := public._award_points(p_instance);
  perform public._award_badges(p_instance);
  return pts;
end $$;

create or replace function public.reject_submission(p_instance uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'manager') then raise exception 'غير مصرح'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'سبب الرفض مطلوب'; end if;
  update public.task_instances set status = 'مرفوضة', rejection_reason = p_reason, approved_by = auth.uid(), approved_at = null
  where id = p_instance and status = 'بانتظار الاعتماد';
  if not found then raise exception 'المهمة ليست بانتظار الاعتماد'; end if;
end $$;

-- public aggregates (no individual data)
create or replace function public.building_leaderboard(p_month date) returns table (building_id uuid, code text, name text, assigned int, completed int, on_time int, findings int, on_time_rate numeric)
language sql stable security definer set search_path = public as $$
  select b.id, b.code, b.name,
    count(t.id)::int,
    count(t.id) filter (where t.status = 'معتمدة')::int,
    count(t.id) filter (where t.status = 'معتمدة' and public._on_time(t))::int,
    coalesce(sum((select s.findings_count from public.submissions s where s.task_instance_id = t.id order by s.created_at desc limit 1)) filter (where t.status = 'معتمدة'),0)::int,
    case when count(t.id) = 0 then 0 else round(100.0 * count(t.id) filter (where t.status = 'معتمدة' and public._on_time(t)) / count(t.id), 1) end
  from public.buildings b
  left join public.task_instances t on t.building_id = b.id and date_trunc('month', t.due_date) = date_trunc('month', p_month)
  where auth.uid() is not null
  group by b.id order by 8 desc, 7 desc, b.code
$$;

create or replace function public.challenge_progress(p_challenge uuid) returns table (assigned int, on_time int, rate numeric)
language sql stable security definer set search_path = public as $$
  select count(t.id)::int, count(t.id) filter (where t.status = 'معتمدة' and public._on_time(t))::int,
    case when count(t.id) = 0 then 0 else round(100.0 * count(t.id) filter (where t.status = 'معتمدة' and public._on_time(t)) / count(t.id), 1) end
  from public.challenges c
  join public.buildings b on (c.team_id is null or b.team_id = c.team_id)
  join public.task_instances t on t.building_id = b.id and t.due_date between c.start_date and least(c.end_date, public.riyadh_today())
  where c.id = p_challenge and auth.uid() is not null
$$;

revoke execute on function public.generate_month_tasks(date), public.start_task(uuid), public.submit_task(uuid, jsonb, text[], text, boolean), public.approve_submission(uuid), public.reject_submission(uuid, text), public.building_leaderboard(date), public.challenge_progress(uuid) from anon;
