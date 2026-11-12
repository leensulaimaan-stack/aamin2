import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useMe } from "@/lib/auth";
import { ListSkeleton, PageTitle, Panel } from "@/components/kit";
import { TaskForm, type TaskFormValue } from "@/components/task-form";

export const Route = createFileRoute("/_authenticated/tasks/new")({
  head: () => ({ meta: [{ title: "مهمة جديدة | آمن" }] }),
  component: NewTask,
});

function NewTask() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: async (v: TaskFormValue) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: v.title.trim(),
          description: v.description.trim() || null,
          team_id: v.team_id,
          owner_id: v.owner_id,
          start_date: v.start_date || null,
          due_date: v.due_date,
          priority: v.priority,
          goal_id: v.goal_id || null,
        })
        .select("id, final_class")
        .single();
      if (error) throw error;
      if (v.contributors.length) {
        const { error: e2 } = await supabase
          .from("task_contributors")
          .insert(v.contributors.map((user_id) => ({ task_id: data.id, user_id })));
        if (e2) throw e2; // the database re-classifies the task when contributors are added
      }
      return data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("أُنشئت المهمة");
      navigate({ to: "/tasks/$id", params: { id: d.id } });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="مهمة جديدة" sub="لكل مهمة مسؤول واحد وموعد واضح" />
      <Panel>
        {me ? (
          <TaskForm
            me={me}
            submitLabel="إنشاء المهمة"
            busy={create.isPending}
            onSubmit={(v) => create.mutate(v)}
          />
        ) : (
          <ListSkeleton rows={3} />
        )}
      </Panel>
    </div>
  );
}
