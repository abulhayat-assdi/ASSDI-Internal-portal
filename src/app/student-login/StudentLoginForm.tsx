"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AccessBlockedError, useAuth } from "@/contexts/AuthContext";
import BrandLogo from "@/components/ui/BrandLogo";
import type { CourseBranding } from "@/types/branding";
import Link from "next/link";

// Minimal type for student info returned by the API proxy
interface PublicStudentInfo {
    batchName: string;
    roll: string;
    name: string;
    batchType?: string;
}

const EyeIcon = ({ className }: { className: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);

const EyeSlashIcon = ({ className }: { className: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
);

export default function StudentLoginForm({ brand }: { brand: CourseBranding }) {
    const { loading, loginWithEmail, registerWithEmail, sendPasswordReset } = useAuth();
    const router = useRouter();

    // UI States
    const [isRegistering, setIsRegistering] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [authError, setAuthError] = useState("");
    const [isBlocked, setIsBlocked] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Form data
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // Registration specific data
    const [batchName, setBatchName] = useState("");
    const [roll, setRoll] = useState("");
    
    // Remote data
    const [batches, setBatches] = useState<string[]>([]);
    const [batchStudents, setBatchStudents] = useState<PublicStudentInfo[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);

    // Fetch batches on mount via secure API proxy (no direct Firestore access)
    useEffect(() => {
        const loadBatches = async () => {
            try {
                const res = await fetch("/api/auth/batches?mode=batches");
                if (res.ok) {
                    const data = await res.json();
                    setBatches(data.batches || []);
                }
            } catch (err) {
                console.error("Failed to load batches", err);
            }
        };
        loadBatches();
    }, []);

    // Fetch students when a batch is selected (via secure API proxy)
    useEffect(() => {
        if (!batchName) {
            setBatchStudents([]);
            setRoll("");
            setName("");
            return;
        }

        const fetchStudents = async () => {
            setLoadingStudents(true);
            try {
                const res = await fetch(`/api/auth/batches?mode=students&batchName=${encodeURIComponent(batchName)}`);
                if (res.ok) {
                    const data = await res.json();
                    setBatchStudents(data.students || []);
                }
            } catch (error) {
                console.error("Failed to fetch rolling list", error);
            } finally {
                setLoadingStudents(false);
            }
        };

        fetchStudents();
    }, [batchName]);

    // Auto-fill name when roll changes
    useEffect(() => {
        if (roll && batchStudents.length > 0) {
            const student = batchStudents.find(s => s.roll === roll);
            if (student) {
                setName(student.name);
            } else {
                setName("");
            }
        }
    }, [roll, batchStudents]);

    const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError("");
        setIsBlocked(false);
        setSuccessMessage("");
        setIsSubmitting(true);

        try {
            if (!validateEmail(email)) throw new Error("Please enter a valid email address");

            if (isRegistering) {
                if (!batchName) throw new Error("Please select your Batch");
                if (!roll) throw new Error("Please select your Roll Number");
                if (!name) throw new Error("Name is required. Ensure your Roll is correct.");
                if (password.length < 6) throw new Error("Password must be at least 6 characters long.");
                
                // Directly pass batch and roll so profile maps at creation
                await registerWithEmail(email, password, name, batchName, roll);
            } else {
                if (!password) throw new Error("Password is required");
                await loginWithEmail(email, password);
            }

            // 3. Force a hard redirect to bypass Next.js client-side router cache
            // This ensures server components render with the fresh session cookie on first login
            window.location.href = "/student-dashboard";
            return;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Authentication failed.";
            setIsBlocked(err instanceof AccessBlockedError);
            setAuthError(errorMessage);
            setIsSubmitting(false); // Only reset on error
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError("");
        setSuccessMessage("");

        if (!email) {
            setAuthError("Please enter your email address to reset password.");
            return;
        }
        if (!validateEmail(email)) {
            setAuthError("Please enter a valid email address.");
            return;
        }

        setIsSubmitting(true);
        try {
            await sendPasswordReset(email);
            setSuccessMessage("Password reset email sent! Please check your inbox.");
            setTimeout(() => {
                setShowForgotPassword(false);
                setSuccessMessage("");
                setPassword("");
            }, 5000);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to send reset email.";
            setAuthError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4CAF50]"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50 py-12">
            <div className="mb-8">
                <Link href="/">
                    <div className="bg-[#1e3a5f] rounded-2xl p-3 shadow-lg hover:shadow-xl transition-shadow border border-[#2d5278] cursor-pointer">
                        <BrandLogo size={42} primaryColor="#FFFFFF" arrowColor="#4CAF50" logoUrl={brand.logoUrl} />
                    </div>
                </Link>
                <p className="mt-3 text-center text-base font-semibold text-gray-800">{brand.name}</p>
            </div>

            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 animate-in fade-in zoom-in duration-300">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {showForgotPassword ? "Reset Password" : (isRegistering ? "Student Registration" : "Student Portal Login")}
                    </h2>
                    <p className="text-sm text-gray-500 mt-2">
                        {showForgotPassword 
                            ? "Enter your email to receive a password reset link."
                            : (isRegistering ? "Select your batch & roll to create your account." : "Welcome back to your internal portal.")}
                    </p>
                </div>

                {authError && (
                    isBlocked ? (
                        /* Not something a retry fixes — say so plainly and point
                           the student at the only thing that will help. */
                        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                            <svg className="w-6 h-6 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                            <div>
                                <p className="font-bold text-amber-900 text-sm mb-1">অ্যাক্সেস বন্ধ</p>
                                <p className="text-amber-800 text-sm leading-relaxed">{authError}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100 flex items-start gap-3">
                            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium leading-relaxed">{authError}</span>
                        </div>
                    )
                )}

                {successMessage && (
                    <div className="mb-6 p-4 rounded-xl bg-green-50 text-green-700 text-sm border border-green-100 flex items-start gap-3">
                        <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-medium leading-relaxed">{successMessage}</span>
                    </div>
                )}

                {showForgotPassword ? (
                    <form onSubmit={handlePasswordReset} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="reset-email">Email address</label>
                            <input
                                id="reset-email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full py-3 px-4 rounded-xl border-gray-300 bg-gray-50 focus:bg-white focus:border-[#4CAF50] focus:ring-[#4CAF50] transition-colors shadow-sm placeholder:text-gray-400"
                                placeholder="student@example.com"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white shadow-md transition-all mt-6
                                ${isSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-[#4CAF50] hover:bg-[#43A047]"}
                            `}
                        >
                            {isSubmitting ? "Sending..." : "Send Reset Email"}
                        </button>

                        <div className="text-center mt-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowForgotPassword(false);
                                    setAuthError("");
                                    setSuccessMessage("");
                                }}
                                className="text-sm font-semibold text-gray-500 hover:text-[#1e3a5f]"
                            >
                                Back to Login
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleAuthSubmit} className="space-y-5">
                        {isRegistering && (
                            <>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Batch Name</label>
                                    <select
                                        required
                                        value={batchName}
                                        onChange={(e) => setBatchName(e.target.value)}
                                        className="block w-full py-3 px-4 rounded-xl border-gray-300 bg-gray-50 focus:bg-white focus:border-[#4CAF50] focus:ring-[#4CAF50] transition-colors shadow-sm text-gray-900"
                                    >
                                        <option value="" disabled>Select your batch</option>
                                        {batches.map(b => (
                                            <option key={b} value={b}>{b}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex justify-between">
                                        Roll Number
                                        {loadingStudents && <span className="text-xs text-blue-500 animate-pulse font-normal">Loading rolls...</span>}
                                    </label>
                                    <select
                                        required
                                        value={roll}
                                        onChange={(e) => setRoll(e.target.value)}
                                        disabled={!batchName || loadingStudents}
                                        className="block w-full py-3 px-4 rounded-xl border-gray-300 bg-gray-50 focus:bg-white focus:border-[#4CAF50] focus:ring-[#4CAF50] transition-colors shadow-sm text-gray-900 disabled:opacity-60"
                                    >
                                        <option value="" disabled>
                                            {!batchName ? "Select batch first" : (loadingStudents ? "Loading..." : "Select your roll")}
                                        </option>
                                        {batchStudents.map(s => (
                                            <option key={s.roll} value={s.roll}>{s.roll}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name (Auto-filled)</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={name}
                                        className="block w-full py-3 px-4 rounded-xl border-gray-300 bg-gray-100 text-gray-600 shadow-sm outline-none cursor-not-allowed font-medium placeholder:font-normal placeholder:text-gray-400"
                                        placeholder={batchName && roll ? "Name not found in record" : "Select batch & roll to populate"}
                                    />
                                    {batchName && roll && !name && (
                                        <p className="text-xs text-red-500 mt-1 italic">
                                            Warning: Your roll number isn&apos;t in our active database. Please contact admin.
                                        </p>
                                    )}
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="login-email">Email address</label>
                            <input
                                id="login-email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full py-3 px-4 rounded-xl border-gray-300 bg-gray-50 focus:bg-white focus:border-[#4CAF50] focus:ring-[#4CAF50] transition-colors shadow-sm placeholder:text-gray-400"
                                placeholder="student@example.com"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-semibold text-gray-700">Password</label>
                                {!isRegistering && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowForgotPassword(true);
                                            setAuthError("");
                                            setSuccessMessage("");
                                        }}
                                        className="text-xs font-semibold text-[#4CAF50] hover:text-[#43A047]"
                                    >
                                        Forgot Password?
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full py-3 pl-4 pr-11 rounded-xl border-gray-300 bg-gray-50 focus:bg-white focus:border-[#4CAF50] focus:ring-[#4CAF50] transition-colors shadow-sm placeholder:text-gray-400"
                                    placeholder={isRegistering ? "Create a secure password" : "Enter your password"}
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#4CAF50]"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || (isRegistering && !name)}
                            className={`w-full py-3.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white shadow-md transition-all mt-6
                                ${(isSubmitting || (isRegistering && !name))
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-[#4CAF50] hover:bg-[#43A047] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4CAF50]"
                                }
                            `}
                        >
                            {isSubmitting ? (isRegistering ? "Registering..." : "Signing in...") : (isRegistering ? "Complete Registration" : "Login as Student")}
                        </button>
                    </form>
                )}

                {!showForgotPassword && (
                    <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-2 text-sm">
                        <span className="text-gray-500">
                            {isRegistering ? "Already have a student account?" : "Are you a new student?"}
                        </span>
                        <button
                            onClick={() => {
                                setIsRegistering(!isRegistering);
                                setAuthError("");
                                setSuccessMessage("");
                            }}
                            className="font-bold text-[#4CAF50] hover:text-[#43A047] hover:underline"
                        >
                            {isRegistering ? "Log In" : "Register Now"}
                        </button>
                    </div>
                )}
            </div>
            
            <div className="mt-8">
                 <Link href="/login" className="text-sm font-semibold text-gray-500 hover:text-[#1e3a5f] hover:underline">
                    Staff Login / Teacher Portal
                </Link>
            </div>
        </div>
    );
}
