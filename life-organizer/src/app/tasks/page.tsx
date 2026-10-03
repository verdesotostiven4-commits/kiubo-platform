import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTasks, getSubjects } from "@/features/tasks/queries";
import { TasksView } from "@/features/tasks/TasksView";

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [tasks, subjects] = await Promise.all([getTasks(), getSubjects()]);

  return (
    <main className="flex-1 px-4 sm:px-6 py-6 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-lila-950">Tareas</h1>
        <p className="text-sm text-lila-500 mt-1">
          Organiza estudio, personal y deseos por prioridad.
        </p>
      </div>

      <TasksView initialTasks={tasks} subjects={subjects} />
    </main>
  );
}
