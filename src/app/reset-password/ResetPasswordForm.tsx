"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/ui/BrandLogo";
import type { CourseBranding } from "@/types/branding";

function ResetPasswordForm({ brand }: { brand: CourseBranding }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tokenValid, setTokenValid] = useState<boolean | null>(null);

    useEffect(() => {
        if (!token) {
            setTokenValid(false);
            setError("Invalid reset link. Please request a new password reset.");
        } else {
            setTokenValid(true);
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");

        if (!password) {
            setError("Please enter a new password.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to reset password.");
            }

            setSuccessMessage("Password changed successfully! Redirecting to login...");
            setTimeout(() => router.push("/login"), 2500);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <div className="bg-[#0D1B2A] rounded-2xl p-3 flex items-center justify-center shadow-sm">
                        <BrandLogo size={52} primaryColor="#FFFFFF" arrowColor="#4CAF50" logoUrl={brand.logoUrl} />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-center text-[#1f2937] mb-2">
                    {brand.name}
                </h1>
                <p className="text-center text-[#6b7280] text-sm mb-8">
                    Set a New Password
                </p>

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-600 text-sm text-center">{error}</p>
                    </div>
                )}

                {/* Success */}
                {successMessage && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-600 text-sm text-center">{successMessage}</p>
                    </div>
                )}

                {tokenValid === false ? (
                    <div className="text-center space-y-4">
                        <p className="text-[#6b7280] text-sm">
                            This reset link is invalid or has expired.
                        </p>
                        <button
                            onClick={() => router.push("/login")}
                            className="w-full bg-[#059669] text-white font-semibold py-3 rounded-full hover:bg-[#047857] transition-colors duration-200"
                        >
                            Back to Login
                        </button>
                    </div>
                ) : !successMessage ? (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-[#1f2937] mb-2"
                            >
                                New Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                placeholder="Minimum 6 characters"
                                className="w-full px-4 py-3 border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-transparent transition-all text-sm"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="confirmPassword"
                                className="block text-sm font-medium text-[#1f2937] mb-2"
                            >
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                                placeholder="Re-enter your new password"
                                className="w-full px-4 py-3 border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-transparent transition-all text-sm"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-[#059669] text-white font-semibold py-3 rounded-full hover:bg-[#047857] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? "Saving..." : "Set New Password"}
                        </button>

                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => router.push("/login")}
                                className="text-sm text-[#6b7280] hover:text-[#1f2937] transition-colors"
                            >
                                Back to Login
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="text-center">
                        <button
                            onClick={() => router.push("/login")}
                            className="w-full bg-[#059669] text-white font-semibold py-3 rounded-full hover:bg-[#047857] transition-colors duration-200"
                        >
                            Go to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ResetPasswordPageClient({ brand }: { brand: CourseBranding }) {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#059669]"></div>
            </div>
        }>
            <ResetPasswordForm brand={brand} />
        </Suspense>
    );
}
