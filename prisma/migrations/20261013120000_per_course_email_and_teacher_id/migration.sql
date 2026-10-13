-- The same person can now hold an account in more than one course (a teacher
-- or coordinator shared between two courses). Each course keeps its own row —
-- own password, role and permissions — so email and teacher ID stop being
-- unique platform-wide and become unique per course instead.

-- DropIndex
DROP INDEX "users_email_key";

-- DropIndex
DROP INDEX "teachers_teacher_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "users_course_id_email_key" ON "users"("course_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_course_id_teacher_id_key" ON "teachers"("course_id", "teacher_id");
