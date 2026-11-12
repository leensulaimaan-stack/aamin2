import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  full_name: z.string().trim().min(2).max(120),
  team_id: z.string().uuid(),
  role: z.enum(["employee", "manager", "admin"]),
  redirectTo: z.string().url(),
});

/** Admin-only: invite a colleague by email and set their role and team. */
export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) throw new Error("هذا الإجراء لمدير الإدارة فقط.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.full_name },
      redirectTo: data.redirectTo,
    });
    if (error || !inv.user)
      throw new Error(
        error?.message?.includes("already")
          ? "هذا البريد مسجّل مسبقاً."
          : `تعذّرت الدعوة: ${error?.message ?? ""}`,
      );

    const uid = inv.user.id;
    // the signup trigger created the profile; set team, name and role here (never from user metadata)
    const { error: pErr } = await supabaseAdmin.from("profiles").upsert({
      id: uid,
      full_name: data.full_name,
      email: data.email,
      team_id: data.team_id,
      is_active: true,
    });
    if (pErr) throw new Error(pErr.message);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: data.role });
    if (rErr) throw new Error(rErr.message);
    return { id: uid };
  });
