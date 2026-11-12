# Roadmap

## Jawlati (first brief)
- [x] Login, roles, data rules, demo data
- [x] Employee: home, task execution, achievements, building leaderboard
- [x] Manager: dashboard, approvals, templates, team, challenges
- [x] Approvals screen verified (photos load, approve works)

## Aamin (second brief — expands Jawlati into a full HSSE follow-up system)
- [x] Green and white logos received and saved
- [x] Symbol-only logo + app icons (192/512) cut from the official logo
- [x] 1 Auth, roles (employee/manager/admin), data rules, audit log
- [x] 2 Home + tasks + auto classification
- [x] 3 Jawlati inspections, checklist library, findings, corrective actions
- [x] 4 Notifications (in-app + email, daily job)
- [x] 5 Projects with phases
- [x] 6 Complex tasks + external dependencies
- [x] 7 Annual goals
- [x] 8 Team dashboard + weekly decisions + Excel export
- [x] 9 Installable app polish

## Notes (Claude Code build)
- Jawlati is monthly only: one comprehensive monthly inspection per building (checklist library A–J, items filtered by building features).
- Migrations 0004 (workflows, RPCs, notifications job, monthly-only, FKs) and 0005 (demo data) must be applied to the database.
- Daily job: pg_cron `aamin-daily` when available, otherwise POST /api/cron/daily with LOVABLE_CRON_SECRET, or the admin button in Settings.
- Email delivery is not wired yet (in-app notifications only); preferences are stored.
