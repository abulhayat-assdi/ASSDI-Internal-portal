"use client";
import { useEffect, useId, useRef, useState } from "react";

/** A visible, touch-friendly file chooser for the incubation module.
 * Renders a hidden native <input type="file"> plus a pill button, the chosen
 * file name, an image preview, Change / Remove and an uploading state.
 * The caller keeps its own upload logic: `onSelect` receives the File. */
export default function FilePicker({
  accept,
  capture,
  required,
  disabled,
  uploading,
  uploaded,
  viewHref,
  onSelect,
  onRemove,
  label,
}: {
  accept?: string;
  capture?: "user" | "environment";
  required?: boolean;
  disabled?: boolean;
  /** Upload in progress (in addition to an `onSelect` promise still running). */
  uploading?: boolean;
  /** A file is already stored for this field (e.g. an existing voucher). */
  uploaded?: boolean;
  /** Link to view the stored file. */
  viewHref?: string;
  onSelect: (file: File) => unknown;
  onRemove?: () => void;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [working, setWorking] = useState(false);
  const imageOnly =
    !!accept &&
    accept
      .split(",")
      .map((s) => s.trim())
      .every((s) => s.startsWith("image/"));
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const busy = working || !!uploading;
  const has = !!file || !!uploaded;
  const pick = () => input.current?.click();
  const clear = () => {
    setFile(null);
    if (input.current) input.current.value = "";
    onRemove?.();
  };
  return (
    <div className={`inc-file${has ? " has" : ""}${busy ? " busy" : ""}`}>
      <input
        ref={input}
        id={id}
        className="inc-file-input"
        type="file"
        accept={accept}
        capture={capture}
        required={required && !uploaded}
        disabled={disabled || busy}
        tabIndex={-1}
        aria-hidden="true"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setFile(f);
          setWorking(true);
          try {
            await onSelect(f);
          } catch {
            // The caller shows its own upload error.
          } finally {
            setWorking(false);
          }
        }}
      />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="inc-file-thumb" src={preview} alt="Selected image preview" />
      )}
      {!has ? (
        <button
          type="button"
          className="inc-file-btn"
          disabled={disabled || busy}
          onClick={pick}
        >
          <span aria-hidden="true">{imageOnly ? "📷" : "📎"}</span>
          {label || (imageOnly ? "Choose image" : "Select file")}
        </button>
      ) : (
        <div className="inc-file-info">
          <b className="inc-file-name">
            {busy
              ? `Uploading ${file?.name || ""}…`
              : file?.name || "File uploaded"}
          </b>
          <div className="inc-file-actions">
            {!busy &&
              (uploaded ? (
                <span className="inc-file-ok">✓ Uploaded</span>
              ) : (
                <span className="inc-file-warn">Not uploaded — try again</span>
              ))}
            {!busy && uploaded && viewHref && (
              <a href={viewHref} target="_blank" rel="noreferrer">
                View
              </a>
            )}
            <button
              type="button"
              className="inc-file-link"
              disabled={disabled || busy}
              onClick={pick}
            >
              Change
            </button>
            {onRemove && (
              <button
                type="button"
                className="inc-file-link danger"
                disabled={disabled || busy}
                onClick={clear}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
      {busy && <span className="inc-file-spin" aria-label="Uploading" />}
    </div>
  );
}
