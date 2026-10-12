"use client";

import { useEffect, useState } from "react";
import { MOBILE_USER_AGENT } from "@/lib/typing-exam/device";

const TOUCH_ONLY_QUERY = "(hover: none) and (pointer: coarse)";

/**
 * Whether the device's primary input is a finger — a phone or tablet — rather
 * than a mouse/trackpad. Screen width is deliberately not the test: a phone in
 * "Desktop site" mode reports a wide viewport but is still a touch keyboard.
 *
 * Returns null until it has run in the browser, so callers can hold off
 * rendering either branch instead of flashing the wrong one.
 */
export function useTouchOnlyDevice(): boolean | null {
    const [touchOnly, setTouchOnly] = useState<boolean | null>(null);

    useEffect(() => {
        const query = window.matchMedia(TOUCH_ONLY_QUERY);
        const update = () => setTouchOnly(query.matches);
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);

    return touchOnly;
}

/**
 * Whether a typing exam must not be taken on this device. Touch-only devices,
 * plus anything the server's own check (isMobileRequest) would turn away — so
 * a student is never let into an exam whose session the server then refuses
 * to open.
 */
export function useExamDeviceBlocked(): boolean | null {
    const touchOnly = useTouchOnlyDevice();
    const [mobileAgent, setMobileAgent] = useState<boolean | null>(null);

    useEffect(() => {
        const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
        setMobileAgent(uaData?.mobile === true || MOBILE_USER_AGENT.test(navigator.userAgent));
    }, []);

    if (touchOnly === null || mobileAgent === null) return null;
    return touchOnly || mobileAgent;
}
