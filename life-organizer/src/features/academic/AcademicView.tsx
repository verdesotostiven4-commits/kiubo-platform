"use client";

import { PracticeLogger } from "./components/PracticeLogger";
import { ExamGradeList } from "./components/ExamGradeList";
import type { PracticeLog, ExamGrade, SubjectOption } from "./queries";

interface AcademicViewProps {
  practices: PracticeLog[];
  examGrades: ExamGrade[];
  subjects: SubjectOption[];
}

export function AcademicView({
  practices,
  examGrades,
  subjects,
}: AcademicViewProps) {
  return (
    <div className="space-y-4">
      <PracticeLogger initialPractices={practices} />
      <ExamGradeList initialGrades={examGrades} subjects={subjects} />
    </div>
  );
}
