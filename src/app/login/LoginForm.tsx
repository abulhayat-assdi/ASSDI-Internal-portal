"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import BrandLogo from "@/components/ui/BrandLogo";
import type { CourseBranding } from "@/types/branding";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm({ brand }: { brand: CourseBranding }) {
    const { loginWithEmail, sendPasswordReset } = useAuth();
    const searchParams = useSearchParams();
    const nextUrl = searchParams.get("next");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState("");

    // Email validation
    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");

        // Validate email
        if (!email) {
            setError("Email is required");
            return;
        }
        if (!validateEmail(email)) {
            setError("Please enter a valid email");
            return;
        }

        // Validate password
        if (!password) {
            setError("Password is required");
            return;
        }

        setIsSubmitting(true);

        try {
            await loginWithEmail(email, password);
            
            // Redirect to ?next= param (e.g. admin subdomain) or default dashboard
            const safeDomains = [
                process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tasm-skill.asf.bd',
                'localhost',
            ];
            const isAllowed = nextUrl && safeDomains.some(d => nextUrl.includes(d));
            window.location.href = isAllowed ? nextUrl! : "/dashboard";
            return;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to login. Please try again.";
            setError(errorMessage);
            setIsSubmitting(false); // Only reset on error
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");

        if (!resetEmail) {
            setError("Please enter your email address");
            return;
        }
        if (!validateEmail(resetEmail)) {
            setError("Please enter a valid email");
            return;
        }

        setIsSubmitting(true);

        try {
            await sendPasswordReset(resetEmail);
            setSuccessMessage("Password reset email sent! Check your inbox.");
            setResetEmail("");
            setTimeout(() => {
                setShowForgotPassword(false);
                setSuccessMessage("");
            }, 3000);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to send reset email. Please try again.";
            setError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">

            {/* Login Card */}
            <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div className="bg-[#0D1B2A] rounded-2xl p-3 flex items-center justify-center shadow-sm">
                        <BrandLogo size={52} primaryColor="#FFFFFF" arrowColor="#4CAF50" logoUrl={brand.logoUrl} />
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-center text-[#1f2937] mb-2">
                    {brand.name}
                </h1>

                {/* Subtitle */}
                <p className="text-center text-[#6b7280] text-sm mb-8">
                    Internal Portal Access
                </p>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-600 text-sm text-center">{error}</p>
                    </div>
                )}

                {/* Success Message */}
                {successMessage && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-600 text-sm text-center">{successMessage}</p>
                    </div>
                )}

                {!showForgotPassword ? (
                    <>
                        {/* Login Form */}
                        <form onSubmit={handleEmailLogin} className="space-y-5">
                            {/* Email Field */}
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm font-medium text-[#1f2937] mb-2"
                                >
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setError("");
                                    }}
                                    placeholder="Enter your email"
                                    className="w-full px-4 py-3 border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-transparent transition-all text-sm"
                                />
                            </div>

                            {/* Password Field */}
                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-[#1f2937] mb-2"
                                >
                                    Password
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setError("");
                                    }}
                                    placeholder="Enter Password"
                                    className="w-full px-4 py-3 border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-transparent transition-all text-sm"
                                />
                            </div>

                            {/* Forgot Password Link */}
                            <div className="text-right">
                                <button
                                    type="button"
                                    onClick={() => setShowForgotPassword(true)}
                                    className="text-sm text-[#059669] hover:text-[#047857] transition-colors"
                                >
                                    Forgot Password?
                                </button>
                            </div>

                            {/* Sign In Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-[#059669] text-white font-semibold py-3 rounded-full hover:bg-[#047857] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? "Signing in..." : "Sign In"}
                            </button>
                        </form>
                    </>
                ) : (
                    <>
                        {/* Forgot Password Form */}
                        <form onSubmit={handlePasswordReset} className="space-y-5">
                            <div>
                                <label
                                    htmlFor="resetEmail"
                                    className="block text-sm font-medium text-[#1f2937] mb-2"
                                >
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    id="resetEmail"
                                    value={resetEmail}
                                    onChange={(e) => {
                                        setResetEmail(e.target.value);
                                        setError("");
                                    }}
                                    placeholder="Enter your email"
                                    className="w-full px-4 py-3 border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-transparent transition-all text-sm"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-[#059669] text-white font-semibold py-3 rounded-full hover:bg-[#047857] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? "Sending..." : "Send Reset Email"}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setShowForgotPassword(false);
                                    setError("");
                                    setResetEmail("");
                                }}
                                className="w-full text-sm text-[#6b7280] hover:text-[#1f2937] transition-colors"
                            >
                                Back to Login
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

export default function LoginPageClient({ brand }: { brand: CourseBranding }) {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
            <LoginForm brand={brand} />
        </Suspense>
    );
}
