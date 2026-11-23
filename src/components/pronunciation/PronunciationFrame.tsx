"use client";

/**
 * Shows the Bangla Pronunciation app inside the portal's page, beside the portal's own menu.
 *
 * The app lives on the same site under /pronunciation (a separate container behind the same proxy),
 * so the frame is same-origin: its own sign-in cookie works and it may use the microphone, which
 * next.config allows for the dashboards. The frame starts at the launcher, which checks access and
 * signs the person in (see src/lib/pronunciation/launch.ts); `embed=1` tells the launcher that a
 * signed-out person must be sent to the login page in the whole window, not inside the frame.
 */
export default function PronunciationFrame({ staff = false }: { staff?: boolean }) {
  const src = `/api/pronunciation/launch?embed=1${staff ? "&as=staff" : ""}`;
  return (
    <iframe
      src={src}
      title="Bangla Pronunciation"
      allow="microphone; autoplay"
      className="block w-full min-h-[480px] rounded-xl border border-gray-200 bg-white h-[calc(100dvh-10.5rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-11rem-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-7rem)]"
    />
  );
}
