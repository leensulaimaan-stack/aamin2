
create policy "upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own or manager photos" on storage.objects for select to authenticated
  using (bucket_id = 'inspection-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(),'manager')));
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'inspection-photos' and (storage.foldername(name))[1] = auth.uid()::text);

insert into public.teams (name) values ('المباني المؤسسية'), ('سلامتك');

insert into public.badges (code, name, description, icon) values
 ('first_round','أول جولة','أول مهمة يتم اعتمادها لك','Footprints'),
 ('safety_eye','عين السلامة','توثيق ١٠ ملاحظات مدعومة بالصور','Eye'),
 ('streak_3','ملتزم ٣ أشهر','٣ أشهر متتالية بكل المهام معتمدة وبدون تأخير','Flame'),
 ('building_no_delay','مبنى بلا تأخير','وصول مبناك إلى ١٠٠٪ في الموعد خلال شهر','Building2');

insert into public.buildings (code, name, team_id) values
 ('NHC-1','المبنى الرئيسي',(select id from public.teams where name='المباني المؤسسية')),
 ('NHC-2','مبنى الخدمات المشتركة',(select id from public.teams where name='المباني المؤسسية')),
 ('NHC-3','مبنى العمليات',(select id from public.teams where name='المباني المؤسسية')),
 ('NHC-4','مبنى خدمة العملاء',(select id from public.teams where name='سلامتك')),
 ('NHC-5','مبنى المستودعات',(select id from public.teams where name='سلامتك'));

-- demo users (password: Jawlati@2026)
with u(id, email, name) as (values
 ('00000000-0000-4000-a000-000000000001'::uuid,'manager@jawlati.demo','خالد العتيبي'),
 ('00000000-0000-4000-a000-000000000002'::uuid,'sara@jawlati.demo','سارة القحطاني'),
 ('00000000-0000-4000-a000-000000000003'::uuid,'fahad@jawlati.demo','فهد الدوسري'),
 ('00000000-0000-4000-a000-000000000004'::uuid,'noura@jawlati.demo','نورة الشهري'),
 ('00000000-0000-4000-a000-000000000005'::uuid,'abdullah@jawlati.demo','عبدالله الحربي'),
 ('00000000-0000-4000-a000-000000000006'::uuid,'reem@jawlati.demo','ريم المطيري'),
 ('00000000-0000-4000-a000-000000000007'::uuid,'yousef@jawlati.demo','يوسف الزهراني'))
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, extensions.crypt('Jawlati@2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', name), now(), now(), '', '', '', ''
from u;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()
from auth.users where email like '%@jawlati.demo';

update public.user_roles set role = 'manager' where user_id = '00000000-0000-4000-a000-000000000001';
update public.profiles set team_id = (select id from public.teams where name='المباني المؤسسية')
 where id in ('00000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000003','00000000-0000-4000-a000-000000000004');
update public.profiles set team_id = (select id from public.teams where name='سلامتك')
 where id in ('00000000-0000-4000-a000-000000000005','00000000-0000-4000-a000-000000000006','00000000-0000-4000-a000-000000000007');

insert into public.task_templates (title, type, building_id, default_assignee_id, recurrence, due_day, checklist_items) values
 ('التفتيش الدوري على أنظمة الإنذار والإطفاء','تفتيش دوري',(select id from public.buildings where code='NHC-1'),'00000000-0000-4000-a000-000000000002','monthly',20,
  '["لوحة الإنذار تعمل دون أعطال","كواشف الدخان سليمة","رشاشات الإطفاء غير معاقة","مضخات الحريق تعمل","مخارج الطوارئ واضحة"]'),
 ('فحص طفايات الحريق','فحص طفايات',(select id from public.buildings where code='NHC-2'),'00000000-0000-4000-a000-000000000003','monthly',15,
  '["الضغط ضمن المؤشر الأخضر","تاريخ الصيانة ساري","الختم والمسمار سليمان","الطفاية في مكانها المحدد","اللافتة الإرشادية واضحة"]'),
 ('متابعة صناديق الإسعافات الأولية','فحص صناديق الإسعافات',(select id from public.buildings where code='NHC-3'),'00000000-0000-4000-a000-000000000004','monthly',10,
  '["المحتويات مكتملة","لا توجد مواد منتهية الصلاحية","الصندوق في مكان يسهل الوصول إليه","سجل الاستخدام محدث"]'),
 ('جولة سلامة أسبوعية','جولة سلامة',(select id from public.buildings where code='NHC-4'),'00000000-0000-4000-a000-000000000005','weekly',4,
  '["الممرات خالية من العوائق","الإضاءة كافية","لا توجد تسربات","اللوحات الكهربائية مغلقة"]'),
 ('جولة سلامة أسبوعية - المستودعات','جولة سلامة',(select id from public.buildings where code='NHC-5'),'00000000-0000-4000-a000-000000000006','weekly',3,
  '["التخزين وفق الارتفاعات المسموحة","الممرات خالية","معدات الرفع سليمة","لافتات السلامة واضحة"]'),
 ('تحديث سجل ملاحظات السلامة','تحديث سجلات',(select id from public.buildings where code='NHC-4'),'00000000-0000-4000-a000-000000000007','monthly',25,
  '["تسجيل الملاحظات الجديدة","إغلاق الملاحظات المعالجة","مراجعة الإجراءات التصحيحية"]'),
 ('رفع تقرير زيارة المباني','أخرى',(select id from public.buildings where code='NHC-1'),'00000000-0000-4000-a000-000000000003','monthly',28,
  '["زيارة جميع الأدوار","توثيق الحالة العامة","رفع التوصيات"]'),
 ('فحص طفايات الحريق - المستودعات','فحص طفايات',(select id from public.buildings where code='NHC-5'),'00000000-0000-4000-a000-000000000007','monthly',12,
  '["الضغط ضمن المؤشر الأخضر","تاريخ الصيانة ساري","الطفاية في مكانها المحدد"]');

select public._generate_tasks('2026-08-01');
select public._generate_tasks('2026-09-01');
select public._generate_tasks('2026-10-01');
select public._generate_tasks(public.riyadh_today());

-- historical mix
with x as (select id, due_date, abs(hashtext(id::text || 'j')) % 100 as h from public.task_instances where due_date < public.riyadh_today())
update public.task_instances t set
  status = case when x.due_date < date_trunc('month', public.riyadh_today())::date then
      case when x.h < 62 or (x.h >= 62 and x.h < 78) then 'معتمدة' when x.h < 86 then 'مرفوضة' when x.h < 93 then 'بانتظار الاعتماد' else 'لم تبدأ' end
    else case when x.h < 40 then 'بانتظار الاعتماد' when x.h < 65 then 'معتمدة' else 'لم تبدأ' end end,
  submitted_at = case
    when x.due_date < date_trunc('month', public.riyadh_today())::date and x.h >= 62 and x.h < 78 then ((x.due_date + (1 + x.h % 5))::timestamp + time '10:30') at time zone 'Asia/Riyadh'
    when x.due_date < date_trunc('month', public.riyadh_today())::date and x.h >= 93 then null
    when x.due_date >= date_trunc('month', public.riyadh_today())::date and x.h >= 65 then null
    else ((x.due_date - (x.h % 3))::timestamp + time '10:30') at time zone 'Asia/Riyadh' end,
  report_submitted_same_day = (x.h % 4 <> 0),
  rejection_reason = case when x.due_date < date_trunc('month', public.riyadh_today())::date and x.h >= 78 and x.h < 86 then 'الصور غير واضحة، يرجى إعادة التصوير وتوثيق الملاحظات' end,
  approved_by = case when x.h < 78 or (x.due_date >= date_trunc('month', public.riyadh_today())::date and x.h < 65) then '00000000-0000-4000-a000-000000000001'::uuid end
from x where t.id = x.id;

update public.task_instances set approved_at = submitted_at + interval '1 day' where status = 'معتمدة';
update public.task_instances set approved_by = null where status <> 'معتمدة' and status <> 'مرفوضة';
update public.task_instances set status = 'قيد التنفيذ' where due_date >= public.riyadh_today() and abs(hashtext(id::text || 'k')) % 100 < 15;

insert into public.submissions (task_instance_id, checklist_results, photos, findings_count, notes, created_at)
select t.id,
  (select jsonb_object_agg(item, jsonb_build_object('result', case when abs(hashtext(t.id::text || item)) % 6 = 0 then 'issue' else 'ok' end,
     'note', case when abs(hashtext(t.id::text || item)) % 6 = 0 then 'تم رصد ملاحظة وإبلاغ الجهة المختصة' else '' end))
   from jsonb_array_elements_text(tpl.checklist_items) item),
  array['demo/site-1.jpg','demo/site-2.jpg'],
  (select count(*) from jsonb_array_elements_text(tpl.checklist_items) item where abs(hashtext(t.id::text || item)) % 6 = 0),
  'تمت الجولة حسب الخطة', t.submitted_at
from public.task_instances t join public.task_templates tpl on tpl.id = t.template_id
where t.submitted_at is not null;

do $$ declare r record; begin
  for r in select id from public.task_instances where status = 'معتمدة' order by approved_at loop
    perform public._award_points(r.id);
    perform public._award_badges(r.id);
  end loop;
end $$;

insert into public.challenges (title, team_id, start_date, end_date, target_percent)
values ('تحدي الربع الرابع: كل المباني في الموعد', null, '2026-10-01', '2026-12-31', 100);
