"use client";

export const TRACKING_MIN_SECONDS = 30;
export const TRACKING_MAX_SECONDS = 3600;
export const TRACKING_DEFAULT_SECONDS = 60;

/** Per-competition field-tracking switch and interval (Android app, see /app). */
export default function TrackingSettingsFields({
  enabled,
  interval,
  onEnabled,
  onInterval,
}: {
  enabled: boolean;
  interval: number | "";
  onEnabled: (v: boolean) => void;
  onInterval: (v: number | "") => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={enabled}
          onChange={(e) => onEnabled(e.target.checked)}
        />
        <span>
          <span className="font-medium">Field location tracking (ফিল্ড লোকেশন ট্র্যাকিং)</span>
          <span className="block text-xs text-slate-500">
            Students tap &quot;ফিল্ডে যাচ্ছি&quot; in the ASSDI Portal Android app; staff see them on the live map until they tap
            &quot;ফিরে এসেছি&quot;. Turning this off ends any running sessions.
          </span>
        </span>
      </label>
      {enabled && (
        <label className="block text-sm">
          <span className="font-medium">Send location every (seconds)</span>
          <input
            type="number"
            min={TRACKING_MIN_SECONDS}
            max={TRACKING_MAX_SECONDS}
            step={1}
            className="mt-1 block w-40 border rounded-md p-2 bg-white"
            value={interval}
            onChange={(e) => onInterval(e.target.value === "" ? "" : Number(e.target.value))}
          />
          <span className="block text-xs text-slate-500 mt-1">
            Minimum {TRACKING_MIN_SECONDS}, default {TRACKING_DEFAULT_SECONDS}. Shorter intervals use more battery.
          </span>
        </label>
      )}
    </div>
  );
}

/** Returns an error message, or null when the settings can be saved. */
export function trackingSettingsError(enabled: boolean, interval: number | ""): string | null {
  if (!enabled) return null;
  if (interval === "" || !Number.isInteger(interval) || interval < TRACKING_MIN_SECONDS || interval > TRACKING_MAX_SECONDS)
    return `Tracking interval must be a whole number between ${TRACKING_MIN_SECONDS} and ${TRACKING_MAX_SECONDS} seconds.`;
  return null;
}
