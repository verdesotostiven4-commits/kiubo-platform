import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getRecentPractices,
  getExamGrades,
} from "@/features/academic/queries";
import { getSubjects } from "@/features/tasks/queries";
import { AcademicView } from "@/features/academic/AcademicView";

export default async function AcademicPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [practices, examGrades, subjects] = await Promise.all([
    getRecentPractices(),
    getExamGrades(),
    getSubjects(),
  ]);

  return (
    <main className="flex-1 px-4 sm:px-6 py-6 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-lila-950">Académico</h1>
        <p className="text-sm text-lila-500 mt-1">
          Prácticas laborales autónomas y notas de exámenes.
        </p>
      </div>

      <AcademicView
        practices={practices}
        examGrades={examGrades}
        subjects={subjects}
      />
    </main>
  );
}
