
-- ========== people & helpers ==========
alter table public.profiles add column if not exists email text, add column if not exists is_active boolean not null default true;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;
grant insert on public.profiles to service_role;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, team_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email,
          coalesce((new.raw_user_meta_data->>'team_id')::uuid, (select id from public.teams order by name limit 1)))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'employee')) on conflict do nothing;
  return new;
end $$;

create or replace function public.my_team() returns uuid language sql stable security definer set search_path = public as $$ select team_id from public.profiles where id = auth.uid() $$;
create or replace function public.user_team(_u uuid) returns uuid language sql stable security definer set search_path = public as $$ select team_id from public.profiles where id = _u $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select public.has_role(auth.uid(),'admin') $$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$ select public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager') $$;
create or replace function public.is_manager_of(_team uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'admin') or (public.has_role(auth.uid(),'manager') and _team is not null and _team = public.my_team())
$$;

drop policy if exists "own profile read" on public.profiles;
drop policy if exists "manager update profiles" on public.profiles;
create policy "profiles directory" on public.profiles for select to authenticated using (true);
create policy "admin updates profiles" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "own roles read" on public.user_roles;
grant insert, update, delete on public.user_roles to authenticated;
create policy "roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy "admin manages roles" on public.user_roles for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant insert, update, delete on public.teams to authenticated;
create policy "admin manages teams" on public.teams for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- working days (Sunday-Thursday)
create or replace function public.is_workday(d date) returns boolean language sql immutable as $$ select extract(dow from d)::int not in (5,6) $$;
create or replace function public.add_workdays(d date, n int) returns date language plpgsql immutable as $$
declare r date := d; c int := 0; step int := case when n >= 0 then 1 else -1 end;
begin
  while c < abs(n) loop r := r + step; if public.is_workday(r) then c := c + 1; end if; end loop;
  return r;
end $$;
-- number of workdays after a up to and including b (0 if b <= a)
create or replace function public.workdays_between(a date, b date) returns int language sql immutable as $$
  select count(*)::int from generate_series(a + 1, b, interval '1 day') g where b > a and public.is_workday(g::date)
$$;

-- settings
create table public.app_settings (id int primary key default 1 check (id = 1), settings jsonb not null);
grant select, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "settings read" on public.app_settings for select to authenticated using (true);
create policy "settings admin" on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
insert into public.app_settings (id, settings) values (1, '{"days_before":[3,1],"due_day_reminder":true,"overdue_repeat_days":3,"escalate_after_days":5,"severity_days":{"حرجة":1,"عالية":3,"متوسطة":7,"منخفضة":30},"daily_run":"07:00","weekly_digest":"الأحد 08:00"}');

create or replace function public.setting(_k text) returns jsonb language sql stable security definer set search_path = public as $$ select settings->_k from public.app_settings where id = 1 $$;

-- ========== audit ==========
create table public.audit_log (
  id bigint generated always as identity primary key,
  entity_type text not null, entity_id uuid not null, team_id uuid,
  field text not null, old_value text, new_value text,
  changed_by uuid, changed_at timestamptz not null default now()
);
create index on public.audit_log (entity_type, entity_id);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;

-- ========== tasks ==========
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id),
  title text not null check (char_length(title) between 1 and 200),
  description text,
  owner_id uuid not null references public.profiles(id),
  start_date date,
  due_date date not null,
  status text not null default 'لم تبدأ' check (status in ('لم تبدأ','قيد التنفيذ','بانتظار جهة خارجية','مكتملة','ملغاة')),
  priority text not null default 'عادية' check (priority in ('عادية','عالية','عاجلة')),
  suggested_class text, final_class text,
  class_overridden_by uuid, class_overridden_at timestamptz,
  project_id uuid, phase_id uuid, goal_id uuid, inspection_id uuid, finding_id uuid,
  logged_after_due boolean not null default false,
  started_at timestamptz, completed_at timestamptz,
  delay_reason text check (delay_reason is null or delay_reason in ('بانتظار جهة خارجية','بانتظار معلومات أو اعتماد','تعارض أولويات','ضغط عمل','تغيّر النطاق','أخرى')),
  delay_note text, cancel_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tasks (owner_id, status);
create index on public.tasks (team_id, due_date);
grant select, insert, update on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;

create table public.task_contributors (task_id uuid not null references public.tasks(id) on delete cascade, user_id uuid not null references public.profiles(id), primary key (task_id, user_id));
grant select, insert, delete on public.task_contributors to authenticated;
grant all on public.task_contributors to service_role;
alter table public.task_contributors enable row level security;

create or replace function public.is_contributor(_task uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.task_contributors where task_id = _task and user_id = auth.uid())
$$;
create or replace function public.can_see_task(_task uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tasks t where t.id = _task and (t.owner_id = auth.uid() or public.is_manager_of(t.team_id)))
      or public.is_contributor(_task)
$$;

create policy "tasks read" on public.tasks for select to authenticated using (owner_id = auth.uid() or public.is_manager_of(team_id) or public.is_contributor(id));
create policy "tasks create" on public.tasks for insert to authenticated with check (public.is_manager_of(team_id) or (owner_id = auth.uid() and team_id = public.my_team()));
create policy "tasks update" on public.tasks for update to authenticated using (owner_id = auth.uid() or public.is_manager_of(team_id) or public.is_contributor(id));

create policy "contributors read" on public.task_contributors for select to authenticated using (public.can_see_task(task_id));
create policy "contributors manage" on public.task_contributors for insert to authenticated with check (public.is_manager_of((select team_id from public.tasks where id = task_id)) or exists (select 1 from public.tasks where id = task_id and owner_id = auth.uid()));
create policy "contributors remove" on public.task_contributors for delete to authenticated using (public.is_manager_of((select team_id from public.tasks where id = task_id)) or exists (select 1 from public.tasks where id = task_id and owner_id = auth.uid()));

create table public.task_comments (id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete cascade, author_id uuid not null default auth.uid(), body text not null check (char_length(body) between 1 and 4000), created_at timestamptz not null default now());
grant select, insert on public.task_comments to authenticated;
grant all on public.task_comments to service_role;
alter table public.task_comments enable row level security;
create policy "comments read" on public.task_comments for select to authenticated using (public.can_see_task(task_id));
create policy "comments add" on public.task_comments for insert to authenticated with check (author_id = auth.uid() and public.can_see_task(task_id));

create table public.task_attachments (id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete cascade, path text not null, name text not null, uploaded_by uuid not null default auth.uid(), created_at timestamptz not null default now());
grant select, insert on public.task_attachments to authenticated;
grant all on public.task_attachments to service_role;
alter table public.task_attachments enable row level security;
create policy "attachments read" on public.task_attachments for select to authenticated using (public.can_see_task(task_id));
create policy "attachments add" on public.task_attachments for insert to authenticated with check (uploaded_by = auth.uid() and public.can_see_task(task_id));

create table public.task_steps (id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete cascade, order_no int not null default 0, title text not null, is_done boolean not null default false, done_at timestamptz);
grant select, insert, update, delete on public.task_steps to authenticated;
grant all on public.task_steps to service_role;
alter table public.task_steps enable row level security;
create policy "steps all" on public.task_steps for all to authenticated using (public.can_see_task(task_id)) with check (public.can_see_task(task_id));

create table public.external_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  party_type text not null check (party_type in ('مشتريات','ترخيص','استشاري','مقاول','تحقيق','تدقيق','جهة داخلية أخرى','جهة خارجية أخرى')),
  party_name text not null, what_is_needed text not null,
  requested_on date not null default (now() at time zone 'Asia/Riyadh')::date,
  expected_by date,
  status text not null default 'مطلوب' check (status in ('مطلوب','تم الاستلام','ملغى')),
  received_on date, follow_up_owner_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.external_dependencies to authenticated;
grant all on public.external_dependencies to service_role;
alter table public.external_dependencies enable row level security;
create policy "deps read" on public.external_dependencies for select to authenticated using (public.can_see_task(task_id));
create policy "deps add" on public.external_dependencies for insert to authenticated with check (public.can_see_task(task_id));
create policy "deps update" on public.external_dependencies for update to authenticated using (public.can_see_task(task_id));

create policy "audit read" on public.audit_log for select to authenticated using (
  public.is_manager_of(team_id) or changed_by = auth.uid() or (entity_type = 'task' and public.can_see_task(entity_id)));

-- classification
create or replace function public.classify_task(_id uuid, _start date, _due date, _status text, _started timestamptz, _created timestamptz, _inspection uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when (_start is not null and _due - _start > 30) or (_status = 'قيد التنفيذ' and _started is not null and _started < now() - interval '60 days') then 'طويلة'
    when exists (select 1 from public.task_contributors where task_id = _id) or exists (select 1 from public.external_dependencies where task_id = _id and status <> 'ملغى') then 'معقدة'
    when _inspection is not null then 'روتينية'
    when _status = 'لم تبدأ' and _created < now() - interval '60 days' then 'عالقة'
    else 'قصيرة' end
$$;

create or replace function public.tasks_before() returns trigger language plpgsql security definer set search_path = public as $$
declare dep uuid; dep_status text;
begin
  if tg_op = 'INSERT' then
    new.logged_after_due := new.due_date < public.riyadh_today();
    new.created_by := coalesce(new.created_by, auth.uid());
  else
    -- employees cannot change owner, due date, team or class
    if auth.uid() is not null and not public.is_manager_of(old.team_id) then
      if new.owner_id is distinct from old.owner_id or new.due_date is distinct from old.due_date or new.team_id is distinct from old.team_id
         or new.final_class is distinct from old.final_class or new.class_overridden_by is distinct from old.class_overridden_by then
        raise exception 'لا تملك صلاحية تغيير المسؤول أو الموعد أو التصنيف. اطلب ذلك من مديرك.';
      end if;
    end if;
  end if;

  if new.status = 'قيد التنفيذ' and new.started_at is null then new.started_at := now(); end if;

  if new.status = 'مكتملة' and (tg_op = 'INSERT' or old.status is distinct from 'مكتملة') then
    new.completed_at := coalesce(new.completed_at, now());
    if new.inspection_id is null and (new.completed_at at time zone 'Asia/Riyadh')::date > new.due_date and coalesce(new.delay_reason,'') = '' then
      raise exception 'المهمة متأخرة عن موعدها، اختر سبب التأخير قبل الإنجاز.';
    end if;
    if new.delay_reason = 'أخرى' and coalesce(trim(new.delay_note),'') = '' then
      raise exception 'اكتب توضيحاً لسبب التأخير عند اختيار «أخرى».';
    end if;
  elsif new.status <> 'مكتملة' then
    new.completed_at := null;
  end if;

  if new.status = 'ملغاة' and coalesce(trim(new.cancel_reason),'') = '' then
    raise exception 'اكتب سبب الإلغاء.';
  end if;

  if tg_op = 'UPDATE' and new.status = 'بانتظار جهة خارجية' and old.status is distinct from new.status
     and not exists (select 1 from public.external_dependencies where task_id = new.id and status = 'مطلوب') then
    raise exception 'أضف جهة خارجية مطلوبة أولاً قبل تحويل الحالة إلى «بانتظار جهة خارجية».';
  end if;

  if new.phase_id is not null and new.status in ('قيد التنفيذ','مكتملة') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select depends_on_phase_id into dep from public.project_phases where id = new.phase_id;
    if dep is not null then
      select status into dep_status from public.project_phases where id = dep;
      if dep_status is distinct from 'مكتملة' then raise exception 'لا يمكن بدء هذه المرحلة قبل اكتمال المرحلة السابقة.'; end if;
    end if;
  end if;

  new.suggested_class := public.classify_task(new.id, new.start_date, new.due_date, new.status, new.started_at, new.created_at, new.inspection_id);
  if new.class_overridden_by is null then new.final_class := new.suggested_class; end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public._audit(_type text, _id uuid, _team uuid, _field text, _old text, _new text) returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (entity_type, entity_id, team_id, field, old_value, new_value, changed_by) values (_type, _id, _team, _field, _old, _new, auth.uid())
$$;

create or replace function public.tasks_after() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public._audit('task', new.id, new.team_id, 'created', null, new.title);
  else
    if new.status is distinct from old.status then perform public._audit('task', new.id, new.team_id, 'status', old.status, new.status); end if;
    if new.due_date is distinct from old.due_date then perform public._audit('task', new.id, new.team_id, 'due_date', old.due_date::text, new.due_date::text); end if;
    if new.owner_id is distinct from old.owner_id then perform public._audit('task', new.id, new.team_id, 'owner', (select full_name from public.profiles where id = old.owner_id), (select full_name from public.profiles where id = new.owner_id)); end if;
    if new.final_class is distinct from old.final_class then perform public._audit('task', new.id, new.team_id, 'class', old.final_class, new.final_class); end if;
    if new.cancel_reason is distinct from old.cancel_reason and new.cancel_reason is not null then perform public._audit('task', new.id, new.team_id, 'cancel_reason', old.cancel_reason, new.cancel_reason); end if;
  end if;
  if new.phase_id is not null and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    update public.project_phases set status = new.status, completed_at = new.completed_at where id = new.phase_id;
  end if;
  if new.finding_id is not null and tg_op = 'UPDATE' and new.status = 'قيد التنفيذ' and old.status = 'لم تبدأ' then
    update public.findings set status = 'قيد المعالجة' where id = new.finding_id and status = 'مفتوحة';
  end if;
  return new;
end $$;

create or replace function public.touch_task() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.tasks set updated_at = now() where id = coalesce(new.task_id, old.task_id);
  return coalesce(new, old);
end $$;
create trigger contributors_touch after insert or delete on public.task_contributors for each row execute function public.touch_task();
create trigger deps_touch after insert or update on public.external_dependencies for each row execute function public.touch_task();

-- ========== buildings & checklist ==========
alter table public.buildings
  add column if not exists address text, add column if not exists floors_count int,
  add column if not exists responsible_user_id uuid references public.profiles(id),
  add column if not exists has_kitchen boolean not null default false, add column if not exists has_parking boolean not null default false,
  add column if not exists has_generator boolean not null default false, add column if not exists has_elevators boolean not null default false,
  add column if not exists has_aed boolean not null default false, add column if not exists has_fire_pump_room boolean not null default false,
  add column if not exists has_chemical_storage boolean not null default false, add column if not exists has_smoking_area boolean not null default false,
  add column if not exists has_contractor_works boolean not null default false;
drop policy if exists "buildings manage" on public.buildings;
create policy "buildings manage" on public.buildings for all to authenticated using (public.is_manager_of(team_id)) with check (public.is_manager_of(team_id));
create or replace function public.building_team(_b uuid) returns uuid language sql stable security definer set search_path = public as $$ select team_id from public.buildings where id = _b $$;

create table public.checklist_sections (id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, order_no int not null);
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(), section_id uuid not null references public.checklist_sections(id),
  code text not null unique, text text not null, order_no int not null default 0,
  applies_if text check (applies_if is null or applies_if in ('has_kitchen','has_parking','has_generator','has_elevators','has_aed','has_fire_pump_room','has_chemical_storage','has_smoking_area','has_contractor_works')),
  default_severity text not null check (default_severity in ('منخفضة','متوسطة','عالية','حرجة')),
  photo_required_on_issue boolean not null default true, active boolean not null default true
);
grant select, insert, update on public.checklist_sections, public.checklist_items to authenticated;
grant all on public.checklist_sections, public.checklist_items to service_role;
alter table public.checklist_sections enable row level security;
alter table public.checklist_items enable row level security;
create policy "sections read" on public.checklist_sections for select to authenticated using (true);
create policy "sections admin" on public.checklist_sections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "items read" on public.checklist_items for select to authenticated using (true);
create policy "items admin" on public.checklist_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.inspection_templates (
  id uuid primary key default gen_random_uuid(), team_id uuid references public.teams(id), name text not null,
  recurrence text not null check (recurrence in ('weekly','monthly','quarterly')), due_day int not null default 25,
  section_codes text[] not null, item_codes text[], active boolean not null default true
);
grant select, insert, update on public.inspection_templates to authenticated;
grant all on public.inspection_templates to service_role;
alter table public.inspection_templates enable row level security;
create policy "itpl read" on public.inspection_templates for select to authenticated using (true);
create policy "itpl manage" on public.inspection_templates for all to authenticated using (public.is_manager_of(team_id)) with check (public.is_manager_of(team_id));

create table public.building_inspection_plans (
  id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id),
  template_id uuid not null references public.inspection_templates(id), assignee_id uuid not null references public.profiles(id),
  active boolean not null default true, unique (building_id, template_id)
);
grant select, insert, update on public.building_inspection_plans to authenticated;
grant all on public.building_inspection_plans to service_role;
alter table public.building_inspection_plans enable row level security;
create policy "plans read" on public.building_inspection_plans for select to authenticated using (assignee_id = auth.uid() or public.is_manager_of(public.building_team(building_id)));
create policy "plans manage" on public.building_inspection_plans for all to authenticated using (public.is_manager_of(public.building_team(building_id))) with check (public.is_manager_of(public.building_team(building_id)));

create table public.inspections (
  id uuid primary key default gen_random_uuid(), plan_id uuid references public.building_inspection_plans(id),
  building_id uuid not null references public.buildings(id), template_id uuid not null references public.inspection_templates(id),
  assignee_id uuid references public.profiles(id), task_id uuid references public.tasks(id),
  due_date date not null, started_at timestamptz, submitted_at timestamptz,
  status text not null default 'لم تبدأ' check (status in ('لم تبدأ','قيد التنفيذ','بانتظار الاعتماد','معتمدة','مرفوضة')),
  report_same_day boolean not null default false, reviewed_by uuid, reviewed_at timestamptz, rejection_reason text,
  compliance_percent numeric(5,1), created_at timestamptz not null default now(),
  unique (plan_id, due_date)
);
create index on public.inspections (assignee_id, due_date);
create index on public.inspections (building_id, due_date);
grant select, update on public.inspections to authenticated;
grant all on public.inspections to service_role;
alter table public.inspections enable row level security;
create policy "insp read" on public.inspections for select to authenticated using (assignee_id = auth.uid() or public.is_manager_of(public.building_team(building_id)));
create policy "insp manager update" on public.inspections for update to authenticated using (public.is_manager_of(public.building_team(building_id)));
create or replace function public.can_see_inspection(_i uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.inspections where id = _i and (assignee_id = auth.uid() or public.is_manager_of(public.building_team(building_id))))
$$;

create table public.inspection_answers (
  id uuid primary key default gen_random_uuid(), inspection_id uuid not null references public.inspections(id),
  item_id uuid not null references public.checklist_items(id),
  result text not null check (result in ('مطابق','غير مطابق','لا ينطبق')),
  severity text check (severity is null or severity in ('منخفضة','متوسطة','عالية','حرجة')),
  note text, photo_paths text[] not null default '{}', floor_or_area text,
  unique (inspection_id, item_id)
);
grant select on public.inspection_answers to authenticated;
grant all on public.inspection_answers to service_role;
alter table public.inspection_answers enable row level security;
create policy "answers read" on public.inspection_answers for select to authenticated using (public.can_see_inspection(inspection_id));

create table public.findings (
  id uuid primary key default gen_random_uuid(), inspection_id uuid references public.inspections(id),
  building_id uuid not null references public.buildings(id), item_id uuid references public.checklist_items(id),
  severity text not null check (severity in ('منخفضة','متوسطة','عالية','حرجة')),
  floor_or_area text, description text, photo_paths text[] not null default '{}',
  status text not null default 'مفتوحة' check (status in ('مفتوحة','قيد المعالجة','بانتظار التحقق','مغلقة')),
  corrective_task_id uuid references public.tasks(id), closed_at timestamptz, closure_note text,
  closure_photo_paths text[] not null default '{}', verified_by uuid, verify_rejection text,
  inspector_id uuid, created_at timestamptz not null default now()
);
create index on public.findings (building_id, status);
grant select, update on public.findings to authenticated;
grant all on public.findings to service_role;
alter table public.findings enable row level security;
create or replace function public.can_see_finding(_f uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.findings f left join public.tasks t on t.id = f.corrective_task_id
    where f.id = _f and (f.inspector_id = auth.uid() or t.owner_id = auth.uid() or public.is_manager_of(public.building_team(f.building_id))))
$$;
create policy "findings read" on public.findings for select to authenticated using (public.can_see_finding(id));
create policy "findings manager update" on public.findings for update to authenticated using (public.is_manager_of(public.building_team(building_id)));

create table public.finding_reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid not null default auth.uid(),
  building_id uuid not null references public.buildings(id), floor_or_area text, description text not null,
  severity text not null check (severity in ('منخفضة','متوسطة','عالية','حرجة')), photo_paths text[] not null default '{}',
  status text not null default 'بانتظار المراجعة' check (status in ('بانتظار المراجعة','حُوّلت','رُفضت')),
  dismiss_reason text, finding_id uuid references public.findings(id), created_at timestamptz not null default now()
);
grant select, insert on public.finding_reports to authenticated;
grant all on public.finding_reports to service_role;
alter table public.finding_reports enable row level security;
create policy "reports read" on public.finding_reports for select to authenticated using (reporter_id = auth.uid() or public.is_manager_of(public.building_team(building_id)));
create policy "reports add" on public.finding_reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'بانتظار المراجعة');

-- ========== gamification adjustments ==========
alter table public.points_ledger add column if not exists source_type text, add column if not exists source_id uuid;
drop policy if exists "points read" on public.points_ledger;
create policy "points read" on public.points_ledger for select to authenticated using (user_id = auth.uid() or public.is_manager_of(public.user_team(user_id)));
drop policy if exists "user badges read" on public.user_badges;
create policy "user badges read" on public.user_badges for select to authenticated using (user_id = auth.uid() or public.is_manager_of(public.user_team(user_id)));
drop policy if exists "challenges manage" on public.challenges;
create policy "challenges manage" on public.challenges for all to authenticated using (public.is_manager_of(team_id) or public.is_admin()) with check (public.is_manager_of(team_id) or public.is_admin());
insert into public.badges (code, name, description, icon) values ('closer','مُغلِق','إغلاق ١٠ إجراءات تصحيحية في موعدها','CheckCheck') on conflict (code) do nothing;
update public.badges set description = 'توثيق ١٠ ملاحظات مدعومة بالصور' where code = 'safety_eye';
update public.badges set description = '٣ أشهر متتالية بكل الجولات معتمدة وبدون تأخير' where code = 'streak_3';
update public.badges set description = 'وصول مبناك إلى ١٠٠٪ جولات في الموعد خلال شهر' where code = 'building_no_delay';
update public.badges set description = 'أول جولة يتم اعتمادها لك' where code = 'first_round';

-- ========== notifications ==========
create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, type text not null,
  entity_type text, entity_id uuid, title text not null, body text, link text,
  created_at timestamptz not null default now(), read_at timestamptz, email_sent_at timestamptz,
  dedupe_key text not null unique
);
create index on public.notifications (user_id, created_at desc);
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.notification_preferences (user_id uuid primary key default auth.uid(), email_enabled boolean not null default true);
grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;
alter table public.notification_preferences enable row level security;
create policy "own prefs" on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public._notify(_user uuid, _type text, _etype text, _eid uuid, _title text, _body text, _link text, _key text) returns int
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if _user is null then return 0; end if;
  insert into public.notifications (user_id, type, entity_type, entity_id, title, body, link, dedupe_key)
  values (_user, _type, _etype, _eid, _title, _body, _link, _key) on conflict (dedupe_key) do nothing;
  get diagnostics c = row_count; return c;
end $$;

-- ========== projects ==========
create table public.projects (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id),
  title text not null check (char_length(title) between 1 and 200), description text,
  owner_id uuid not null references public.profiles(id), start_date date, due_date date not null,
  status text not null default 'لم تبدأ' check (status in ('لم تبدأ','قيد التنفيذ','بانتظار جهة خارجية','مكتملة','ملغاة')),
  goal_id uuid, source_task_id uuid references public.tasks(id), cancel_reason text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
create table public.project_phases (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  order_no int not null, title text not null, deliverable text not null, owner_id uuid not null references public.profiles(id),
  start_date date, due_date date not null, depends_on_phase_id uuid references public.project_phases(id),
  status text not null default 'لم تبدأ', completed_at timestamptz, task_id uuid references public.tasks(id)
);
create table public.phase_templates (id uuid primary key default gen_random_uuid(), name text not null, phases jsonb not null);
grant select, insert, update on public.projects to authenticated;
grant select on public.project_phases, public.phase_templates to authenticated;
grant insert, update on public.phase_templates to authenticated;
grant all on public.projects, public.project_phases, public.phase_templates to service_role;
alter table public.projects enable row level security;
alter table public.project_phases enable row level security;
alter table public.phase_templates enable row level security;
create or replace function public.can_see_project(_p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects p where p.id = _p and (p.owner_id = auth.uid() or public.is_manager_of(p.team_id)
    or exists (select 1 from public.project_phases ph where ph.project_id = p.id and ph.owner_id = auth.uid())))
$$;
create policy "projects read" on public.projects for select to authenticated using (public.can_see_project(id));
create policy "projects add" on public.projects for insert to authenticated with check (public.is_manager_of(team_id) or (owner_id = auth.uid() and team_id = public.my_team()));
create policy "projects update" on public.projects for update to authenticated using (owner_id = auth.uid() or public.is_manager_of(team_id));
create policy "phases read" on public.project_phases for select to authenticated using (public.can_see_project(project_id));
create policy "ptpl read" on public.phase_templates for select to authenticated using (true);
create policy "ptpl admin" on public.phase_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ========== goals ==========
create table public.annual_goals (
  id uuid primary key default gen_random_uuid(), year int not null, team_id uuid not null references public.teams(id),
  owner_id uuid not null references public.profiles(id), title text not null, description text,
  measure_type text not null check (measure_type in ('نسبة مئوية','عدد','مراحل')),
  baseline_value numeric not null default 0, target_value numeric not null default 100, unit text,
  weight numeric not null default 0, status text not null default 'نشط' check (status in ('نشط','مكتمل','ملغى')),
  cancel_reason text, created_at timestamptz not null default now()
);
create table public.goal_milestones (
  id uuid primary key default gen_random_uuid(), goal_id uuid not null references public.annual_goals(id),
  quarter int not null check (quarter between 1 and 4), title text not null, target_value numeric, due_date date,
  achieved_value numeric, status text not null default 'لم يتحقق' check (status in ('لم يتحقق','تحقق'))
);
create table public.goal_checkins (
  id uuid primary key default gen_random_uuid(), goal_id uuid not null references public.annual_goals(id),
  quarter int not null check (quarter between 1 and 4), current_value numeric not null,
  rag text not null check (rag in ('على المسار','معرّض للخطر','متعثر')), comment text,
  created_by uuid not null default auth.uid(), created_at timestamptz not null default now(),
  check (rag = 'على المسار' or coalesce(trim(comment),'') <> '')
);
grant select, insert, update on public.annual_goals, public.goal_milestones to authenticated;
grant select, insert on public.goal_checkins to authenticated;
grant all on public.annual_goals, public.goal_milestones, public.goal_checkins to service_role;
alter table public.annual_goals enable row level security;
alter table public.goal_milestones enable row level security;
alter table public.goal_checkins enable row level security;
create or replace function public.goal_access(_g uuid, _write boolean) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.annual_goals g where g.id = _g and
    (case when _write then g.owner_id = auth.uid() or public.is_manager_of(g.team_id) else g.team_id = public.my_team() or public.is_admin() end))
$$;
create policy "goals read" on public.annual_goals for select to authenticated using (team_id = public.my_team() or public.is_admin());
create policy "goals manage" on public.annual_goals for all to authenticated using (public.is_manager_of(team_id)) with check (public.is_manager_of(team_id));
create policy "ms read" on public.goal_milestones for select to authenticated using (public.goal_access(goal_id, false));
create policy "ms add" on public.goal_milestones for insert to authenticated with check (public.goal_access(goal_id, true));
create policy "ms update" on public.goal_milestones for update to authenticated using (public.goal_access(goal_id, true));
create policy "ci read" on public.goal_checkins for select to authenticated using (public.goal_access(goal_id, false));
create policy "ci add" on public.goal_checkins for insert to authenticated with check (created_by = auth.uid() and public.goal_access(goal_id, true));

-- ========== decisions ==========
create table public.decisions (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id),
  decision text not null check (decision in ('تنفيذ بموعد جديد','إسناد لموظف آخر','إلغاء')),
  new_due_date date, new_owner_id uuid references public.profiles(id), reason text,
  decided_by uuid not null default auth.uid(), decided_at timestamptz not null default now(),
  meeting_date date not null default (now() at time zone 'Asia/Riyadh')::date
);
grant select on public.decisions to authenticated;
grant all on public.decisions to service_role;
alter table public.decisions enable row level security;
create policy "decisions read" on public.decisions for select to authenticated using (public.is_manager_of((select team_id from public.tasks where id = task_id)));

-- task triggers (need project_phases + findings to exist)
create trigger tasks_before before insert or update on public.tasks for each row execute function public.tasks_before();
create trigger tasks_after after insert or update on public.tasks for each row execute function public.tasks_after();

-- findings / projects audit
create or replace function public.findings_audit() returns trigger language plpgsql security definer set search_path = public as $$
declare tm uuid := public.building_team(new.building_id);
begin
  if tg_op = 'INSERT' then perform public._audit('finding', new.id, tm, 'created', null, new.severity); return new; end if;
  if new.status is distinct from old.status then perform public._audit('finding', new.id, tm, 'status', old.status, new.status); end if;
  if new.severity is distinct from old.severity then perform public._audit('finding', new.id, tm, 'severity', old.severity, new.severity); end if;
  return new;
end $$;
create trigger findings_audit after insert or update on public.findings for each row execute function public.findings_audit();

create or replace function public.projects_audit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then perform public._audit('project', new.id, new.team_id, 'status', old.status, new.status); end if;
    if new.due_date is distinct from old.due_date then perform public._audit('project', new.id, new.team_id, 'due_date', old.due_date::text, new.due_date::text); end if;
    if new.owner_id is distinct from old.owner_id then perform public._audit('project', new.id, new.team_id, 'owner', old.owner_id::text, new.owner_id::text); end if;
    if new.status = 'ملغاة' and coalesce(trim(new.cancel_reason),'') = '' then raise exception 'اكتب سبب الإلغاء.'; end if;
  end if;
  return new;
end $$;
create trigger projects_audit before update on public.projects for each row execute function public.projects_audit();

-- storage: attachments + photo visibility
create or replace function public.can_see_task_text(_t text) returns boolean language plpgsql stable security definer set search_path = public as $$
begin return public.can_see_task(_t::uuid); exception when others then return false; end $$;
create or replace function public.photo_visible(_name text) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
    or exists (select 1 from public.findings f where (_name = any(f.photo_paths) or _name = any(f.closure_photo_paths)) and public.can_see_finding(f.id))
    or exists (select 1 from public.inspection_answers a where _name = any(a.photo_paths) and public.can_see_inspection(a.inspection_id))
$$;
drop policy if exists "read own or manager photos" on storage.objects;
create policy "read inspection photos" on storage.objects for select to authenticated
  using (bucket_id = 'inspection-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.photo_visible(name)));
