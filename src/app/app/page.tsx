import type { Metadata } from "next";
import { apkDownloadPath, readAppRelease } from "@/lib/appRelease";

// Public download page for the ASSDI Portal Android app (no login; reachable on the
// root domain and every course subdomain). The APK and its manifest live in
// public/downloads and are written by `gradlew publishApk`.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ASSDI Portal Android App",
  description: "ASSDI Portal অ্যান্ড্রয়েড অ্যাপ ডাউনলোড ও সেটআপ",
};

async function apkInfo() {
  const release = await readAppRelease();
  if (!release) return null;
  return {
    href: apkDownloadPath(release),
    versionName: release.versionName,
    notes: release.notes,
    sizeMb: (release.size / 1024 / 1024).toFixed(1),
    updated: release.publishedAt
      ? new Date(release.publishedAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })
      : null,
  };
}

const steps: { title: string; body: string[] }[] = [
  {
    title: "১. অ্যাপ ডাউনলোড ও ইনস্টল করুন",
    body: [
      "উপরের \"ডাউনলোড করুন\" বাটনে চাপ দিন। ফাইলটি (asm-portal.apk) ডাউনলোড হবে।",
      "ডাউনলোড শেষ হলে নোটিফিকেশন বা Files / Downloads থেকে ফাইলটি খুলে Install চাপুন।",
    ],
  },
  {
    title: "২. \"Unknown sources\" / \"Install unknown apps\" চালু করুন",
    body: [
      "Play Store-এর বাইরের অ্যাপ বলে ফোন অনুমতি চাইতে পারে।",
      "Settings → Apps → (যে অ্যাপ দিয়ে ফাইল খুলছেন, যেমন Chrome বা Files) → Install unknown apps → Allow from this source চালু করুন।",
      "তারপর আবার ফাইলটি খুলে Install করুন। Play Protect সতর্ক করলে \"Install anyway\" চাপুন।",
    ],
  },
  {
    title: "২ক. ইনস্টল আটকে গেলে: আপনার ফোনের ব্র্যান্ড অনুযায়ী",
    body: [
      "সব ফোন (Google Play Protect): \"Unsafe app blocked\" দেখালে \"More details\" চাপুন, তারপর \"Install anyway\"। \"Send app for a security check?\" জিজ্ঞেস করলে \"Install without scanning\" বা স্ক্যান শেষে Install চাপুন।",
      "Samsung: \"Blocked by Auto Blocker\" দেখালে Settings → Security and privacy → Auto Blocker বন্ধ করুন, অ্যাপ ইনস্টল করুন, তারপর চাইলে Auto Blocker আবার চালু করুন। অ্যাপ একবার ইনস্টল হয়ে গেলে Auto Blocker চালু থাকলেও অ্যাপ চলবে।",
      "Xiaomi / Redmi / POCO: ইনস্টলের আগে \"Security scan\" চলবে। স্ক্যান শেষে \"Install anyway\" চাপুন। ঝুঁকির সতর্কবার্তা এলে \"I'm aware of the risks\" টিক দিন এবং টাইমার শেষ হওয়া পর্যন্ত অপেক্ষা করে \"Continue\" চাপুন।",
      "Oppo / Realme / OnePlus: \"Install anyway\" বা \"Continue installation\" চাপুন। ফোন যদি অ্যাকাউন্ট পাসওয়ার্ড বা ফোনের লক (PIN) চায়, সেটা দিন।",
      "Vivo / iQOO: \"Install safely\" / ঝুঁকির স্ক্রিনে \"I understand the risks\" বেছে নিয়ে কাউন্টডাউন শেষে \"Continue installing\" চাপুন।",
      "শুধু \"App blocked to protect your device\" দেখায়, Install-এর কোনো বাটন নেই? Play Store খুলুন → উপরে ডানে প্রোফাইল ছবি → Play Protect → উপরে ⚙ → \"Scan apps with Play Protect\" সাময়িক বন্ধ করুন, অ্যাপ ইনস্টল করুন, তারপর অবশ্যই আবার চালু করে দিন।",
    ],
  },
  {
    title: "২খ. \"App not installed\" দেখালে",
    body: [
      "ফোনে আগে থেকে অন্য কোথাও থেকে পাওয়া ASSDI Portal অ্যাপ থাকলে সেটা আনইনস্টল করে আবার চেষ্টা করুন।",
      "Messenger / WhatsApp-এ পাঠানো ফাইল অনেক সময় নষ্ট হয়ে যায়। এই পেজ থেকে Chrome দিয়ে সরাসরি ডাউনলোড করুন।",
      "ফোনে অন্তত ১০০ MB জায়গা খালি আছে কি না দেখুন। ফোনটি Android 8.0 বা নতুন হতে হবে।",
    ],
  },
  {
    title: "৩. লোকেশন \"Allow all the time\" দিন",
    body: [
      "অ্যাপ খুলে আপনার কোর্স বেছে লগইন করুন।",
      "ফিল্ড ট্র্যাকিং শুরু করলে লোকেশন permission চাইবে। প্রথমে \"While using the app\", তারপর Settings-এ গিয়ে Location → \"Allow all the time\" বেছে নিন। না হলে স্ক্রিন লক হলে ট্র্যাকিং বন্ধ হয়ে যাবে।",
      "Notification permission দিন, যাতে ট্র্যাকিং চলার সময় নোটিফিকেশন দেখা যায়।",
    ],
  },
  {
    title: "৪. Battery optimization বন্ধ করুন",
    body: [
      "Settings → Apps → ASSDI Portal → Battery → \"Unrestricted\" / \"Don't optimize\" বেছে নিন।",
      "Xiaomi/Redmi: Autostart চালু করুন এবং Battery saver → No restrictions দিন। Samsung: Sleeping apps তালিকা থেকে অ্যাপটি সরান। Oppo/Realme/Vivo: Background activity / Auto launch চালু করুন।",
      "অ্যাপটি Recent apps থেকে swipe করে বন্ধ বা Force stop করবেন না; তাতে ট্র্যাকিং থেমে যায়।",
    ],
  },
];

export default async function AppDownloadPage() {
  const apk = await apkInfo();
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 text-white shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-50">Android app</p>
          <h1
            className="mt-1 text-2xl font-black sm:text-3xl"
            style={{ color: "#fff", WebkitTextFillColor: "#fff", backgroundImage: "none" }}
          >
            ASSDI Portal অ্যাপ
          </h1>
          <p className="mt-2 text-sm text-emerald-50">
            পুরো পোর্টাল এখন ফোনে। Competition-এ ফিল্ডে গেলে স্ক্রিন লক থাকলেও লোকেশন পাঠানো যায়।
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {apk ? (
              <>
                <a
                  href={apk.href}
                  download="asm-portal.apk"
                  className="inline-flex items-center rounded-xl bg-white px-6 py-3 text-base font-black text-emerald-700 shadow hover:bg-emerald-50"
                >
                  ডাউনলোড করুন (APK)
                </a>
                <span className="text-xs text-emerald-50">
                  Version {apk.versionName} · {apk.sizeMb} MB
                  {apk.updated ? ` · প্রকাশ ${apk.updated}` : ""}
                </span>
              </>
            ) : (
              <span className="inline-flex items-center rounded-xl bg-white/20 px-6 py-3 text-base font-black text-white">
                শীঘ্রই আসছে
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-emerald-50">শুধু Android ফোনের জন্য (Android 8.0 বা নতুন)। iPhone সমর্থিত নয়।</p>
        </header>

        {apk && apk.notes.length > 0 && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <h2 className="text-lg font-bold text-emerald-900">Version {apk.versionName}-এ যা নতুন</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-emerald-900">
              {apk.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>
        )}

        {steps.map((s) => (
          <section key={s.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800">{s.title}</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
              {s.body.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
        ))}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800">অ্যাপ আপডেট কীভাবে হয়?</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>পোর্টালের পেজ, ফিচার বা ডিজাইনের পরিবর্তন অ্যাপে সাথে সাথেই চলে আসে; এর জন্য নতুন করে কিছু ইনস্টল করতে হয় না।</li>
            <li>
              অ্যাপের নিজের নতুন version এলে অ্যাপ খুললেই &quot;নতুন আপডেট এসেছে&quot; নোটিশ দেখাবে। &quot;এখনই আপডেট করুন&quot;
              চাপলে ডাউনলোড হয়ে ইনস্টলের স্ক্রিন আসবে; Install চাপুন। আগের লগইন ও তথ্য মুছবে না।
            </li>
            <li>প্রথমবার আপডেটের সময় ফোন &quot;Install unknown apps&quot; অনুমতি চাইলে ASSDI Portal-এর জন্য Allow দিন।</li>
            <li>Version 1.0.0 ব্যবহারকারীদের অ্যাপে আপডেট-নোটিশ নেই; তারা একবার এই পেজ থেকে নতুনটি ডাউনলোড করে ইনস্টল করুন।</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <h2 className="font-bold">লোকেশন কখন পাঠানো হয়?</h2>
          <p className="mt-1">
            শুধু আপনি যখন ফিল্ড সেশন চালু করেন (&quot;ফিল্ডে যাচ্ছি&quot; বা Business Incubation check-in) তখন থেকে
            বন্ধ করা পর্যন্ত (&quot;ফিরে এসেছি&quot; বা check-out)। এর বাইরে কখনো লোকেশন নেওয়া হয় না। ট্র্যাকিং চলার সময়
            নোটিফিকেশন বারে একটি স্থায়ী নোটিফিকেশন থাকবে।
          </p>
        </section>

        <p className="text-center text-xs text-slate-500">
          সমস্যা হলে আপনার শিক্ষক বা কোর্স অ্যাডমিনের সাথে যোগাযোগ করুন।
        </p>
      </div>
    </main>
  );
}
