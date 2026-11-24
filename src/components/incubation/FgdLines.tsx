"use client";
import { Plus, X } from "lucide-react";

/** Normalise FGD lines before sending: trim and drop the blank ones. */
export const cleanFgdLines = (lines?: string[]) =>
  (lines || []).map((s) => (s || "").trim()).filter(Boolean);

/** Editable list of FGD findings or next actions — as many lines as needed,
 * none individually required (blank lines are dropped on save). */
export default function FgdLines({
  title,
  values,
  onChange,
  addLabel,
  placeholder,
}: {
  title: string;
  values?: string[];
  onChange: (values: string[]) => void;
  addLabel: string;
  placeholder?: string;
}) {
  const rows = values && values.length ? values : [""];
  return (
    <div className="inc-field" role="group" aria-label={title}>
      <span>{title}</span>
      <div className="inc-fgd-lines">
        {rows.map((v, i) => (
          <div className="inc-fgd-line" key={i}>
            <b>{i + 1}.</b>
            <textarea
              aria-label={`${title} ${i + 1}`}
              maxLength={1000}
              placeholder={placeholder}
              value={v}
              onChange={(e) =>
                onChange(rows.map((s, j) => (j === i ? e.target.value : s)))
              }
            />
            {rows.length > 1 && (
              <button
                type="button"
                className="inc-btn"
                title="Remove this line"
                aria-label={`Remove ${title.toLowerCase()} ${i + 1}`}
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
        {rows.length < 50 && (
          <button
            type="button"
            className="inc-btn"
            style={{ alignSelf: "flex-start" }}
            onClick={() => onChange([...rows, ""])}
          >
            <Plus size={15} />
            {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}
