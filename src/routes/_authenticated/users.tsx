import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useMe } from "@/lib/auth";
import { useTeams } from "@/lib/data";
import { inviteUser } from "@/lib/admin.functions";
import {
  Avatar,
  ConfirmDialog,
  Empty,
  Field,
  inputCls,
  ListSkeleton,
  NativeSelect,
  PageTitle,
  Panel,
  Pill,
} from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "المستخدمون | آمن" }] }),
  component: Users,
});

const ROLE_LABEL: Record<string, string> = {
  employee: "موظف",
  manager: "مدير فريق",
  admin: "مدير الإدارة",
};

function Users() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const teams = useTeams();
  const [q, setQ] = useState("");
  const [invite, setInvite] = useState(false);
  const list = useQuery({
    enabled: !!me?.isAdmin,
    queryKey: ["users-admin"],
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roles = new Map<string, string>();
      (r.data ?? []).forEach((x) => {
        const cur = roles.get(x.user_id);
        const rank = { employee: 1, manager: 2, admin: 3 } as Record<string, number>;
        if (!cur || (rank[x.role] ?? 0) > (rank[cur] ?? 0)) roles.set(x.user_id, x.role);
      });
      return (p.data ?? []).map((x) => ({ ...x, role: roles.get(x.id) ?? null }));
    },
  });
  const inv = () => {
    qc.invalidateQueries({ queryKey: ["users-admin"] });
    qc.invalidateQueries({ queryKey: ["profiles"] });
  };
  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      if (id === me?.id && role !== "admin")
        throw new Error("لا يمكنك إزالة صلاحية مدير الإدارة عن نفسك.");
      const { error: d } = await supabase.from("user_roles").delete().eq("user_id", id);
      if (d) throw d;
      if (role) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: id, role: role as "employee" | "manager" | "admin" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("حُدّث الدور");
      inv();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const setProfile = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { team_id?: string | null; is_active?: boolean };
    }) => {
      if (id === me?.id && patch.is_active === false) throw new Error("لا يمكنك إيقاف حسابك.");
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      inv();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (me && !me.isAdmin) return <Empty>هذه الصفحة لمدير الإدارة فقط.</Empty>;
  const rows = (list.data ?? []).filter(
    (u) => !q || u.full_name.includes(q) || (u.email ?? "").includes(q),
  );
  const pending = rows.filter((u) => !u.role);

  return (
    <div className="space-y-4">
      <PageTitle
        title="المستخدمون"
        sub="الدعوة بالبريد، وتحديد الدور والفريق، وإيقاف الحسابات. لا يمكن لأي شخص التسجيل بنفسه والحصول على صلاحيات."
        action={
          <Button onClick={() => setInvite(true)}>
            <UserPlus className="h-4 w-4" /> دعوة مستخدم
          </Button>
        }
      />
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <input
          aria-label="بحث"
          placeholder="ابحث بالاسم أو البريد"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={inputCls + " ps-9"}
        />
      </div>
      {pending.length > 0 && (
        <Panel title="بانتظار التفعيل" className="border-arfaj bg-arfaj/40">
          <p className="mb-2 text-sm">
            حسابات سجّلت الدخول دون دعوة. حدّد دورها وفريقها لتفعيلها، أو أوقفها.
          </p>
        </Panel>
      )}
      {list.isLoading ? (
        <ListSkeleton />
      ) : (
        <div className="space-y-2">
          {[...pending, ...rows.filter((u) => u.role)].map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3"
            >
              <Avatar name={u.full_name} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {u.full_name} {!u.is_active && <Pill tone="ملغاة">موقوف</Pill>}{" "}
                  {!u.role && <Pill tone="soon">بلا دور</Pill>}
                </div>
                <div className="text-xs text-muted-foreground" dir="ltr">
                  {u.email}
                </div>
              </div>
              <NativeSelect
                ariaLabel="الفريق"
                value={u.team_id ?? ""}
                onChange={(v) => setProfile.mutate({ id: u.id, patch: { team_id: v || null } })}
                className="w-40"
              >
                <option value="">بلا فريق</option>
                {(teams.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                ariaLabel="الدور"
                value={u.role ?? ""}
                onChange={(v) => setRole.mutate({ id: u.id, role: v })}
                className="w-36"
              >
                <option value="">بلا دور</option>
                {Object.entries(ROLE_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={u.is_active}
                  onCheckedChange={(c) => setProfile.mutate({ id: u.id, patch: { is_active: c } })}
                  aria-label="الحساب فعّال"
                />
                {u.is_active ? "فعّال" : "موقوف"}
              </label>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        حسابات *@jawlati.demo تجريبية، وكلمة مرورها معروفة. أوقفها قبل استخدام النظام فعلياً.
      </p>
      {invite && <InviteDialog onClose={() => setInvite(false)} onDone={inv} />}
    </div>
  );
}

function InviteDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const teams = useTeams();
  const [v, setV] = useState({ email: "", full_name: "", team_id: "", role: "employee" });
  const send = useMutation({
    mutationFn: async () =>
      inviteUser({
        data: {
          ...v,
          role: v.role as "employee" | "manager" | "admin",
          redirectTo: `${window.location.origin}/reset`,
        },
      }),
    onSuccess: () => {
      toast.success("أُرسلت الدعوة. سيصل للمستخدم بريد لتعيين كلمة المرور.");
      onDone();
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="دعوة مستخدم"
      description="يصله بريد فيه رابط لتعيين كلمة المرور، ثم يدخل بدوره وفريقه مباشرة."
      confirmLabel="إرسال الدعوة"
      busy={send.isPending}
      confirmDisabled={!v.email.includes("@") || v.full_name.trim().length < 2 || !v.team_id}
      onConfirm={() => send.mutate()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الاسم الكامل" className="sm:col-span-2">
          <input
            className={inputCls}
            value={v.full_name}
            onChange={(e) => setV({ ...v, full_name: e.target.value })}
          />
        </Field>
        <Field label="البريد الإلكتروني" className="sm:col-span-2">
          <input
            type="email"
            dir="ltr"
            className={inputCls}
            value={v.email}
            onChange={(e) => setV({ ...v, email: e.target.value })}
          />
        </Field>
        <Field label="الفريق">
          <NativeSelect value={v.team_id} onChange={(x) => setV({ ...v, team_id: x })}>
            <option value="">اختر</option>
            {(teams.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="الدور">
          <NativeSelect value={v.role} onChange={(x) => setV({ ...v, role: x })}>
            {Object.entries(ROLE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </ConfirmDialog>
  );
}
