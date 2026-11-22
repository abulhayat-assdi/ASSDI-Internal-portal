/**
 * Feature switches that really change something for students. Anything not
 * listed here is not shown or settable (ads are the super admin's ad
 * settings, never a flag). Values come from typing_game.feature_flags
 * (platform default, optionally overridden per organization).
 */
export type FeatureKey = "MISSIONS_ENABLED" | "ARCADE_GAMES_ENABLED" | "BATCH_COMPETITION_ENABLED";

export interface FeatureMeta {
  key: FeatureKey;
  title: string;
  /** What students get while it is on. */
  on: string;
  /** What changes when it is off. */
  off: string;
}

export const FEATURES: FeatureMeta[] = [
  {
    key: "ARCADE_GAMES_ENABLED",
    title: "Typing Arcade গেম",
    on: "স্টুডেন্টরা Games পেজে ৮টা টাইপিং গেম খেলতে, কয়েন দিয়ে আনলক করতে পারে।",
    off: "Games মেনু লুকানো থাকবে, গেম শুরু করা যাবে না।",
  },
  {
    key: "BATCH_COMPETITION_ENABLED",
    title: "ব্যাচ কম্পিটিশন",
    on: "ব্যাচমেটকে চ্যালেঞ্জ বা লাইভ রেসে ইনভাইট করে টাইপিং প্রতিযোগিতা করা যায়।",
    off: "Compete মেনু লুকানো থাকবে, নতুন চ্যালেঞ্জ পাঠানো যাবে না।",
  },
  {
    key: "MISSIONS_ENABLED",
    title: "মিশন",
    on: "দৈনিক/সাপ্তাহিক মিশন আর টিচারের দেওয়া মিশন দেখা ও খেলা যায়।",
    off: "Missions মেনু লুকানো থাকবে।",
  },
];

export const isFeatureKey = (k: string): k is FeatureKey => FEATURES.some((f) => f.key === k);

export type FeatureMap = Record<FeatureKey, boolean>;

/** Defaults while flags cannot be read: everything students already had stays on. */
export const FEATURES_DEFAULT: FeatureMap = {
  MISSIONS_ENABLED: true,
  ARCADE_GAMES_ENABLED: true,
  BATCH_COMPETITION_ENABLED: true,
};
