"use client";

import { useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
    /** Storage category passed to /api/storage/upload for the image button. */
    uploadCategory?: string;
}

/**
 * Shared rich-text editor for quiz question/option/explanation bodies.
 * Persists as sanitized HTML (see src/lib/sanitizeHtml.ts on the server side —
 * this component only renders/edits, sanitization happens on save).
 */
export default function RichTextEditor({
    value,
    onChange,
    placeholder = "লিখুন...",
    className,
    uploadCategory = "quiz",
}: RichTextEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
            Image,
            Link.configure({ openOnClick: false, autolink: true }),
        ],
        content: value,
        editorProps: {
            attributes: {
                class: "prose prose-sm max-w-none focus:outline-none min-h-[80px] px-3 py-2",
            },
        },
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
    });

    const uploadImage = useCallback(
        async (file: File) => {
            if (!editor) return;
            const formData = new FormData();
            formData.append("file", file);
            formData.append("category", uploadCategory);
            try {
                const res = await fetch("/api/storage/upload", { method: "POST", body: formData });
                const data = await res.json();
                if (res.ok && data.fileUrl) {
                    editor.chain().focus().setImage({ src: data.fileUrl }).run();
                }
            } catch (error) {
                console.error("[RichTextEditor] image upload failed:", error);
            }
        },
        [editor, uploadCategory]
    );

    if (!editor) return null;

    const ToolbarButton = ({
        onClick,
        active,
        label,
        children,
    }: {
        onClick: () => void;
        active?: boolean;
        label: string;
        children: React.ReactNode;
    }) => (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            className={cn(
                "px-2 py-1 rounded text-sm hover:bg-[#f3f4f6]",
                active && "bg-[#e5e7eb] font-semibold"
            )}
        >
            {children}
        </button>
    );

    return (
        <div className={cn("border border-[#d1d5db] rounded-lg overflow-hidden bg-white", className)}>
            <div className="flex flex-wrap items-center gap-0.5 border-b border-[#e5e7eb] bg-[#f9fafb] px-1 py-1">
                <ToolbarButton
                    label="Bold"
                    active={editor.isActive("bold")}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                >
                    <b>B</b>
                </ToolbarButton>
                <ToolbarButton
                    label="Italic"
                    active={editor.isActive("italic")}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                    <i>I</i>
                </ToolbarButton>
                <ToolbarButton
                    label="Underline strike"
                    active={editor.isActive("strike")}
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                >
                    <s>S</s>
                </ToolbarButton>
                <ToolbarButton
                    label="Bullet list"
                    active={editor.isActive("bulletList")}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                    •≡
                </ToolbarButton>
                <ToolbarButton
                    label="Numbered list"
                    active={editor.isActive("orderedList")}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                >
                    1.
                </ToolbarButton>
                <ToolbarButton
                    label="Link"
                    active={editor.isActive("link")}
                    onClick={() => {
                        const url = window.prompt("লিংক দিন:");
                        if (url) editor.chain().focus().setLink({ href: url }).run();
                    }}
                >
                    🔗
                </ToolbarButton>
                <ToolbarButton label="ছবি যোগ করুন" onClick={() => fileInputRef.current?.click()}>
                    🖼️
                </ToolbarButton>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadImage(file);
                        e.target.value = "";
                    }}
                />
            </div>
            <EditorContent editor={editor} placeholder={placeholder} />
        </div>
    );
}
