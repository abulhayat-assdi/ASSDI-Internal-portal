"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getRoutineByBatch, BatchRoutine } from "@/services/routinesService";
import ImageLightbox from "@/components/ui/ImageLightbox";

export default function StudentRoutinePage() {
    const { userProfile, loading: authLoading } = useAuth();
    const [routine, setRoutine] = useState<BatchRoutine | null>(null);
    const [loading, setLoading] = useState(true);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    useEffect(() => {
        const load = async () => {
            if (!userProfile?.studentBatchName) { setLoading(false); return; }
            try {
                setRoutine(await getRoutineByBatch(userProfile.studentBatchName));
            } catch (err) {
                console.error("Error loading routine:", err);
            } finally {
                setLoading(false);
            }
        };
        if (!authLoading) load();
    }, [userProfile, authLoading]);

    if (authLoading || loading) {
        return (
            <div className="flex flex-col justify-center items-center h-[60vh] gap-4">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin" />
                </div>
                <p className="text-sm text-gray-400 font-medium animate-pulse">Loading your routine...</p>
            </div>
        );
    }

    if (!userProfile?.studentBatchName) {
        return (
            <div className="px-4 py-8 max-w-lg mx-auto text-center mt-6 sm:mt-16">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5 text-4xl">🎓</div>
                <h1 className="no-gradient text-2xl font-bold text-gray-800 mb-2">No Batch Assigned</h1>
                <p className="text-gray-500 text-sm">Please contact the admin to assign you to a batch.</p>
            </div>
        );
    }

    if (!routine) {
        return (
            <div className="px-4 py-8 max-w-lg mx-auto text-center mt-6 sm:mt-16">
                <div className="text-5xl mb-4">📅</div>
                <h1 className="no-gradient text-2xl font-bold text-gray-800 mb-2">No Routine Yet</h1>
                <p className="text-gray-500 text-sm">Your batch routine hasn&apos;t been posted yet.</p>
            </div>
        );
    }

    return (
        <div>
            <div className="max-w-[1100px] mx-auto">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div style={{ backgroundColor: "#0D1B4A", textAlign: "center", padding: "12px 24px" }}>
                        <div style={{ color: "#FFFFFF", fontSize: "clamp(0.95rem, 1.4vw, 1.25rem)", fontWeight: 800, letterSpacing: "0.02em" }}>
                            Class Routine — {userProfile.studentBatchName}
                        </div>
                    </div>
                    <div className="p-2 sm:p-3 md:p-5">
                        <button 
                            onClick={() => setLightboxOpen(true)}
                            className="w-full text-left focus:outline-none block" 
                            title="Click to zoom"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={routine.fileUrl}
                                alt={`${userProfile.studentBatchName} class routine`}
                                className="w-full h-auto rounded-lg border border-gray-100 hover:opacity-95 transition-opacity cursor-zoom-in"
                            />
                        </button>
                    </div>
                </div>
            </div>

            {lightboxOpen && (
                <ImageLightbox
                    src={routine.fileUrl}
                    alt={`${userProfile.studentBatchName} class routine`}
                    onClose={() => setLightboxOpen(false)}
                />
            )}
        </div>
    );
}
