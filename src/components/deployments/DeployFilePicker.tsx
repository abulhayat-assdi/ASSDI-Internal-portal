"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_DEPLOY_SIZE_MB, formatBytes } from "@/lib/deploymentRules";
import { pickedFromInput, preflightDeployFile, readDrop, zipFolder, type PickedFile } from "@/lib/deploymentPreflight";

export type PickerStatus = "none" | "checking" | "ok" | "error";

export interface PickerState {
    file: File | null;
    status: PickerStatus;
}

const UploadCloudIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
    </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);

const XCircleIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);

/**
 * Upload box for a site: a single .html file, a .zip, or a whole folder
 * (dropped or picked), which is zipped in the browser. Every pick is checked
 * on the spot so problems show before the upload starts.
 */
export default function DeployFilePicker({
    disabled,
    onChange,
}: {
    disabled?: boolean;
    onChange: (state: PickerState) => void;
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const latestRef = useRef(0);

    const [file, setFile] = useState<File | null>(null);
    const [label, setLabel] = useState("");
    const [status, setStatus] = useState<PickerStatus>("none");
    const [error, setError] = useState("");
    const [notes, setNotes] = useState<string[]>([]);
    const [dragOver, setDragOver] = useState(false);

    // <input webkitdirectory> isn't in React's types; set it on the element.
    useEffect(() => {
        folderInputRef.current?.setAttribute("webkitdirectory", "");
        folderInputRef.current?.setAttribute("directory", "");
    }, []);

    useEffect(() => { onChange({ file, status }); }, [file, status, onChange]);

    const begin = (displayName: string) => {
        const ticket = ++latestRef.current;
        setLabel(displayName);
        setFile(null);
        setError("");
        setNotes([]);
        setStatus("checking");
        return ticket;
    };

    const finish = async (ticket: number, picked: File, extraNotes: string[] = []) => {
        const result = await preflightDeployFile(picked);
        if (ticket !== latestRef.current) return; // a newer pick replaced this one
        setFile(picked);
        setStatus(result.error ? "error" : "ok");
        setError(result.error ?? "");
        setNotes([...extraNotes, ...result.notes]);
    };

    const fail = (ticket: number, message: string) => {
        if (ticket !== latestRef.current) return;
        setStatus("error");
        setError(message);
    };

    const handleFile = async (picked: File | null) => {
        if (!picked) return;
        const ticket = begin(picked.name);
        await finish(ticket, picked);
    };

    const handleFolder = async (files: PickedFile[], folderName: string) => {
        const ticket = begin(`${folderName}/ (ফোল্ডার)`);
        try {
            const zipped = await zipFolder(files, folderName);
            await finish(ticket, zipped, [`"${folderName}" ফোল্ডারটি অটোমেটিক zip করা হয়েছে।`]);
        } catch (err) {
            fail(ticket, err instanceof Error ? err.message : "ফোল্ডারটি পড়া যায়নি।");
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        const dropped = await readDrop(e.dataTransfer);
        if (!dropped) return;
        if ("file" in dropped) await handleFile(dropped.file);
        else await handleFolder(dropped.files, dropped.folderName);
    };

    const clear = () => {
        latestRef.current++;
        setFile(null);
        setLabel("");
        setStatus("none");
        setError("");
        setNotes([]);
    };

    return (
        <div>
            <div
                onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !disabled && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-5 sm:p-8 text-center transition-all ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
                    ${dragOver ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"}
                    ${status === "ok" ? "border-green-400 bg-green-50" : ""}
                    ${status === "error" ? "border-red-300 bg-red-50" : ""}`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm,.zip,text/html,application/zip,application/x-zip-compressed"
                    className="hidden"
                    onChange={(e) => { void handleFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
                />
                <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files?.length) {
                            const { files, folderName } = pickedFromInput(e.target.files);
                            void handleFolder(files, folderName);
                        }
                        e.target.value = "";
                    }}
                />
                {status !== "none" ? (
                    <div className="flex flex-col items-center gap-2">
                        {status === "checking" && <span className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />}
                        {status === "ok" && <CheckCircleIcon className="w-8 h-8 text-green-500" />}
                        {status === "error" && <XCircleIcon className="w-8 h-8 text-red-500" />}
                        <p className="font-medium text-slate-700 text-sm break-all">{label}</p>
                        {file && <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>}
                        {status === "checking" && <p className="text-xs text-slate-500">ফাইল চেক করা হচ্ছে...</p>}
                        {!disabled && status !== "checking" && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); clear(); }} className="text-xs text-red-500 hover:underline">
                                ফাইল বাদ দিন
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <UploadCloudIcon className="w-10 h-10 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">
                            {dragOver ? "এখানে ছেড়ে দিন!" : "ফাইল বা পুরো ফোল্ডার এখানে টেনে আনুন, অথবা ক্লিক করুন"}
                        </p>
                        <p className="text-xs text-slate-400">.html, .zip অথবা প্রজেক্ট ফোল্ডার — সর্বোচ্চ {MAX_DEPLOY_SIZE_MB}MB</p>
                    </div>
                )}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={disabled} onClick={() => fileInputRef.current?.click()}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50">
                    📄 ফাইল সিলেক্ট (.html / .zip)
                </button>
                <button type="button" disabled={disabled} onClick={() => folderInputRef.current?.click()}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50">
                    📁 ফোল্ডার সিলেক্ট
                </button>
            </div>

            {status === "error" && error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
            {status === "ok" && notes.map((n) => <p key={n} className="mt-1.5 text-xs text-slate-500">ℹ️ {n}</p>)}
        </div>
    );
}
