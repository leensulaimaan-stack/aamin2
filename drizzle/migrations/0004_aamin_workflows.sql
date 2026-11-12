-- Aamin: workflows on top of the core schema (0003)
-- * Jawlati is monthly only
-- * checklist library + monthly inspection plans
-- * inspection submit/approve, findings, corrective actions, hazard reports
-- * projects from long tasks, weekly decisions, notifications job
-- * membership hardening (self sign-ups get no role until an admin activates them)
-- All writes that clients cannot do directly go through SECURITY DEFINER functions.

-- ========== membership hardening ==========
create or replace function public.is_member() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles r where r.user_id = auth.uid())
     and coalesce((select p.is_active from public.profiles p where p.id = auth.uid()), false)
$$;

-- role and team only come from app metadata (set by the server when an admin invites); never from user metadata
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare r text := new.raw_app_meta_data->>'aamin_role'; tm uuid;
begin
  begin tm := (new.raw_app_meta_data->>'aamin_team')::uuid; exception when others then tm := null; end;
  insert into public.profiles (id, full_name, email, team_id)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)), new.email, tm)
  on conflict (id) do nothing;
  if r in ('employee','manager','admin') then
    insert into public.user_roles (user_id, role) values (new.id, r::public.app_role) on conflict do nothing;
  end if;
  return new;
end $$;

drop policy if exists "profiles directory" on public.profiles;
create policy "profiles directory" on public.profiles for select to authenticated using (id = auth.uid() or public.is_member());
drop policy if exists "buildings read" on public.buildings;
create policy "buildings read" on public.buildings for select to authenticated using (public.is_member());

-- ========== integrity: links between tasks, projects, goals, inspections, findings ==========
alter table public.tasks
  add constraint tasks_project_id_fkey foreign key (project_id) references public.projects(id) on delete set null,
  add constraint tasks_phase_id_fkey foreign key (phase_id) references public.project_phases(id) on delete set null,
  add constraint tasks_goal_id_fkey foreign key (goal_id) references public.annual_goals(id) on delete set null,
  add constraint tasks_inspection_id_fkey foreign key (inspection_id) references public.inspections(id) on delete set null,
  add constraint tasks_finding_id_fkey foreign key (finding_id) references public.findings(id) on delete set null;
alter table public.projects add constraint projects_goal_id_fkey foreign key (goal_id) references public.annual_goals(id) on delete set null;
create index if not exists tasks_project_idx on public.tasks (project_id);
create index if not exists tasks_goal_idx on public.tasks (goal_id);
create index if not exists tasks_finding_idx on public.tasks (finding_id);

-- ========== Jawlati is monthly only ==========
alter table public.inspection_templates drop constraint if exists inspection_templates_recurrence_check;
update public.inspection_templates set recurrence = 'monthly' where recurrence <> 'monthly';
alter table public.inspection_templates add constraint inspection_templates_recurrence_check check (recurrence = 'monthly');
alter table public.inspection_templates alter column recurrence set default 'monthly';

-- legacy first-version templates: monthly only and retired (history stays readable)
alter table public.task_templates drop constraint if exists task_templates_recurrence_check;
update public.task_templates set recurrence = 'monthly', active = false;
alter table public.task_templates add constraint task_templates_recurrence_check check (recurrence = 'monthly');

alter table public.findings add column if not exists closure_submitted_at timestamptz;
alter table public.findings add column if not exists report_id uuid;

-- ========== checklist library ==========
insert into public.checklist_sections (code, name, order_no) values
 ('A','الوقاية من الحريق والإطفاء',1),('B','مخارج الطوارئ والإخلاء',2),('C','السلامة الكهربائية والمرافق',3),
 ('D','سلامة المبنى والإنشاءات',4),('E','الصحة والنظافة وبيئة العمل',5),('F','الإسعافات الأولية والطوارئ الطبية',6),
 ('G','الأمن',7),('H','الموظفون والمقاولون',8),('I','المواد الخطرة والتخزين',9),('J','المواقف والمحيط الخارجي',10)
on conflict (code) do nothing;

insert into public.checklist_items (section_id, code, text, order_no, applies_if, default_severity)
select s.id, v.code, v.txt, v.ord, v.cond, v.sev
from (values
 ('A','A1','طفايات الحريق في أماكنها المحددة وظاهرة وغير معاقة',1,null,'عالية'),
 ('A','A2','مؤشر ضغط الطفاية في المنطقة الخضراء والختم سليم',2,null,'عالية'),
 ('A','A3','بطاقة الفحص الدوري للطفاية محدثة',3,null,'متوسطة'),
 ('A','A4','صناديق خراطيم الحريق سليمة ويسهل الوصول إليها',4,null,'عالية'),
 ('A','A5','لوحة إنذار الحريق تعمل ولا تظهر أعطالاً',5,null,'حرجة'),
 ('A','A6','كواشف الدخان ورؤوس الرشاشات غير مغطاة أو متضررة',6,null,'عالية'),
 ('A','A7','نقاط الإنذار اليدوية ظاهرة وغير معاقة',7,null,'عالية'),
 ('A','A8','الأبواب المقاومة للحريق تغلق ذاتياً وغير مسنودة بعوائق',8,null,'عالية'),
 ('A','A9','غرفة مضخات الحريق نظيفة والمضخات في وضع التشغيل الآلي',9,'has_fire_pump_room','حرجة'),
 ('B','B1','ممرات ومسارات الإخلاء خالية من العوائق',1,null,'حرجة'),
 ('B','B2','أبواب المخارج تفتح بسهولة وغير مقفلة أثناء الدوام',2,null,'حرجة'),
 ('B','B3','لوحات المخارج مضاءة وواضحة',3,null,'عالية'),
 ('B','B4','إنارة الطوارئ تعمل عند الاختبار',4,null,'عالية'),
 ('B','B5','مخطط الإخلاء معلّق ومحدث في كل طابق',5,null,'متوسطة'),
 ('B','B6','نقطة التجمع محددة بلوحة وواضحة',6,null,'متوسطة'),
 ('B','B7','الدرج خالٍ من التخزين والدرابزين ثابت',7,null,'عالية'),
 ('C','C1','لوحات التوزيع مغلقة ومُعلّمة وأمامها مساحة خالية',1,null,'عالية'),
 ('C','C2','لا توجد أسلاك مكشوفة أو مقابس متضررة',2,null,'عالية'),
 ('C','C3','لا توجد توصيلات كهربائية متعددة متسلسلة أو مثقلة',3,null,'متوسطة'),
 ('C','C4','غرف الكهرباء والاتصالات غير مستخدمة للتخزين ومقفلة',4,null,'عالية'),
 ('C','C5','المولد الاحتياطي نظيف وسجل تشغيله محدث ولا تسريب وقود',5,'has_generator','عالية'),
 ('C','C6','المصاعد بشهادة فحص سارية وهاتف الطوارئ يعمل',6,'has_elevators','عالية'),
 ('D','D1','لا توجد تشققات ظاهرة جديدة في الجدران أو الأسقف أو الأعمدة',1,null,'عالية'),
 ('D','D2','لا توجد تسربات مياه أو آثار رطوبة',2,null,'متوسطة'),
 ('D','D3','بلاطات الأسقف المستعارة سليمة وثابتة',3,null,'متوسطة'),
 ('D','D4','الأرضيات سليمة وغير زلقة ولا توجد أخطار تعثر',4,null,'متوسطة'),
 ('D','D5','الدرابزين والحواجز والسواتر ثابتة',5,null,'عالية'),
 ('D','D6','الزجاج والواجهات سليمة دون كسر',6,null,'عالية'),
 ('D','D7','الأسطح والمناور مقفلة والوصول إليها مضبوط',7,null,'متوسطة'),
 ('E','E1','النظافة العامة والترتيب في المكاتب والممرات',1,null,'منخفضة'),
 ('E','E2','دورات المياه نظيفة وتعمل ومزودة بالمستلزمات',2,null,'متوسطة'),
 ('E','E3','مياه الشرب متوفرة وبرادات المياه نظيفة',3,null,'متوسطة'),
 ('E','E4','التكييف والتهوية يعملان بشكل مناسب',4,null,'متوسطة'),
 ('E','E5','الإضاءة كافية في المكاتب والممرات',5,null,'منخفضة'),
 ('E','E6','الحاويات والنفايات تُفرّغ بانتظام ومحفوظة بشكل سليم',6,null,'منخفضة'),
 ('E','E7','سجل مكافحة الآفات محدث ولا توجد آثار آفات',7,null,'متوسطة'),
 ('E','E8','المطبخ نظيف والأغذية مخزنة بشكل سليم والأجهزة آمنة',8,'has_kitchen','متوسطة'),
 ('E','E9','منطقة التدخين محددة وبعيدة عن المداخل والمواد القابلة للاشتعال',9,'has_smoking_area','متوسطة'),
 ('F','F1','صندوق الإسعافات الأولية متوفر ومكتمل وغير منتهي الصلاحية',1,null,'عالية'),
 ('F','F2','قائمة المسعفين وأرقام الطوارئ معلّقة ومحدثة',2,null,'متوسطة'),
 ('F','F3','جهاز الصدمات الكهربائية (AED) جاهز والمؤشر سليم',3,'has_aed','حرجة'),
 ('G','G1','كاميرات المراقبة تعمل وتغطي المداخل',1,null,'متوسطة'),
 ('G','G2','التحكم في الدخول يعمل وسجل الزوار مستخدم',2,null,'متوسطة'),
 ('G','G3','حارس الأمن في موقعه ويعرف إجراءات الطوارئ',3,null,'متوسطة'),
 ('G','G4','الأقفال والأبواب الخارجية سليمة',4,null,'متوسطة'),
 ('G','G5','إنارة المحيط الخارجي والمداخل كافية',5,null,'منخفضة'),
 ('H','H1','فريق الطوارئ والمسعفون محددون لكل طابق',1,null,'متوسطة'),
 ('H','H2','سؤال عشوائي لموظفين: يعرفون نقطة التجمع وأقرب مخرج',2,null,'متوسطة'),
 ('H','H3','المقاولون يرتدون معدات الحماية الشخصية المناسبة',3,'has_contractor_works','عالية'),
 ('H','H4','تصاريح العمل متوفرة للأعمال الساخنة والعمل على المرتفعات',4,'has_contractor_works','حرجة'),
 ('H','H5','منطقة أعمال المقاولين معزولة ومُعلّمة',5,'has_contractor_works','عالية'),
 ('I','I1','المواد الكيميائية مخزنة ومُعلّمة ومعها صحائف بيانات السلامة (SDS)',1,'has_chemical_storage','عالية'),
 ('I','I2','التخزين المرتفع مستقر والمواد الثقيلة في الرفوف السفلية',2,null,'متوسطة'),
 ('I','I3','لا تخزين لمواد قابلة للاشتعال قرب مصادر حرارة أو كهرباء',3,null,'عالية'),
 ('J','J1','مسارات المشاة واضحة ومنفصلة عن مسار المركبات',1,'has_parking','متوسطة'),
 ('J','J2','لوحات السرعة والاتجاهات واضحة',2,'has_parking','منخفضة'),
 ('J','J3','لا توجد أخطار تعثر أو حفر في الساحات',3,'has_parking','متوسطة')
) as v(sec, code, txt, ord, cond, sev)
join public.checklist_sections s on s.code = v.sec
on conflict (code) do nothing;

-- ========== photo visibility (attachments + reports too) ==========
create or replace function public.photo_visible(_name text) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
    or exists (select 1 from public.findings f where (_name = any(f.photo_paths) or _name = any(f.closure_photo_paths)) and public.can_see_finding(f.id))
    or exists (select 1 from public.inspection_answers a where _name = any(a.photo_paths) and public.can_see_inspection(a.inspection_id))
    or exists (select 1 from public.task_attachments t where t.path = _name and public.can_see_task(t.task_id))
    or exists (select 1 from public.finding_reports r where _name = any(r.photo_paths) and r.reporter_id = auth.uid())
$$;

-- ========== helpers ==========
create or replace function public._team_managers(_team uuid) returns setof uuid language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p join public.user_roles r on r.user_id = p.id
  where p.is_active and ((r.role = 'manager' and p.team_id = _team) or r.role = 'admin')
$$;
revoke execute on function public._team_managers(uuid) from public, anon, authenticated;

create or replace function public._severity_due(_sev text, _from date) returns date language sql stable security definer set search_path = public as $$
  select public.add_workdays(_from, coalesce((public.setting('severity_days')->>_sev)::int, case _sev when 'حرجة' then 1 when 'عالية' then 3 when 'متوسطة' then 7 else 30 end))
$$;

create or replace function public._is_photo_path_ok(_paths text[], _user uuid) returns boolean language sql immutable as $$
  select not exists (select 1 from unnest(coalesce(_paths,'{}')) p where p not like _user::text || '/%')
$$;

-- items that apply to one inspection (template sections + building features)
create or replace function public.inspection_items(_inspection uuid)
returns table (item_id uuid, section_code text, section_name text, section_order int, code text, text text, item_order int, default_severity text, photo_required_on_issue boolean)
language sql stable security definer set search_path = public as $$
  select ci.id, cs.code, cs.name, cs.order_no, ci.code, ci.text, ci.order_no, ci.default_severity, ci.photo_required_on_issue
  from public.inspections i
  join public.inspection_templates t on t.id = i.template_id
  join public.buildings b on b.id = i.building_id
  join public.checklist_sections cs on cs.code = any(t.section_codes)
  join public.checklist_items ci on ci.section_id = cs.id and ci.active
  where i.id = _inspection and public.can_see_inspection(_inspection)
    and (t.item_codes is null or ci.code = any(t.item_codes))
    and (ci.applies_if is null or (to_jsonb(b) ->> ci.applies_if)::boolean)
  order by cs.order_no, ci.order_no
$$;

-- ========== monthly inspection generation ==========
create or replace function public._generate_inspections(p_month date) returns int language plpgsql security definer set search_path = public as $$
declare m_start date := date_trunc('month', p_month)::date; m_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  r record; d date; iid uuid; tid uuid; n int := 0;
begin
  for r in select pl.*, t.name as tpl_name, t.due_day, b.code as b_code, b.name as b_name, b.team_id as b_team
           from public.building_inspection_plans pl
           join public.inspection_templates t on t.id = pl.template_id and t.active
           join public.buildings b on b.id = pl.building_id
           where pl.active and b.team_id is not null loop
    d := m_start + (least(r.due_day, extract(day from m_end)::int) - 1);
    insert into public.inspections (plan_id, building_id, template_id, assignee_id, due_date)
    values (r.id, r.building_id, r.template_id, r.assignee_id, d)
    on conflict (plan_id, due_date) do nothing returning id into iid;
    if iid is not null then
      insert into public.tasks (team_id, title, owner_id, start_date, due_date, inspection_id, created_by)
      values (r.b_team, left('جولة شهرية: ' || r.tpl_name || ' — ' || r.b_code, 200), r.assignee_id, m_start, d, iid, null)
      returning id into tid;
      update public.inspections set task_id = tid where id = iid;
      n := n + 1;
    end if;
    iid := null;
  end loop;
  return n;
end $$;
revoke execute on function public._generate_inspections(date) from public, anon, authenticated;

create or replace function public.generate_inspections(p_month date default null) returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'غير مصرح'; end if;
  return public._generate_inspections(coalesce(p_month, public.riyadh_today()));
end $$;

-- ========== inspection workflow ==========
create or replace function public.start_inspection(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare i public.inspections;
begin
  select * into i from public.inspections where id = p_id;
  if i.id is null or i.assignee_id is distinct from auth.uid() then raise exception 'غير مصرح'; end if;
  if i.status = 'لم تبدأ' then
    update public.inspections set status = 'قيد التنفيذ', started_at = now() where id = p_id;
    update public.tasks set status = 'قيد التنفيذ' where id = i.task_id and status = 'لم تبدأ';
  end if;
end $$;

-- p_answers: [{item_id, result: مطابق|غير مطابق|لا ينطبق, severity, note, photo_paths[], floor_or_area}]
create or replace function public._submit_inspection(p_id uuid, p_user uuid, p_answers jsonb, p_same_day boolean, p_at timestamptz, p_check_photos boolean)
returns numeric language plpgsql security definer set search_path = public as $$
declare i public.inspections; it record; a jsonb; res text; sev text; photos text[]; ok int := 0; bad int := 0; comp numeric; b public.buildings; mgr uuid; nm text;
begin
  select * into i from public.inspections where id = p_id for update;
  if i.id is null or i.assignee_id is distinct from p_user then raise exception 'غير مصرح'; end if;
  if i.status not in ('لم تبدأ','قيد التنفيذ','مرفوضة') then raise exception 'لا يمكن إرسال هذه الجولة الآن'; end if;
  select * into b from public.buildings where id = i.building_id;
  delete from public.inspection_answers where inspection_id = p_id;
  for it in
    select ci.id, ci.text, ci.default_severity, ci.photo_required_on_issue
    from public.inspection_templates t
    join public.checklist_sections cs on cs.code = any(t.section_codes)
    join public.checklist_items ci on ci.section_id = cs.id and ci.active
    where t.id = i.template_id and (t.item_codes is null or ci.code = any(t.item_codes))
      and (ci.applies_if is null or (to_jsonb(b) ->> ci.applies_if)::boolean)
    order by cs.order_no, ci.order_no
  loop
    a := null;
    select x into a from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) x where x->>'item_id' = it.id::text limit 1;
    res := a->>'result';
    if res is null or res not in ('مطابق','غير مطابق','لا ينطبق') then raise exception 'أجب عن كل بنود الجولة قبل الإرسال (البند: %)', it.text; end if;
    photos := coalesce(array(select jsonb_array_elements_text(a->'photo_paths')), '{}');
    if p_check_photos and not public._is_photo_path_ok(photos, p_user) then raise exception 'مسار صورة غير صالح'; end if;
    sev := null;
    if res = 'غير مطابق' then
      bad := bad + 1;
      sev := coalesce(nullif(a->>'severity',''), it.default_severity);
      if sev not in ('منخفضة','متوسطة','عالية','حرجة') then raise exception 'درجة خطورة غير صالحة'; end if;
      if it.photo_required_on_issue and coalesce(array_length(photos,1),0) = 0 then raise exception 'أرفق صورة للبند غير المطابق: %', it.text; end if;
    elsif res = 'مطابق' then ok := ok + 1;
    end if;
    insert into public.inspection_answers (inspection_id, item_id, result, severity, note, photo_paths, floor_or_area)
    values (p_id, it.id, res, sev, nullif(trim(coalesce(a->>'note','')),''), photos, nullif(trim(coalesce(a->>'floor_or_area','')),''));
    if sev = 'حرجة' then
      for mgr in select public._team_managers(b.team_id) loop
        perform public._notify(mgr, 'critical', 'inspection', p_id, 'ملاحظة حرجة في ' || b.code, it.text, '/jawlati/inspection/' || p_id, 'critical:' || p_id || ':' || it.id || ':' || mgr);
      end loop;
    end if;
  end loop;
  comp := case when ok + bad = 0 then 100 else round(100.0 * ok / (ok + bad), 1) end;
  update public.inspections set status = 'بانتظار الاعتماد', submitted_at = p_at, report_same_day = coalesce(p_same_day,false),
    rejection_reason = null, compliance_percent = comp, started_at = coalesce(started_at, p_at) where id = p_id;
  select full_name into nm from public.profiles where id = p_user;
  for mgr in select public._team_managers(b.team_id) loop
    perform public._notify(mgr, 'approval', 'inspection', p_id, 'جولة بانتظار الاعتماد', coalesce(nm,'') || ' — ' || b.code, '/jawlati/approvals', 'approval:' || p_id || ':' || extract(epoch from p_at)::bigint || ':' || mgr);
  end loop;
  return comp;
end $$;
revoke execute on function public._submit_inspection(uuid, uuid, jsonb, boolean, timestamptz, boolean) from public, anon, authenticated;

create or replace function public.submit_inspection(p_id uuid, p_answers jsonb, p_same_day boolean) returns numeric language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'غير مصرح'; end if;
  return public._submit_inspection(p_id, auth.uid(), p_answers, p_same_day, now(), true);
end $$;

create or replace function public._create_finding(p_building uuid, p_inspection uuid, p_item uuid, p_sev text, p_area text, p_desc text, p_photos text[], p_inspector uuid, p_from date, p_report uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare b public.buildings; fid uuid; tid uuid; owner uuid; title text;
begin
  select * into b from public.buildings where id = p_building;
  owner := coalesce(b.responsible_user_id, p_inspector);
  insert into public.findings (inspection_id, building_id, item_id, severity, floor_or_area, description, photo_paths, inspector_id, report_id, created_at)
  values (p_inspection, p_building, p_item, p_sev, p_area, p_desc, coalesce(p_photos,'{}'), p_inspector, p_report,
          case when p_from < public.riyadh_today() then (p_from::timestamp + time '09:00') at time zone 'Asia/Riyadh' else now() end) returning id into fid;
  title := left('إجراء تصحيحي (' || b.code || '): ' || coalesce((select text from public.checklist_items where id = p_item), p_desc, 'ملاحظة'), 200);
  insert into public.tasks (team_id, title, description, owner_id, start_date, due_date, priority, finding_id, created_by)
  values (b.team_id, title, p_desc, owner, p_from, public._severity_due(p_sev, p_from),
          case p_sev when 'حرجة' then 'عاجلة' when 'عالية' then 'عالية' else 'عادية' end, fid, null)
  returning id into tid;
  update public.tasks set logged_after_due = false where id = tid;
  update public.findings set corrective_task_id = tid where id = fid;
  perform public._notify(owner, 'corrective', 'task', tid, 'إجراء تصحيحي مسند إليك (' || p_sev || ')', title, '/tasks/' || tid, 'corrective:' || tid);
  return fid;
end $$;
revoke execute on function public._create_finding(uuid, uuid, uuid, text, text, text, text[], uuid, date, uuid) from public, anon, authenticated;

create or replace function public._give_points(_user uuid, _stype text, _sid uuid, _pts int, _reason text, _at timestamptz) returns void language sql security definer set search_path = public as $$
  insert into public.points_ledger (user_id, source_type, source_id, points, reason, created_at) values (_user, _stype, _sid, _pts, _reason, _at)
$$;
revoke execute on function public._give_points(uuid, text, uuid, int, text, timestamptz) from public, anon, authenticated;

create or replace function public._inspection_badges(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare i public.inspections; k int; m date; cnt int; bad int; ok boolean := true;
begin
  select * into i from public.inspections where id = p_id;
  if i.assignee_id is null then return; end if;
  perform public._give_badge(i.assignee_id, 'first_round');
  if (select count(*) from public.findings f where f.inspector_id = i.assignee_id and coalesce(array_length(f.photo_paths,1),0) > 0) >= 10 then
    perform public._give_badge(i.assignee_id, 'safety_eye');
  end if;
  for k in 0..2 loop
    m := (date_trunc('month', i.due_date) - make_interval(months => k))::date;
    select count(*), count(*) filter (where not (x.status = 'معتمدة' and x.submitted_at is not null and (x.submitted_at at time zone 'Asia/Riyadh')::date <= x.due_date))
      into cnt, bad from public.inspections x where x.assignee_id = i.assignee_id and date_trunc('month', x.due_date) = m;
    if cnt = 0 or bad > 0 then ok := false; end if;
  end loop;
  if ok then perform public._give_badge(i.assignee_id, 'streak_3'); end if;
  select count(*), count(*) filter (where not (x.status = 'معتمدة' and x.submitted_at is not null and (x.submitted_at at time zone 'Asia/Riyadh')::date <= x.due_date))
    into cnt, bad from public.inspections x where x.building_id = i.building_id and date_trunc('month', x.due_date) = date_trunc('month', i.due_date);
  if cnt > 0 and bad = 0 then
    insert into public.user_badges (user_id, badge_id)
    select distinct x.assignee_id, bd.id from public.inspections x, public.badges bd
    where bd.code = 'building_no_delay' and x.building_id = i.building_id and x.assignee_id is not null and date_trunc('month', x.due_date) = date_trunc('month', i.due_date)
    on conflict do nothing;
  end if;
end $$;
revoke execute on function public._inspection_badges(uuid) from public, anon, authenticated;

create or replace function public._approve_inspection(p_id uuid, p_by uuid, p_at timestamptz) returns int language plpgsql security definer set search_path = public as $$
declare i public.inspections; a record; pts int := 0; on_time boolean; has_photo_finding boolean := false;
begin
  select * into i from public.inspections where id = p_id for update;
  if i.status <> 'بانتظار الاعتماد' then raise exception 'الجولة ليست بانتظار الاعتماد'; end if;
  update public.inspections set status = 'معتمدة', reviewed_by = p_by, reviewed_at = p_at where id = p_id;
  for a in select ans.*, ci.text as item_text from public.inspection_answers ans join public.checklist_items ci on ci.id = ans.item_id
           where ans.inspection_id = p_id and ans.result = 'غير مطابق' loop
    perform public._create_finding(i.building_id, p_id, a.item_id, a.severity, a.floor_or_area, coalesce(a.note, a.item_text), a.photo_paths, i.assignee_id, (p_at at time zone 'Asia/Riyadh')::date, null);
    if coalesce(array_length(a.photo_paths,1),0) > 0 then has_photo_finding := true; end if;
  end loop;
  update public.tasks set status = 'مكتملة', completed_at = i.submitted_at where id = i.task_id and status <> 'مكتملة';
  on_time := (i.submitted_at at time zone 'Asia/Riyadh')::date <= i.due_date;
  if on_time then perform public._give_points(i.assignee_id, 'inspection', p_id, 10, 'جولة في موعدها', p_at); pts := pts + 10;
  else perform public._give_points(i.assignee_id, 'inspection', p_id, 0, 'جولة متأخرة ' || ((i.submitted_at at time zone 'Asia/Riyadh')::date - i.due_date) || ' يوم', p_at); end if;
  if i.report_same_day then perform public._give_points(i.assignee_id, 'inspection', p_id, 5, 'رفع التقرير في نفس اليوم', p_at); pts := pts + 5; end if;
  if has_photo_finding then perform public._give_points(i.assignee_id, 'inspection', p_id, 3, 'توثيق ملاحظة بالصور', p_at); pts := pts + 3; end if;
  perform public._inspection_badges(p_id);
  perform public._notify(i.assignee_id, 'approved', 'inspection', p_id, 'تم اعتماد جولتك', '+' || pts || ' نقطة', '/jawlati', 'approved:' || p_id || ':' || extract(epoch from p_at)::bigint);
  return pts;
end $$;
revoke execute on function public._approve_inspection(uuid, uuid, timestamptz) from public, anon, authenticated;

create or replace function public.approve_inspection(p_id uuid) returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager_of(public.building_team((select building_id from public.inspections where id = p_id))) then raise exception 'غير مصرح'; end if;
  return public._approve_inspection(p_id, auth.uid(), now());
end $$;

create or replace function public.reject_inspection(p_id uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare i public.inspections;
begin
  select * into i from public.inspections where id = p_id;
  if not public.is_manager_of(public.building_team(i.building_id)) then raise exception 'غير مصرح'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'اكتب سبب الرفض'; end if;
  update public.inspections set status = 'مرفوضة', rejection_reason = p_reason, reviewed_by = auth.uid(), reviewed_at = now() where id = p_id and status = 'بانتظار الاعتماد';
  if not found then raise exception 'الجولة ليست بانتظار الاعتماد'; end if;
  perform public._notify(i.assignee_id, 'rejected', 'inspection', p_id, 'أُعيدت جولتك للتعديل', p_reason, '/jawlati/inspection/' || p_id, 'rejected:' || p_id || ':' || extract(epoch from now())::bigint);
end $$;

-- ========== findings: closure and verification ==========
create or replace function public.close_finding(p_id uuid, p_note text, p_photos text[], p_delay_reason text default null, p_delay_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare f public.findings; t public.tasks; mgr uuid; b public.buildings;
begin
  select * into f from public.findings where id = p_id for update;
  select * into t from public.tasks where id = f.corrective_task_id;
  if f.id is null or not (t.owner_id = auth.uid() or public.is_manager_of(public.building_team(f.building_id))) then raise exception 'غير مصرح'; end if;
  if f.status not in ('مفتوحة','قيد المعالجة') then raise exception 'الملاحظة ليست مفتوحة'; end if;
  if coalesce(trim(p_note),'') = '' then raise exception 'اكتب ما تم لمعالجة الملاحظة'; end if;
  if coalesce(array_length(p_photos,1),0) = 0 then raise exception 'أرفق صورة بعد المعالجة'; end if;
  if not public._is_photo_path_ok(p_photos, auth.uid()) then raise exception 'مسار صورة غير صالح'; end if;
  if public.riyadh_today() > t.due_date and coalesce(p_delay_reason,'') = '' then raise exception 'الإجراء متأخر عن موعده، اختر سبب التأخير.'; end if;
  update public.findings set status = 'بانتظار التحقق', closure_note = p_note, closure_photo_paths = p_photos, closure_submitted_at = now(), verify_rejection = null where id = p_id;
  update public.tasks set status = 'قيد التنفيذ', delay_reason = coalesce(p_delay_reason, delay_reason), delay_note = coalesce(p_delay_note, delay_note) where id = t.id and status = 'لم تبدأ';
  update public.tasks set delay_reason = coalesce(p_delay_reason, delay_reason), delay_note = coalesce(p_delay_note, delay_note) where id = t.id;
  select * into b from public.buildings where id = f.building_id;
  for mgr in select public._team_managers(b.team_id) loop
    perform public._notify(mgr, 'verify', 'finding', p_id, 'إجراء تصحيحي بانتظار التحقق', b.code || ' — ' || t.title, '/jawlati/findings', 'verify:' || p_id || ':' || extract(epoch from now())::bigint || ':' || mgr);
  end loop;
end $$;

create or replace function public._verify_finding(p_id uuid, p_by uuid, p_accept boolean, p_reason text, p_at timestamptz) returns void language plpgsql security definer set search_path = public as $$
declare f public.findings; t public.tasks; on_time boolean; n int;
begin
  select * into f from public.findings where id = p_id for update;
  if f.status <> 'بانتظار التحقق' then raise exception 'الملاحظة ليست بانتظار التحقق'; end if;
  select * into t from public.tasks where id = f.corrective_task_id;
  if p_accept then
    update public.findings set status = 'مغلقة', closed_at = p_at, verified_by = p_by where id = p_id;
    on_time := (f.closure_submitted_at at time zone 'Asia/Riyadh')::date <= t.due_date;
    update public.tasks set status = 'مكتملة', completed_at = f.closure_submitted_at,
      delay_reason = case when on_time then delay_reason else coalesce(delay_reason, 'أخرى') end,
      delay_note = case when on_time or delay_reason is not null then delay_note else coalesce(delay_note, 'لم يُذكر سبب') end
    where id = t.id and status <> 'مكتملة';
    if on_time then
      perform public._give_points(t.owner_id, 'finding', p_id, 5, 'إغلاق إجراء تصحيحي في موعده', p_at);
      select count(*) into n from public.findings x join public.tasks y on y.id = x.corrective_task_id
        where y.owner_id = t.owner_id and x.status = 'مغلقة' and (x.closure_submitted_at at time zone 'Asia/Riyadh')::date <= y.due_date;
      if n >= 10 then perform public._give_badge(t.owner_id, 'closer'); end if;
    end if;
    perform public._notify(t.owner_id, 'verified', 'finding', p_id, 'تم التحقق من إغلاق الملاحظة', t.title, '/tasks/' || t.id, 'verified:' || p_id);
  else
    if coalesce(trim(p_reason),'') = '' then raise exception 'اكتب سبب رفض الإغلاق'; end if;
    update public.findings set status = 'قيد المعالجة', verify_rejection = p_reason where id = p_id;
    perform public._notify(t.owner_id, 'reopened', 'finding', p_id, 'أُعيدت الملاحظة للمعالجة', p_reason, '/tasks/' || t.id, 'reopen:' || p_id || ':' || extract(epoch from p_at)::bigint);
  end if;
end $$;
revoke execute on function public._verify_finding(uuid, uuid, boolean, text, timestamptz) from public, anon, authenticated;

create or replace function public.verify_finding(p_id uuid, p_accept boolean, p_reason text default null) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager_of(public.building_team((select building_id from public.findings where id = p_id))) then raise exception 'غير مصرح'; end if;
  perform public._verify_finding(p_id, auth.uid(), p_accept, p_reason, now());
end $$;

-- hazard reports
create or replace function public.submit_report(p_building uuid, p_area text, p_desc text, p_sev text, p_photos text[]) returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid; b public.buildings; mgr uuid;
begin
  if not public.is_member() then raise exception 'غير مصرح'; end if;
  if coalesce(trim(p_desc),'') = '' then raise exception 'اكتب وصف الملاحظة'; end if;
  if not public._is_photo_path_ok(p_photos, auth.uid()) then raise exception 'مسار صورة غير صالح'; end if;
  select * into b from public.buildings where id = p_building;
  if b.id is null then raise exception 'اختر المبنى'; end if;
  insert into public.finding_reports (reporter_id, building_id, floor_or_area, description, severity, photo_paths)
  values (auth.uid(), p_building, nullif(trim(coalesce(p_area,'')),''), p_desc, p_sev, coalesce(p_photos,'{}')) returning id into rid;
  for mgr in select public._team_managers(b.team_id) loop
    perform public._notify(mgr, 'report', 'report', rid, 'بلاغ ملاحظة جديد (' || p_sev || ')', b.code || ' — ' || left(p_desc, 120), '/jawlati/findings', 'report:' || rid || ':' || mgr);
  end loop;
  return rid;
end $$;

create or replace function public.convert_report(p_id uuid, p_sev text) returns uuid language plpgsql security definer set search_path = public as $$
declare r public.finding_reports; fid uuid;
begin
  select * into r from public.finding_reports where id = p_id for update;
  if not public.is_manager_of(public.building_team(r.building_id)) then raise exception 'غير مصرح'; end if;
  if r.status <> 'بانتظار المراجعة' then raise exception 'تمت مراجعة هذا البلاغ مسبقاً'; end if;
  fid := public._create_finding(r.building_id, null, null, coalesce(p_sev, r.severity), r.floor_or_area, r.description, r.photo_paths, r.reporter_id, public.riyadh_today(), r.id);
  update public.finding_reports set status = 'حُوّلت', finding_id = fid where id = p_id;
  perform public._notify(r.reporter_id, 'report_ok', 'report', p_id, 'تم اعتماد بلاغك كملاحظة رسمية', left(r.description,120), '/jawlati/findings', 'reportok:' || p_id);
  return fid;
end $$;

create or replace function public.dismiss_report(p_id uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare r public.finding_reports;
begin
  select * into r from public.finding_reports where id = p_id for update;
  if not public.is_manager_of(public.building_team(r.building_id)) then raise exception 'غير مصرح'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'اكتب سبب الاستبعاد'; end if;
  update public.finding_reports set status = 'رُفضت', dismiss_reason = p_reason where id = p_id and status = 'بانتظار المراجعة';
  perform public._notify(r.reporter_id, 'report_no', 'report', p_id, 'لم يُعتمد بلاغك', p_reason, '/jawlati/findings', 'reportno:' || p_id);
end $$;

-- ========== Jawlati aggregates (totals only) ==========
create or replace function public.building_board(p_month date)
returns table (building_id uuid, code text, name text, assigned int, approved int, on_time int, on_time_rate numeric, compliance numeric, open_critical int, open_high int, open_total int)
language sql stable security definer set search_path = public as $$
  select b.id, b.code, b.name,
    count(i.id)::int,
    count(i.id) filter (where i.status = 'معتمدة')::int,
    count(i.id) filter (where i.status = 'معتمدة' and (i.submitted_at at time zone 'Asia/Riyadh')::date <= i.due_date)::int,
    case when count(i.id) = 0 then 0 else round(100.0 * count(i.id) filter (where i.status = 'معتمدة' and (i.submitted_at at time zone 'Asia/Riyadh')::date <= i.due_date) / count(i.id), 1) end,
    round(avg(i.compliance_percent) filter (where i.status = 'معتمدة'), 1),
    (select count(*) from public.findings f where f.building_id = b.id and f.status <> 'مغلقة' and f.severity = 'حرجة')::int,
    (select count(*) from public.findings f where f.building_id = b.id and f.status <> 'مغلقة' and f.severity = 'عالية')::int,
    (select count(*) from public.findings f where f.building_id = b.id and f.status <> 'مغلقة')::int
  from public.buildings b
  left join public.inspections i on i.building_id = b.id and date_trunc('month', i.due_date) = date_trunc('month', p_month)
  where public.is_member()
  group by b.id
  order by 7 desc, 8 desc nulls last, 9 asc, b.code
$$;

create or replace function public.building_compliance_trend(p_months int default 6)
returns table (building_code text, month date, compliance numeric)
language sql stable security definer set search_path = public as $$
  select b.code, date_trunc('month', i.due_date)::date, round(avg(i.compliance_percent), 1)
  from public.inspections i join public.buildings b on b.id = i.building_id
  where public.is_member() and i.status = 'معتمدة'
    and i.due_date >= (date_trunc('month', public.riyadh_today()) - make_interval(months => p_months - 1))::date
  group by 1, 2 order by 2, 1
$$;

create or replace function public.challenge_progress2(p_challenge uuid) returns table (assigned int, on_time int, rate numeric)
language sql stable security definer set search_path = public as $$
  select count(i.id)::int,
    count(i.id) filter (where i.status = 'معتمدة' and (i.submitted_at at time zone 'Asia/Riyadh')::date <= i.due_date)::int,
    case when count(i.id) = 0 then 0 else round(100.0 * count(i.id) filter (where i.status = 'معتمدة' and (i.submitted_at at time zone 'Asia/Riyadh')::date <= i.due_date) / count(i.id), 1) end
  from public.challenges c
  join public.buildings b on (c.team_id is null or b.team_id = c.team_id)
  join public.inspections i on i.building_id = b.id and i.due_date between c.start_date and least(c.end_date, public.riyadh_today())
  where c.id = p_challenge and public.is_member()
$$;

-- ========== projects ==========
-- p_phases: [{title, deliverable, owner_id, start_date, due_date, depends_on_previous}]
create or replace function public.create_project(p_source_task uuid, p_team uuid, p_title text, p_description text, p_owner uuid, p_start date, p_due date, p_goal uuid, p_phases jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; ph jsonb; prev uuid; phid uuid; tid uuid; k int := 0; src public.tasks;
begin
  if not (public.is_manager_of(p_team) or (p_owner = auth.uid() and p_team = public.my_team())) then raise exception 'غير مصرح'; end if;
  if coalesce(trim(p_title),'') = '' then raise exception 'اكتب عنوان المشروع'; end if;
  if jsonb_array_length(coalesce(p_phases,'[]')) = 0 then raise exception 'أضف مرحلة واحدة على الأقل'; end if;
  if p_source_task is not null then
    select * into src from public.tasks where id = p_source_task;
    if src.id is null or not (src.owner_id = auth.uid() or public.is_manager_of(src.team_id)) then raise exception 'غير مصرح'; end if;
  end if;
  insert into public.projects (team_id, title, description, owner_id, start_date, due_date, goal_id, source_task_id)
  values (p_team, p_title, p_description, p_owner, p_start, p_due, p_goal, p_source_task) returning id into pid;
  for ph in select * from jsonb_array_elements(p_phases) loop
    k := k + 1;
    if coalesce(trim(ph->>'title'),'') = '' or coalesce(trim(ph->>'deliverable'),'') = '' then raise exception 'لكل مرحلة عنوان ونتيجة مطلوبة'; end if;
    insert into public.project_phases (project_id, order_no, title, deliverable, owner_id, start_date, due_date, depends_on_phase_id)
    values (pid, k, ph->>'title', ph->>'deliverable', coalesce((ph->>'owner_id')::uuid, p_owner), (ph->>'start_date')::date, (ph->>'due_date')::date,
            case when coalesce((ph->>'depends_on_previous')::boolean, false) then prev end)
    returning id into phid;
    insert into public.tasks (team_id, title, description, owner_id, start_date, due_date, project_id, phase_id, goal_id)
    values (p_team, left(p_title || ' — ' || (ph->>'title'), 200), 'النتيجة المطلوبة: ' || (ph->>'deliverable'),
            coalesce((ph->>'owner_id')::uuid, p_owner), (ph->>'start_date')::date, (ph->>'due_date')::date, pid, phid, p_goal)
    returning id into tid;
    update public.project_phases set task_id = tid where id = phid;
    prev := phid;
  end loop;
  update public.tasks set logged_after_due = false where project_id = pid;
  if p_source_task is not null then
    update public.tasks set status = 'ملغاة', cancel_reason = 'حُوّلت إلى مشروع' where id = p_source_task;
  end if;
  return pid;
end $$;

create or replace function public.tasks_phase_sync() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.phase_id is not null and (new.due_date is distinct from old.due_date or new.owner_id is distinct from old.owner_id or new.start_date is distinct from old.start_date) then
    update public.project_phases set due_date = new.due_date, owner_id = new.owner_id, start_date = new.start_date where id = new.phase_id;
  end if;
  return new;
end $$;
drop trigger if exists tasks_phase_sync on public.tasks;
create trigger tasks_phase_sync after update on public.tasks for each row execute function public.tasks_phase_sync();

insert into public.phase_templates (name, phases)
select 'مشروع توريد', '[
 {"title":"حصر الاحتياج","deliverable":"جدول بالأعداد والمقاسات","days":14},
 {"title":"نطاق العمل","deliverable":"نطاق عمل معتمد","days":7},
 {"title":"العينات","deliverable":"عينات مستلمة","days":14},
 {"title":"اعتماد العينات","deliverable":"موافقة مكتوبة","days":7},
 {"title":"أمر الشراء","deliverable":"أمر شراء صادر","days":14},
 {"title":"التوريد والاستلام","deliverable":"استلام الكميات","days":14},
 {"title":"التوزيع والإقفال","deliverable":"قائمة تسليم وإقفال الطلبات","days":14}]'::jsonb
where not exists (select 1 from public.phase_templates where name = 'مشروع توريد');

-- ========== weekly decisions ==========
create or replace function public.apply_decision(p_task uuid, p_decision text, p_new_due date, p_new_owner uuid, p_reason text, p_meeting date default null)
returns void language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = p_task for update;
  if t.id is null or not public.is_manager_of(t.team_id) then raise exception 'غير مصرح'; end if;
  if p_decision = 'تنفيذ بموعد جديد' then
    if p_new_due is null or p_new_due < public.riyadh_today() then raise exception 'اختر موعداً جديداً من اليوم فصاعداً'; end if;
    update public.tasks set due_date = p_new_due where id = p_task;
  elsif p_decision = 'إسناد لموظف آخر' then
    if p_new_owner is null then raise exception 'اختر الموظف الجديد'; end if;
    update public.tasks set owner_id = p_new_owner, due_date = coalesce(p_new_due, due_date) where id = p_task;
  elsif p_decision = 'إلغاء' then
    if coalesce(trim(p_reason),'') = '' then raise exception 'اكتب سبب الإلغاء'; end if;
    update public.tasks set status = 'ملغاة', cancel_reason = p_reason where id = p_task;
  else raise exception 'قرار غير معروف';
  end if;
  insert into public.decisions (task_id, decision, new_due_date, new_owner_id, reason, decided_by, meeting_date)
  values (p_task, p_decision, p_new_due, p_new_owner, nullif(trim(coalesce(p_reason,'')),''), auth.uid(), coalesce(p_meeting, public.riyadh_today()));
end $$;

-- ========== assignment notification ==========
create or replace function public.tasks_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null and new.owner_id is distinct from auth.uid() and auth.uid() is not null
     and (tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id) and new.inspection_id is null and new.finding_id is null then
    perform public._notify(new.owner_id, 'assigned', 'task', new.id, 'أُسندت إليك مهمة', new.title, '/tasks/' || new.id, 'assigned:' || new.id || ':' || new.owner_id);
  end if;
  return new;
end $$;
drop trigger if exists tasks_notify on public.tasks;
create trigger tasks_notify after insert or update on public.tasks for each row execute function public.tasks_notify();

-- ========== notifications job ==========
create or replace function public._run_notifications(p_day date default null) returns int language plpgsql security definer set search_path = public as $$
declare d date := coalesce(p_day, public.riyadh_today()); n int := 0; t record; k int; nb int; before_days jsonb := coalesce(public.setting('days_before'), '[3,1]');
  rep int := coalesce((public.setting('overdue_repeat_days'))::int, 3); esc int := coalesce((public.setting('escalate_after_days'))::int, 5);
  mgr uuid; dep record; g record; tm record; owner_name text; due_eff date;
begin
  if not public.is_workday(d) then return 0; end if;
  for t in select * from public.tasks where status not in ('مكتملة','ملغاة') and owner_id is not null loop
    -- effective due day for reminders: a weekend due date is reminded on the Thursday before
    due_eff := case when public.is_workday(t.due_date) then t.due_date else public.add_workdays(t.due_date, -1) end;
    for nb in select (x)::int from jsonb_array_elements_text(before_days) x loop
      if public.add_workdays(t.due_date, -nb) = d then
        n := n + public._notify(t.owner_id, 'before', 'task', t.id, 'تذكير بموعد مهمة', 'تستحق مهمتك «' || t.title || '» بعد ' || nb || ' أيام عمل (' || to_char(t.due_date,'YYYY-MM-DD') || ').', '/tasks/' || t.id, 'before:' || t.id || ':' || d);
      end if;
    end loop;
    if coalesce((public.setting('due_day_reminder'))::boolean, true) and due_eff = d then
      n := n + public._notify(t.owner_id, 'due', 'task', t.id, 'آخر موعد اليوم', 'اليوم آخر موعد لمهمة «' || t.title || '».', '/tasks/' || t.id, 'due:' || t.id || ':' || d);
    end if;
    k := public.workdays_between(t.due_date, d);
    if t.due_date < d and k >= 1 and (k = 1 or (k - 1) % greatest(rep,1) = 0) then
      n := n + public._notify(t.owner_id, 'overdue', 'task', t.id, 'مهمة متأخرة', 'مهمة «' || t.title || '» متأخرة ' || k || ' أيام عمل. حدّث الحالة أو اطلب موعداً جديداً من مديرك.', '/tasks/' || t.id, 'overdue:' || t.id || ':' || d);
    end if;
    if t.due_date < d and k = esc then
      select full_name into owner_name from public.profiles where id = t.owner_id;
      for mgr in select public._team_managers(t.team_id) loop
        if mgr <> t.owner_id then
          n := n + public._notify(mgr, 'escalation', 'task', t.id, 'تصعيد: مهمة متأخرة', 'مهمة «' || t.title || '» المسندة إلى ' || coalesce(owner_name,'') || ' متأخرة ' || k || ' أيام عمل.', '/tasks/' || t.id, 'escalate:' || t.id || ':' || mgr);
        end if;
      end loop;
    end if;
  end loop;
  for dep in select e.*, ta.title, ta.owner_id from public.external_dependencies e join public.tasks ta on ta.id = e.task_id
             where e.status = 'مطلوب' and e.expected_by is not null and ta.status not in ('مكتملة','ملغاة') loop
    if (case when public.is_workday(dep.expected_by) then dep.expected_by else public.add_workdays(dep.expected_by, -1) end) = d then
      n := n + public._notify(coalesce(dep.follow_up_owner_id, dep.owner_id), 'dependency', 'task', dep.task_id, 'موعد استلام من جهة خارجية', 'موعد استلام «' || dep.what_is_needed || '» من ' || dep.party_name || ' هو اليوم.', '/tasks/' || dep.task_id, 'dep:' || dep.id || ':' || d);
    end if;
  end loop;
  -- quarterly goal check-in: first Sunday of Mar, Jun, Sep, Dec
  if extract(month from d)::int in (3,6,9,12) and extract(dow from d)::int = 0 and extract(day from d)::int <= 7 then
    for g in select * from public.annual_goals where status = 'نشط' and year = extract(year from d)::int loop
      n := n + public._notify(g.owner_id, 'goal', 'goal', g.id, 'تحديث ربعي للهدف', 'حان وقت التحديث الربعي لهدف «' || g.title || '».', '/goals/' || g.id, 'goal:' || g.id || ':' || d);
    end loop;
  end if;
  -- weekly digest to managers on Sunday
  if extract(dow from d)::int = 0 then
    for tm in select id from public.teams loop
      for mgr in select public._team_managers(tm.id) loop
        n := n + public._notify(mgr, 'digest', 'team', tm.id, 'الملخص الأسبوعي',
          'متأخرة: ' || (select count(*) from public.tasks x where x.team_id = tm.id and x.status not in ('مكتملة','ملغاة') and x.due_date < d)
          || ' · تستحق هذا الأسبوع: ' || (select count(*) from public.tasks x where x.team_id = tm.id and x.status not in ('مكتملة','ملغاة') and x.due_date between d and d + 6)
          || ' · عالقة: ' || (select count(*) from public.tasks x where x.team_id = tm.id and x.final_class = 'عالقة' and x.status not in ('مكتملة','ملغاة'))
          || ' · ملاحظات مفتوحة: ' || (select count(*) from public.findings f join public.buildings b on b.id = f.building_id where b.team_id = tm.id and f.status <> 'مغلقة')
          || ' · بانتظار الاعتماد: ' || (select count(*) from public.inspections i join public.buildings b on b.id = i.building_id where b.team_id = tm.id and i.status = 'بانتظار الاعتماد'),
          '/dashboard', 'digest:' || tm.id || ':' || mgr || ':' || d);
      end loop;
    end loop;
  end if;
  return n;
end $$;
revoke execute on function public._run_notifications(date) from public, anon, authenticated;

-- daily job: monthly inspections, time-based reclassification, notifications
create or replace function public._daily_job() returns int language plpgsql security definer set search_path = public as $$
begin
  perform public._generate_inspections(public.riyadh_today());
  update public.tasks set updated_at = now() where status not in ('مكتملة','ملغاة');
  return public._run_notifications(public.riyadh_today());
end $$;
revoke execute on function public._daily_job() from public, anon, authenticated;
grant execute on function public._daily_job() to service_role;

create or replace function public.run_notifications_now() returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;
  perform public._generate_inspections(public.riyadh_today());
  update public.tasks set updated_at = now() where status not in ('مكتملة','ملغاة');
  return public._run_notifications(public.riyadh_today());
end $$;

-- schedule with pg_cron when available (07:00 Riyadh = 04:00 UTC, Sunday-Thursday)
-- @cron-begin
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron not available: %', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      execute $cron$ select cron.schedule('aamin-daily', '0 4 * * 0-4', 'select public._daily_job()') $cron$;
    exception when others then
      raise notice 'could not schedule aamin-daily: %', sqlerrm;
    end;
  end if;
end $$;
-- @cron-end

-- ========== grants for callable functions ==========
revoke execute on function public.generate_inspections(date), public.start_inspection(uuid), public.submit_inspection(uuid, jsonb, boolean),
  public.approve_inspection(uuid), public.reject_inspection(uuid, text), public.close_finding(uuid, text, text[], text, text),
  public.verify_finding(uuid, boolean, text), public.submit_report(uuid, text, text, text, text[]), public.convert_report(uuid, text),
  public.dismiss_report(uuid, text), public.building_board(date), public.building_compliance_trend(int), public.challenge_progress2(uuid),
  public.create_project(uuid, uuid, text, text, uuid, date, date, uuid, jsonb), public.apply_decision(uuid, text, date, uuid, text, date),
  public.run_notifications_now(), public.inspection_items(uuid), public.is_member() from anon;
