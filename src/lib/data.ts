import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Building = Database["public"]["Tables"]["buildings"]["Row"];
export type Inspection = Database["public"]["Tables"]["inspections"]["Row"];
export type Finding = Database["public"]["Tables"]["findings"]["Row"];

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, team_id, is_active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useNames() {
  const p = useProfiles();
  const map = new Map((p.data ?? []).map((x) => [x.id, x.full_name]));
  return (id?: string | null) => (id ? (map.get(id) ?? "—") : "—");
}

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await supabase.from("teams").select("id, name").order("name")).data ?? [],
    staleTime: 10 * 60_000,
  });
}

export function useBuildings() {
  return useQuery({
    queryKey: ["buildings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("buildings").select("*").order("code");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useUnreadCount(uid?: string) {
  return useQuery({
    enabled: !!uid,
    queryKey: ["unread", uid],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid!)
        .is("read_at", null);
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
}

/** Tasks the user owns or contributes to (RLS limits the rest). */
export function useMyTasks(uid?: string) {
  return useQuery({
    enabled: !!uid,
    queryKey: ["tasks", "mine", uid],
    queryFn: async () => {
      const [{ data: own, error }, { data: contrib }] = await Promise.all([
        supabase
          .from("tasks")
          .select("*, projects!tasks_project_id_fkey(title)")
          .eq("owner_id", uid!)
          .order("due_date"),
        supabase
          .from("task_contributors")
          .select("tasks!task_contributors_task_id_fkey(*, projects!tasks_project_id_fkey(title))")
          .eq("user_id", uid!),
      ]);
      if (error) throw error;
      const seen = new Set((own ?? []).map((t) => t.id));
      const extra = (contrib ?? [])
        .map((c) => c.tasks)
        .filter((t): t is NonNullable<typeof t> => !!t && !seen.has(t.id));
      return [...(own ?? []), ...extra].sort((a, b) => a.due_date.localeCompare(b.due_date));
    },
  });
}

export function useTeamTasks(enabled: boolean, teamId?: string | null) {
  return useQuery({
    enabled,
    queryKey: ["tasks", "team", teamId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("tasks")
        .select("*, projects!tasks_project_id_fkey(title)")
        .order("due_date");
      if (teamId) q = q.eq("team_id", teamId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export const isOpen = (s: string) => s !== "مكتملة" && s !== "ملغاة";
