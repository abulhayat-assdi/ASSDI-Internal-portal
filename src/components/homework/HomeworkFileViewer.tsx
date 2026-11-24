"use client";

import { useEffect, useState } from "react";
import type { HomeworkFile } from "@/services/homeworkService";
import { getHomeworkFileViewLink } from "@/services/homeworkService";
import { homeworkFileDownloadUrl } from "@/lib/homeworkExport";
import { officeViewerLimitBytes, viewerKind } from "@/lib/homeworkGrading";

interface Props {
    file: HomeworkFile;
    fileIndex: number;
    submissionId: string;
    studentUid: string;
}

/** Same-origin URL for a stored homework file (falls back to the stored URL). */
export function homeworkFileUrl(file: HomeworkFile, studentUid: string): string {
    try {
        return homeworkFileDownloadUrl(file, studentUid);
    } catch {
        return file.url;
    }
}

const isLocalHost = () =>
    typeof window !== "undefined" &&
    /^(localhost|127\.|0\.0\.0\.0|\[::1\])|\.localhost$/.test(window.location.hostname);

/**
 * Shows one submitted file inline: images, PDFs, video/audio and text right
 * here; Word/Excel/PowerPoint through Microsoft's Office Online viewer; anything
 * else as a download.
 */
export default function HomeworkFileViewer({ file, fileIndex, submissionId, studentUid }: Props) {
    const url = homeworkFileUrl(file, studentUid);
    const kind = viewerKind(file.fileName || file.storagePath || file.url);
    const [zoomed, setZoomed] = useState(false);

    useEffect(() => setZoomed(false), [url]);

    const downloadBar = (
        <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 text-sm shrink-0">
            <span className="font-semibold text-gray-700 truncate flex-1 min-w-0" title={file.fileName}>{file.fileName}</span>
            {file.size ? <span className="text-xs text-gray-400 shrink-0">{file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}</span> : null}
            <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100">
                নতুন ট্যাবে ↗
            </a>
            <a href={url} download={file.fileName} className="shrink-0 px-3 py-1 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700">
                Download
            </a>
        </div>
    );

    let body: React.ReactNode;
    if (kind === "image") {
        body = (
            <div className="flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={url}
                    alt={file.fileName}
                    onClick={() => setZoomed((z) => !z)}
                    className={zoomed ? "max-w-none cursor-zoom-out" : "max-w-full h-auto cursor-zoom-in shadow-md bg-white"}
                    title={zoomed ? "Click to fit" : "Click to zoom (100%)"}
                />
            </div>
        );
    } else if (kind === "pdf") {
        body = <iframe key={url} src={url} title={file.fileName} className="flex-1 w-full bg-gray-100 border-0" />;
    } else if (kind === "video") {
        body = (
            <div className="flex-1 bg-black flex items-center justify-center min-h-0">
                <video key={url} src={url} controls preload="metadata" className="max-w-full max-h-full" />
            </div>
        );
    } else if (kind === "audio") {
        body = (
            <div className="flex-1 flex items-center justify-center bg-gray-50 p-6">
                <audio key={url} src={url} controls className="w-full max-w-lg" />
            </div>
        );
    } else if (kind === "text") {
        body = <TextFile url={url} />;
    } else if (kind === "office") {
        body = <OfficeFile file={file} fileIndex={fileIndex} submissionId={submissionId} url={url} />;
    } else if (kind === "html") {
        body = (
            <Placeholder icon="🌐" title="ওয়েব পেজ / SVG">
                নিরাপত্তার জন্য এটা আলাদা ট্যাবে (sandbox করে) খোলে।
                <a href={url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700">
                    নতুন ট্যাবে খুলুন ↗
                </a>
            </Placeholder>
        );
    } else {
        body = (
            <Placeholder icon="📦" title="এই ফাইলের প্রিভিউ নেই">
                ফাইলটি ডাউনলোড করে দেখুন।
                <a href={url} download={file.fileName} className="mt-4 inline-block px-5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700">
                    Download
                </a>
            </Placeholder>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            {downloadBar}
            {body}
        </div>
    );
}

function Placeholder({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gray-50 text-sm text-gray-500">
            <div className="text-5xl mb-3">{icon}</div>
            <p className="font-bold text-gray-800 mb-1">{title}</p>
            <div>{children}</div>
        </div>
    );
}

function TextFile({ url }: { url: string }) {
    const [text, setText] = useState<string | null>(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        const ctrl = new AbortController();
        setText(null);
        setError(false);
        fetch(url, { signal: ctrl.signal })
            .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
            .then((t) => setText(t.length > 500_000 ? `${t.slice(0, 500_000)}\n\n… (বাকিটা দেখতে ডাউনলোড করুন)` : t))
            .catch((e) => { if (e?.name !== "AbortError") setError(true); });
        return () => ctrl.abort();
    }, [url]);
    if (error) return <Placeholder icon="⚠️" title="ফাইলটি পড়া যায়নি">ডাউনলোড করে দেখুন।</Placeholder>;
    if (text === null) return <Spinner />;
    return <pre className="flex-1 overflow-auto p-5 bg-white text-sm text-gray-800 whitespace-pre-wrap break-words font-mono">{text}</pre>;
}

function Spinner({ label }: { label?: string }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-emerald-200 border-t-emerald-600 animate-spin" />
            {label && <p className="text-sm text-gray-500">{label}</p>}
        </div>
    );
}

function OfficeFile({ file, fileIndex, submissionId, url }: { file: HomeworkFile; fileIndex: number; submissionId: string; url: string }) {
    const [viewerSrc, setViewerSrc] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const tooBig = !!file.size && file.size > officeViewerLimitBytes(file.fileName);
    const local = isLocalHost();

    useEffect(() => {
        if (tooBig || local) return;
        let cancelled = false;
        setViewerSrc(null);
        setError(null);
        getHomeworkFileViewLink(submissionId, fileIndex)
            .then(({ url: publicUrl }) => {
                if (!cancelled) setViewerSrc(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`);
            })
            .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed"); });
        return () => { cancelled = true; };
    }, [submissionId, fileIndex, tooBig, local]);

    const download = (
        <a href={url} download={file.fileName} className="mt-4 inline-block px-5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700">
            Download
        </a>
    );
    if (tooBig) {
        return (
            <Placeholder icon="📄" title="ফাইলটি অনলাইন ভিউয়ারের জন্য বড়">
                Microsoft ভিউয়ার Word/PowerPoint সর্বোচ্চ ১০MB আর Excel ৫MB পর্যন্ত দেখায়।<br />{download}
            </Placeholder>
        );
    }
    if (local) {
        return (
            <Placeholder icon="🖥️" title="লোকাল সার্ভারে Office প্রিভিউ চলে না">
                Microsoft ভিউয়ার শুধু লাইভ (পাবলিক) সার্ভারে কাজ করে।<br />{download}
            </Placeholder>
        );
    }
    if (error) return <Placeholder icon="⚠️" title="প্রিভিউ তৈরি করা যায়নি">{error}<br />{download}</Placeholder>;
    if (!viewerSrc) return <Spinner label="Microsoft ভিউয়ারে খোলা হচ্ছে…" />;
    return (
        <iframe
            key={viewerSrc}
            src={viewerSrc}
            title={file.fileName}
            className="flex-1 w-full border-0 bg-white"
            referrerPolicy="no-referrer"
        />
    );
}
