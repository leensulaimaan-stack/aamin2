drop policy if exists "teams read" on public.teams;
create policy "teams read" on public.teams for select to authenticated using (public.is_member());