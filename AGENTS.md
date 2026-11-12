<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Points, badges, approvals, submissions and task generation run only in SECURITY DEFINER Postgres functions (rpc); clients have no insert rights on ledger/badges — prevents self-granted points.
- Roles live in public.user_roles checked via has_role(); never on profiles — prevents privilege escalation.
- Public aggregates (building leaderboard, challenge progress) are RPCs returning totals only — keeps individual data private.
- Inspection photos go to a private bucket under `<user_id>/...`, shown via signed URLs.
- Self sign-ups get no role (pending) until an admin assigns one; role/team never come from user metadata. Data is visible only to members (`is_member()`).
- Inspections, findings, corrective actions, reports, projects and weekly decisions are written through SECURITY DEFINER RPCs (submit_inspection, approve_inspection, close_finding, verify_finding, convert_report, create_project, apply_decision, ...).
- Embedded selects always name the FK (`table!fk_name(...)`): several tables have more than one path between them.
