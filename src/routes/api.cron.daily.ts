import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Daily job endpoint (07:00 Asia/Riyadh, Sunday–Thursday):
 * creates the month's Jawlati inspections, refreshes time-based task classes,
 * and writes reminder / overdue / escalation notifications. Idempotent.
 * Called by a scheduler with `Authorization: Bearer <LOVABLE_CRON_SECRET>`.
 * The database also schedules the same job with pg_cron when that extension is available.
 */
export const Route = createFileRoute("/api/cron/daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("_daily_job" as never);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        return Response.json({ ok: true, notifications: data });
      },
    },
  },
});
