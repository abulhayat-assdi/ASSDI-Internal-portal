// ============================================================
// teacherService — All Firestore calls replaced with API calls
// ============================================================

export interface Teacher {
    id: string;
    teacherId: string;
    name: string;
    designation: string;
    about: string;
    phone: string;
    email: string;
    loginEmail?: string;
    profileImageUrl?: string;
    imageObjectPosition?: string;
    isAdmin: boolean;
    order?: number;
}

const TEACHER_IMAGES: Record<string, string> = {
    "Golam Kibria": "/images/instructors/golam-kibria.jpeg",
    "Shaibal Shariar": "/images/instructors/shaibal-shariar.jpg",
    "Mohammad Abu Zabar Rezvhe": "/images/instructors/abu-zabar-rezvhe.jpg",
    "Md. Nesar Uddin": "/images/instructors/nesar-uddin.jpg",
    "Abul Hayat": "/images/instructors/abul-hayat.jpg",
    "M M Naim Amran": "/images/instructors/naim-amran.jpg",
};

const applyFallbackImage = (teacher: Teacher): Teacher => {
    if (!teacher.profileImageUrl && TEACHER_IMAGES[teacher.name]) {
        return { ...teacher, profileImageUrl: TEACHER_IMAGES[teacher.name] };
    }
    return teacher;
};

export const getAllTeachers = async (): Promise<Teacher[]> => {
    const res = await fetch("/api/teachers", { cache: "no-store" });
    if (!res.ok) return [];
    const teachers: Teacher[] = await res.json();
    return teachers.map(applyFallbackImage).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

export const addTeacher = async (data: Omit<Teacher, "id"> & { password: string }): Promise<string> => {
    const res = await fetch("/api/admin/create-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            teacherId: data.teacherId,
            loginEmail: data.loginEmail,
            displayEmail: data.email,
            password: data.password,
            name: data.name,
            phone: data.phone,
            designation: data.designation,
            about: data.about,
            isAdmin: data.isAdmin,
            order: data.order,
            profileImageUrl: data.profileImageUrl,
        }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to add teacher.");
    return result.uid;
};

export const updateTeacher = async (id: string, data: Partial<Omit<Teacher, "id">>): Promise<void> => {
    const res = await fetch("/api/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
    });
    if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Failed to update teacher.");
    }
};

export const deleteTeacher = async (id: string): Promise<void> => {
    const res = await fetch(`/api/teachers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Failed to delete teacher.");
    }
};

// ─── Backward-compat aliases ─────────────────────────────────

/** Paginated teachers — returns all (pagination is client-side for now) */
export const getTeachersPaginated = async (
    pageSize = 10,
    cursor?: string
): Promise<{ teachers: Teacher[]; nextCursor: string | undefined; hasMore: boolean }> => {
    const teachers = await getAllTeachers();
    return { teachers, nextCursor: undefined, hasMore: false };
};
