// ============================================================
// Auth Types — No Firebase dependency
// ============================================================

export type UserRole = "super_admin" | "admin" | "teacher" | "student";

export interface UserProfile {
    id: string;
    uid?: string; // Backward compatibility for Firebase
    email: string;
    displayName: string;
    role: UserRole;
    courseId?: string | null;
    teacherId?: string;
    studentBatchName?: string;
    studentRoll?: string;
    profileImageUrl?: string;
    permissions?: string[];
    createdAt: Date | string;
    lastLoginAt?: Date | string;
    /** Set when this session is a super-admin "Login as admin" session */
    impersonatedBy?: string | null;
    impersonatedAt?: string | null;
}

export interface AuthContextType {
    user: UserProfile | null;
    userProfile?: UserProfile | null; // Backward compatibility alias
    loading: boolean;
    loginWithEmail: (email: string, password: string) => Promise<UserProfile>;
    registerWithEmail: (email: string, password: string, name: string, batchName: string, roll: string) => Promise<UserProfile>;
    logout: () => Promise<void>;
    sendPasswordReset: (email: string) => Promise<void>;
    refreshProfile: () => Promise<void>;
    hasPermission: (key: string) => boolean;
}
