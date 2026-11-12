-- Aamin demo data (fake people). Password for all demo accounts: Jawlati@2026
-- Remove demo accounts before real use (المستخدمون ← إيقاف).

-- extra demo accounts: department admin + manager for سلامتك
with u(id, email, name) as (values
 ('00000000-0000-4000-a000-000000000008'::uuid,'admin@jawlati.demo','مدير الإدارة (تجريبي)'),
 ('00000000-0000-4000-a000-000000000009'::uuid,'manager2@jawlati.demo','مدير فريق سلامتك (تجريبي)'))
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, extensions.crypt('Jawlati@2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', name), now(), now(), '', '', '', ''
from u where not exists (select 1 from auth.users x where x.id = u.id);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()
from auth.users where email in ('admin@jawlati.demo','manager2@jawlati.demo')
  and not exists (select 1 from auth.identities i where i.user_id = auth.users.id);

insert into public.user_roles (user_id, role) values
 ('00000000-0000-4000-a000-000000000008','admin'), ('00000000-0000-4000-a000-000000000009','manager')
on conflict do nothing;
update public.profiles set team_id = (select id from public.teams where name='المباني المؤسسية') where id = '00000000-0000-4000-a000-000000000008';
update public.profiles set team_id = (select id from public.teams where name='سلامتك') where id = '00000000-0000-4000-a000-000000000009';
-- every demo user that has no role yet is an employee
insert into public.user_roles (user_id, role)
select p.id, 'employee' from public.profiles p where p.email like '%@jawlati.demo' and not exists (select 1 from public.user_roles r where r.user_id = p.id);

-- buildings: features and responsible person for corrective actions
update public.buildings set floors_count = 6, has_kitchen = true, has_parking = true, has_generator = true, has_elevators = true, has_aed = true, has_fire_pump_room = true,
  responsible_user_id = '00000000-0000-4000-a000-000000000003', address = 'الرياض' where code = 'NHC-1';
update public.buildings set floors_count = 4, has_kitchen = true, has_elevators = true, has_smoking_area = true,
  responsible_user_id = '00000000-0000-4000-a000-000000000003', address = 'الرياض' where code = 'NHC-2';
update public.buildings set floors_count = 3, has_parking = true, has_contractor_works = true,
  responsible_user_id = '00000000-0000-4000-a000-000000000004', address = 'الرياض' where code = 'NHC-3';
update public.buildings set floors_count = 2, has_kitchen = true, has_aed = true, has_parking = true,
  responsible_user_id = '00000000-0000-4000-a000-000000000007', address = 'الرياض' where code = 'NHC-4';
update public.buildings set floors_count = 1, has_chemical_storage = true, has_generator = true, has_parking = true, has_contractor_works = true,
  responsible_user_id = '00000000-0000-4000-a000-000000000007', address = 'الرياض' where code = 'NHC-5';

-- one monthly comprehensive inspection (all sections), shared by both teams
insert into public.inspection_templates (team_id, name, recurrence, due_day, section_codes)
select null, 'الجولة الشهرية الشاملة', 'monthly', 25, array['A','B','C','D','E','F','G','H','I','J']
where not exists (select 1 from public.inspection_templates where name = 'الجولة الشهرية الشاملة');

insert into public.building_inspection_plans (building_id, template_id, assignee_id)
select b.id, t.id, v.u::uuid
from (values ('NHC-1','00000000-0000-4000-a000-000000000002'),('NHC-2','00000000-0000-4000-a000-000000000003'),
             ('NHC-3','00000000-0000-4000-a000-000000000004'),('NHC-4','00000000-0000-4000-a000-000000000005'),
             ('NHC-5','00000000-0000-4000-a000-000000000006')) v(code, u)
join public.buildings b on b.code = v.code
cross join (select id from public.inspection_templates where name = 'الجولة الشهرية الشاملة') t
on conflict (building_id, template_id) do nothing;

-- three months of inspections: two past months + current month
do $$
declare m int; r record; ans jsonb; it record; h int; res text; at_ts timestamptz; cur date := date_trunc('month', public.riyadh_today())::date;
begin
  for m in reverse 2..0 loop
    perform public._generate_inspections((cur - make_interval(months => m))::date);
  end loop;
  update public.tasks set logged_after_due = false where inspection_id is not null;

  for r in select i.*, b.code from public.inspections i join public.buildings b on b.id = i.building_id
           where i.due_date < cur + 40 order by i.due_date loop
    h := abs(hashtext(r.id::text || 'aamin')) % 100;
    -- current month: some still open, some waiting for approval
    if r.due_date >= cur and h >= 45 then continue; end if;
    ans := '[]'::jsonb;
    for it in select * from public.inspection_items(r.id) loop
      null;
    end loop;
    for it in
      select ci.id, ci.default_severity from public.inspection_templates t
      join public.checklist_sections cs on cs.code = any(t.section_codes)
      join public.checklist_items ci on ci.section_id = cs.id
      join public.buildings b on b.id = r.building_id
      where t.id = r.template_id and (ci.applies_if is null or (to_jsonb(b) ->> ci.applies_if)::boolean)
    loop
      res := case when abs(hashtext(r.id::text || it.id::text)) % 13 = 0 then 'غير مطابق'
                  when abs(hashtext(r.id::text || it.id::text)) % 17 = 0 then 'لا ينطبق' else 'مطابق' end;
      ans := ans || jsonb_build_object('item_id', it.id, 'result', res,
        'severity', case when res = 'غير مطابق' then it.default_severity end,
        'note', case when res = 'غير مطابق' then 'تم رصد الملاحظة أثناء الجولة' end,
        'photo_paths', case when res = 'غير مطابق' then '["demo/site-1.jpg"]'::jsonb else '[]'::jsonb end,
        'floor_or_area', case when res = 'غير مطابق' then 'الدور الأرضي' end);
    end loop;
    at_ts := ((r.due_date - (h % 6) + case when h > 80 then 9 else 0 end)::timestamp + time '10:30') at time zone 'Asia/Riyadh';
    perform public._submit_inspection(r.id, r.assignee_id, ans, h % 4 <> 0, at_ts, false);
    if r.due_date < cur then
      if h between 70 and 76 then
        update public.inspections set status = 'مرفوضة', rejection_reason = 'الصور غير واضحة، أعد تصوير البنود غير المطابقة', reviewed_by = '00000000-0000-4000-a000-000000000001', reviewed_at = at_ts + interval '1 day' where id = r.id;
      else
        perform public._approve_inspection(r.id, case when r.code in ('NHC-4','NHC-5') then '00000000-0000-4000-a000-000000000009'::uuid else '00000000-0000-4000-a000-000000000001'::uuid end, at_ts + interval '1 day');
      end if;
    end if;
  end loop;
end $$;

-- close some of the older findings
do $$
declare f record; k int := 0;
begin
  for f in select fi.*, t.owner_id, t.due_date from public.findings fi join public.tasks t on t.id = fi.corrective_task_id
           order by fi.created_at loop
    k := k + 1;
    if k % 3 = 0 then continue; end if;
    update public.findings set status = 'بانتظار التحقق', closure_note = 'تمت المعالجة', closure_photo_paths = '{demo/site-2.jpg}',
      closure_submitted_at = ((f.due_date - (k % 3))::timestamp + time '12:00') at time zone 'Asia/Riyadh' where id = f.id;
    if k % 5 <> 0 then perform public._verify_finding(f.id, '00000000-0000-4000-a000-000000000001', true, null, now()); end if;
  end loop;
end $$;

-- everyday tasks across classes and statuses (manager of المباني المؤسسية acting)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}', true);
insert into public.tasks (team_id, title, description, owner_id, start_date, due_date, status, priority, created_at, delay_reason, completed_at)
select (select id from public.teams where name = v.team), v.title, v.descr, v.owner::uuid, public.riyadh_today() + v.s, public.riyadh_today() + v.d, v.st, v.pr,
       now() + make_interval(days => v.c), v.dr,
       case when v.st = 'مكتملة' then ((public.riyadh_today() + v.d + case when v.dr is null then -1 else 3 end)::timestamp + time '13:00') at time zone 'Asia/Riyadh' end
from (values
 ('المباني المؤسسية','تحديث خطة الإخلاء لمبنى NHC-2','مراجعة المخطط وتعليقه في كل طابق','00000000-0000-4000-a000-000000000003', -5, 2, 'قيد التنفيذ','عالية', -5, null),
 ('المباني المؤسسية','تنسيق تدريب الإسعافات الأولية للرياض','حجز المدرب والقاعة وقائمة الحضور','00000000-0000-4000-a000-000000000002', -3, 1, 'لم تبدأ','عادية', -3, null),
 ('المباني المؤسسية','رفع طلب صيانة لوحة الإنذار في NHC-1',null,'00000000-0000-4000-a000-000000000002', -10, -4, 'قيد التنفيذ','عاجلة', -10, null),
 ('المباني المؤسسية','إعداد تقرير الحوادث الشهري',null,'00000000-0000-4000-a000-000000000004', -2, 0, 'لم تبدأ','عادية', -2, null),
 ('المباني المؤسسية','مراجعة عقد صيانة أنظمة الحريق','مراجعة البنود الفنية مع المشتريات','00000000-0000-4000-a000-000000000004', -20, -6, 'قيد التنفيذ','عالية', -20, null),
 ('المباني المؤسسية','حصر الأماكن المغلقة في المباني',null,'00000000-0000-4000-a000-000000000003', -90, -60, 'لم تبدأ','عادية', -90, null),
 ('المباني المؤسسية','نشر رسالة توعوية عن التدخين',null,'00000000-0000-4000-a000-000000000002', -15, -8, 'مكتملة','عادية', -15, null),
 ('المباني المؤسسية','تحديث قائمة المسعفين والطوارئ',null,'00000000-0000-4000-a000-000000000003', -30, -12, 'مكتملة','عادية', -30, 'ضغط عمل'),
 ('المباني المؤسسية','تجهيز معدات الحماية الشخصية للزوار',null,'00000000-0000-4000-a000-000000000004', 0, 6, 'لم تبدأ','عادية', 0, null),
 ('المباني المؤسسية','مشروع الزي الموحد للموظفين','مهمة سنوية طويلة — مرشحة للتحويل إلى مشروع','00000000-0000-4000-a000-000000000002', -60, 55, 'قيد التنفيذ','عادية', -60, null),
 ('سلامتك','حملة توعوية: سلامتك أولوية','تصميم ونشر الرسائل الشهرية','00000000-0000-4000-a000-000000000005', -4, 3, 'قيد التنفيذ','عادية', -4, null),
 ('سلامتك','متابعة ملاحظات السلامة في المشاريع',null,'00000000-0000-4000-a000-000000000006', -7, -2, 'قيد التنفيذ','عالية', -7, null),
 ('سلامتك','إعداد مادة تدريبية عن ISO 45001',null,'00000000-0000-4000-a000-000000000007', -1, 9, 'لم تبدأ','عادية', -1, null),
 ('سلامتك','تحديث سجل المقاولين المعتمدين',null,'00000000-0000-4000-a000-000000000005', -70, -40, 'لم تبدأ','عادية', -70, null),
 ('سلامتك','مراجعة تقارير زيارات المشاريع',null,'00000000-0000-4000-a000-000000000006', -12, -5, 'مكتملة','عادية', -12, 'تعارض أولويات'),
 ('سلامتك','التنسيق لتوفير سيارة إسعاف للفعالية',null,'00000000-0000-4000-a000-000000000007', -6, 4, 'لم تبدأ','عاجلة', -6, null),
 ('سلامتك','برنامج التفتيش السنوي على المشاريع','برنامج يمتد للربع القادم','00000000-0000-4000-a000-000000000005', -10, 80, 'قيد التنفيذ','عادية', -10, null)
) as v(team, title, descr, owner, s, d, st, pr, c, dr);
update public.tasks set logged_after_due = false where inspection_id is null and finding_id is null;

-- one past-due logged task (to show the "logged after due" flag)
insert into public.tasks (team_id, title, owner_id, start_date, due_date, status)
values ((select id from public.teams where name='المباني المؤسسية'), 'توثيق زيارة الدفاع المدني (سُجّلت لاحقاً)', '00000000-0000-4000-a000-000000000004', public.riyadh_today() - 9, public.riyadh_today() - 7, 'قيد التنفيذ');

-- complex tasks: contributors + external dependencies
with t as (
  insert into public.tasks (team_id, title, description, owner_id, start_date, due_date, status, priority)
  values ((select id from public.teams where name='المباني المؤسسية'), 'رفع الامتثال إلى 75% حسب تدقيق HSSE', 'إغلاق ملاحظات التدقيق المفتوحة في المباني المؤسسية', '00000000-0000-4000-a000-000000000003', public.riyadh_today() - 14, public.riyadh_today() + 20, 'قيد التنفيذ', 'عالية')
  returning id)
insert into public.task_contributors (task_id, user_id) select t.id, x::uuid from t, unnest(array['00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000004']) x;

insert into public.task_steps (task_id, order_no, title, is_done, done_at)
select t.id, v.o, v.title, v.done, case when v.done then now() end
from public.tasks t, (values (1,'حصر الملاحظات المفتوحة', true),(2,'إغلاق الملاحظات السريعة', true),(3,'طلب عروض للملاحظات التي تحتاج شراء', false),(4,'اجتماع الاستشاري', false),(5,'تحديث نسبة الامتثال', false)) v(o, title, done)
where t.title = 'رفع الامتثال إلى 75% حسب تدقيق HSSE';

insert into public.external_dependencies (task_id, party_type, party_name, what_is_needed, requested_on, expected_by, follow_up_owner_id)
select t.id, 'استشاري', 'استشاري التدقيق', 'موعد اجتماع مراجعة الملاحظات', public.riyadh_today() - 12, public.riyadh_today() - 2, '00000000-0000-4000-a000-000000000003'
from public.tasks t where t.title = 'رفع الامتثال إلى 75% حسب تدقيق HSSE';

with t as (
  insert into public.tasks (team_id, title, owner_id, start_date, due_date, status, priority)
  values ((select id from public.teams where name='سلامتك'), 'ترخيص مستودع NHC-5 من الدفاع المدني', '00000000-0000-4000-a000-000000000007', public.riyadh_today() - 25, public.riyadh_today() + 10, 'قيد التنفيذ', 'عالية')
  returning id)
insert into public.external_dependencies (task_id, party_type, party_name, what_is_needed, requested_on, expected_by, follow_up_owner_id)
select t.id, 'ترخيص', 'الدفاع المدني', 'زيارة المعاينة وإصدار الشهادة', public.riyadh_today() - 20, public.riyadh_today() + 3, '00000000-0000-4000-a000-000000000007' from t;
update public.tasks set status = 'بانتظار جهة خارجية' where title = 'ترخيص مستودع NHC-5 من الدفاع المدني';

with t as (
  insert into public.tasks (team_id, title, owner_id, start_date, due_date, status)
  values ((select id from public.teams where name='المباني المؤسسية'), 'إنهاء عقد مورد الأثاث التالف', '00000000-0000-4000-a000-000000000004', public.riyadh_today() - 18, public.riyadh_today() + 5, 'قيد التنفيذ')
  returning id)
insert into public.external_dependencies (task_id, party_type, party_name, what_is_needed, requested_on, expected_by, follow_up_owner_id)
select t.id, 'مشتريات', 'إدارة المشتريات', 'خطاب إنهاء التعاقد ودفع المستحقات', public.riyadh_today() - 15, public.riyadh_today() + 1, '00000000-0000-4000-a000-000000000004' from t;

-- projects
select public.create_project(null, (select id from public.teams where name='المباني المؤسسية'), 'مشروع معدات الحماية الشخصية', 'توريد وتوزيع معدات الحماية للمباني', '00000000-0000-4000-a000-000000000002',
  public.riyadh_today() - 35, public.riyadh_today() + 40, null,
  jsonb_build_array(
    jsonb_build_object('title','حصر الاحتياج','deliverable','جدول بالأعداد والمقاسات','owner_id','00000000-0000-4000-a000-000000000002','start_date', public.riyadh_today() - 35,'due_date', public.riyadh_today() - 22,'depends_on_previous', false),
    jsonb_build_object('title','نطاق العمل','deliverable','نطاق عمل معتمد','owner_id','00000000-0000-4000-a000-000000000002','start_date', public.riyadh_today() - 21,'due_date', public.riyadh_today() - 14,'depends_on_previous', true),
    jsonb_build_object('title','أمر الشراء','deliverable','أمر شراء صادر','owner_id','00000000-0000-4000-a000-000000000003','start_date', public.riyadh_today() - 13,'due_date', public.riyadh_today() - 1,'depends_on_previous', true),
    jsonb_build_object('title','التوريد والاستلام','deliverable','استلام الكميات','owner_id','00000000-0000-4000-a000-000000000003','start_date', public.riyadh_today(),'due_date', public.riyadh_today() + 14,'depends_on_previous', true),
    jsonb_build_object('title','التوزيع والإقفال','deliverable','قائمة تسليم','owner_id','00000000-0000-4000-a000-000000000002','start_date', public.riyadh_today() + 15,'due_date', public.riyadh_today() + 28,'depends_on_previous', true)));
update public.tasks set status = 'مكتملة', completed_at = (due_date::timestamp + time '11:00') at time zone 'Asia/Riyadh'
  where project_id = (select id from public.projects where title = 'مشروع معدات الحماية الشخصية') and title like '% — حصر الاحتياج';
update public.tasks set status = 'مكتملة', completed_at = (due_date::timestamp + time '11:00') at time zone 'Asia/Riyadh'
  where project_id = (select id from public.projects where title = 'مشروع معدات الحماية الشخصية') and title like '% — نطاق العمل';
update public.tasks set status = 'قيد التنفيذ'
  where project_id = (select id from public.projects where title = 'مشروع معدات الحماية الشخصية') and title like '% — أمر الشراء';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000009","role":"authenticated"}', true);
select public.create_project(null, (select id from public.teams where name='سلامتك'), 'نظام إدارة السلامة ISO 45001', 'تأهيل الإدارة لشهادة ISO 45001', '00000000-0000-4000-a000-000000000005',
  public.riyadh_today() - 10, public.riyadh_today() + 60, null,
  jsonb_build_array(
    jsonb_build_object('title','تحليل الفجوات','deliverable','تقرير الفجوات','owner_id','00000000-0000-4000-a000-000000000005','start_date', public.riyadh_today() - 10,'due_date', public.riyadh_today() + 3,'depends_on_previous', false),
    jsonb_build_object('title','تحديث الإجراءات','deliverable','إجراءات معتمدة','owner_id','00000000-0000-4000-a000-000000000006','start_date', public.riyadh_today() + 4,'due_date', public.riyadh_today() + 17,'depends_on_previous', true),
    jsonb_build_object('title','التدريب الداخلي','deliverable','سجل حضور','owner_id','00000000-0000-4000-a000-000000000007','start_date', public.riyadh_today() + 18,'due_date', public.riyadh_today() + 31,'depends_on_previous', true),
    jsonb_build_object('title','التدقيق الداخلي','deliverable','تقرير تدقيق داخلي','owner_id','00000000-0000-4000-a000-000000000005','start_date', public.riyadh_today() + 32,'due_date', public.riyadh_today() + 45,'depends_on_previous', true)));
update public.tasks set status = 'قيد التنفيذ'
  where project_id = (select id from public.projects where title = 'نظام إدارة السلامة ISO 45001') and title like '% — تحليل الفجوات';

-- annual goals
insert into public.annual_goals (year, team_id, owner_id, title, description, measure_type, baseline_value, target_value, unit, weight)
values
 (extract(year from public.riyadh_today())::int, (select id from public.teams where name='المباني المؤسسية'), '00000000-0000-4000-a000-000000000002', 'رفع نسبة الجولات في الموعد', 'جولات التفتيش الشهرية المعتمدة في موعدها', 'نسبة مئوية', 60, 95, '%', 50),
 (extract(year from public.riyadh_today())::int, (select id from public.teams where name='المباني المؤسسية'), '00000000-0000-4000-a000-000000000002', 'إغلاق ملاحظات التدقيق', 'عدد الملاحظات المغلقة من تدقيق HSSE', 'عدد', 0, 40, 'ملاحظة', 50),
 (extract(year from public.riyadh_today())::int, (select id from public.teams where name='سلامتك'), '00000000-0000-4000-a000-000000000005', 'تأهيل ISO 45001', 'إنجاز مراحل التأهيل', 'مراحل', 0, 4, 'مرحلة', 100);

insert into public.goal_milestones (goal_id, quarter, title, target_value, due_date, achieved_value, status)
select g.id, q, 'مستهدف الربع ' || q, case g.measure_type when 'نسبة مئوية' then 60 + q * 9 when 'عدد' then q * 10 else q end,
  make_date(g.year, q * 3, 28), null, case when make_date(g.year, q * 3, 28) < public.riyadh_today() then 'تحقق' else 'لم يتحقق' end
from public.annual_goals g, generate_series(1,4) q;

insert into public.goal_checkins (goal_id, quarter, current_value, rag, comment, created_by)
select g.id, 3, case g.measure_type when 'نسبة مئوية' then 82 when 'عدد' then 24 else 2 end,
  case g.measure_type when 'عدد' then 'معرّض للخطر' else 'على المسار' end,
  case g.measure_type when 'عدد' then 'ملاحظات الشراء تنتظر أوامر الشراء' end, g.owner_id
from public.annual_goals g;

-- link some work to goals
update public.tasks set goal_id = (select id from public.annual_goals where title = 'إغلاق ملاحظات التدقيق') where title = 'رفع الامتثال إلى 75% حسب تدقيق HSSE';
update public.projects set goal_id = (select id from public.annual_goals where title = 'تأهيل ISO 45001') where title = 'نظام إدارة السلامة ISO 45001';

-- a pending hazard report
insert into public.finding_reports (reporter_id, building_id, floor_or_area, description, severity)
values ('00000000-0000-4000-a000-000000000005', (select id from public.buildings where code='NHC-4'), 'الممر الشرقي', 'تسرب مياه من السقف قرب لوحة الكهرباء', 'عالية');

-- challenge on the new monthly inspections
update public.challenges set title = 'تحدي الربع الرابع: كل جولات المباني في موعدها' where title like 'تحدي الربع الرابع%';

select set_config('request.jwt.claims', '', true);
