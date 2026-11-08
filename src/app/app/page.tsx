import type { Metadata } from "next";
import { stat } from "node:fs/promises";
import path from "node:path";

// Public download page for the ASSDI Portal Android app (no login; reachable on the
// root domain and every course subdomain). The APK is dropped into public/downloads later.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ASSDI Portal Android App",
  description: "ASSDI Portal অ্যান্ড্রয়েড অ্যাপ ডাউনলোড ও সেটআপ",
};

const APK_PATH = "/downloads/asm-portal.apk";

async function apkInfo(): Promise<{ sizeMb: string; updated: string } | null> {
  try {
    const s = await stat(path.join(process.cwd(), "public", APK_PATH));
    if (!s.isFile() || s.size === 0) return null;
    return {
      sizeMb: (s.size / 1024 / 1024).toFixed(1),
      updated: s.mtime.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" }),
    };
  } catch {
    return null;
  }
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
                  href={APK_PATH}
                  download
                  className="inline-flex items-center rounded-xl bg-white px-6 py-3 text-base font-black text-emerald-700 shadow hover:bg-emerald-50"
                >
                  ডাউনলোড করুন (APK)
                </a>
                <span className="text-xs text-emerald-50">
                  {apk.sizeMb} MB · আপডেট {apk.updated}
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
