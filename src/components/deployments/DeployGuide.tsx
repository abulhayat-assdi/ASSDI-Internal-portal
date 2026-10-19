"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { MAX_DEPLOY_SIZE_MB } from "@/lib/deploymentRules";
import { makeSampleSiteZip } from "@/lib/deploymentPreflight";

/** Collapsible "how to deploy" help in Bengali, with a downloadable sample project. */
export default function DeployGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);

    const downloadSample = async () => {
        try {
            const blob = await makeSampleSiteZip();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "sample-landing-page.zip";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
            toast.error("স্যাম্পল ফাইল তৈরি করা যায়নি।");
        }
    };

    return (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl">
            <button type="button" onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-blue-800">
                <span>📘 কীভাবে ডিপ্লয় করবেন? (গাইড)</span>
                <span className="text-blue-500">{open ? "▲" : "▼"}</span>
            </button>
            {open && (
                <div className="px-4 pb-4 text-sm text-slate-700 space-y-3">
                    <ol className="list-decimal pl-5 space-y-1.5">
                        <li>আপনার <b>index.html</b>, CSS, JS আর ছবিগুলো একটা ফোল্ডারে রাখুন। মূল পেজের নাম অবশ্যই <b>index.html</b> হবে।</li>
                        <li>শুধু একটা পেজ হলে সরাসরি <b>.html</b> ফাইলটা দিন। একাধিক ফাইল হলে <b>পুরো ফোল্ডারটা</b> টেনে আনুন বা &quot;ফোল্ডার সিলেক্ট&quot; চাপুন — আমরা নিজেই zip করে নেব। চাইলে নিজে .zip করেও দিতে পারেন।</li>
                        <li>একটা <b>সাবডোমেইন</b> দিন (যেমন <code>my-shop</code>) — শুধু ছোট হাতের ইংরেজি অক্ষর, সংখ্যা আর হাইফেন।</li>
                        <li>&quot;Deploy Site&quot; চাপুন। কয়েক সেকেন্ডের মধ্যে আপনার সাইট লাইভ হবে।</li>
                        <li>পরে কিছু বদলাতে চাইলে সাইট ডিলিট করবেন না — <b>&quot;Update files&quot;</b> দিয়ে নতুন ফাইল দিন, লিংক একই থাকবে।</li>
                    </ol>
                    <div className="bg-white/70 rounded-xl p-3 space-y-1 text-xs text-slate-600">
                        <p>✅ ফাইলের নাম আর লিংকে ইংরেজি ব্যবহার করুন, স্পেস না দিয়ে (যেমন <code>images/my-photo.jpg</code>)। Linux সার্ভারে <code>Photo.JPG</code> আর <code>photo.jpg</code> আলাদা ফাইল।</p>
                        <p>✅ ছবির লিংক relative দিন: <code>images/logo.png</code> — <code>C:\Users\...</code> এর মতো কম্পিউটারের লিংক কাজ করবে না।</p>
                        <p>⛔ SVG/XML ফাইল নিরাপত্তার কারণে ডিপ্লয় হয় না — লোগো/আইকন PNG বা WebP দিন। PHP/ডাটাবেস চলবে না।</p>
                        <p>📦 প্রতি আপলোড সর্বোচ্চ {MAX_DEPLOY_SIZE_MB}MB। বড় ছবি কমপ্রেস করে নিন (যেমন tinypng.com)।</p>
                    </div>
                    <button type="button" onClick={downloadSample}
                        className="text-xs font-medium px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                        ⬇️ স্যাম্পল প্রজেক্ট ডাউনলোড করুন
                    </button>
                </div>
            )}
        </div>
    );
}
