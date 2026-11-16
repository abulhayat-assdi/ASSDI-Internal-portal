import { toBangla } from "@/lib/incubation/errors-bn";

/** Shows an error as "সমস্যা" (what happened) and "কী করবেন" (how to fix it). */
export default function ErrorText({ message }: { message: string }) {
  const text = toBangla(message).replace(/^\[\[.+?\]\]\s*/, "");
  const [problem, ...rest] = text.split("\nকী করবেন: ");
  return (
    <span style={{ display: "block", lineHeight: 1.6 }}>
      <span style={{ display: "block" }}>
        <b>সমস্যা:</b> {problem}
      </span>
      {rest.length > 0 && (
        <span style={{ display: "block", marginTop: 6 }}>
          <b>কী করবেন:</b> {rest.join(" ")}
        </span>
      )}
    </span>
  );
}
