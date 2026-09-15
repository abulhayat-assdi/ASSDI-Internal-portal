"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to manage and fetch sidebar notification counts from the custom API.
 * Replaces direct Firestore polling.
 */
export function useSidebarNotifications() {
    const { userProfile, loading } = useAuth();
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [trigger, setTrigger] = useState(0);

    const refreshNotifications = useCallback(() => setTrigger(prev => prev + 1), []);

    const markPageAsVisited = useCallback((path: string) => {
        if (typeof window !== "undefined") {
            const now = Date.now();
            localStorage.setItem(`lastVisited_${path}`, now.toString());
            // Immediately clear the count for this path in the UI
            setCounts(prev => ({ ...prev, [path]: 0 }));
            refreshNotifications();
        }
    }, [refreshNotifications]);

    useEffect(() => {
        if (loading || !userProfile || !userProfile.role) return;
        let isMounted = true;

        const fetchCounts = async () => {
            try {
                // Collect all last visited timestamps from localStorage
                const paths = [
                    "/dashboard/homework",
                    "/dashboard/admin/manage-homework",
                    "/dashboard/feedback"
                ];
                
                const queryParams = new URLSearchParams();
                paths.forEach(path => {
                    const stored = localStorage.getItem(`lastVisited_${path}`);
                    if (stored) {
                        queryParams.append(`lastVisited_${path}`, stored);
                    }
                });

                const res = await fetch(`/api/notifications/counts?${queryParams.toString()}`);
                if (!res.ok) throw new Error("Failed to fetch counts");
                
                const data = await res.json();
                
                if (isMounted && data.counts) {
                    setCounts(data.counts);
                }
            } catch (error) {
                console.error("Error fetching notification counts:", error);
            }
        };

        fetchCounts();

        // Re-fetch periodically every 5 minutes
        const interval = setInterval(fetchCounts, 5 * 60 * 1000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [userProfile, loading, trigger]);

    return { counts, markPageAsVisited, refreshNotifications };
}
