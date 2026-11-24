import "server-only";
import { createReadStream } from "fs";

/**
 * Streams a stored file, honouring a single HTTP `Range` request.
 *
 * Browsers need 206 partial responses to seek in <video>/<audio> and to load
 * big PDFs progressively; without them a teacher cannot skip ahead in a
 * submitted video. Multi-range requests are answered with the whole file,
 * which is always a valid response.
 */
export function streamFileResponse(
    rangeHeader: string | null,
    absolutePath: string,
    size: number,
    headers: Record<string, string>
): Response {
    const base = { ...headers, "Accept-Ranges": "bytes" };
    const range = parseRange(rangeHeader, size);

    if (range === "unsatisfiable") {
        return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
    }
    if (range) {
        const stream = createReadStream(absolutePath, { start: range.start, end: range.end });
        return new Response(stream as unknown as ReadableStream, {
            status: 206,
            headers: {
                ...base,
                "Content-Length": String(range.end - range.start + 1),
                "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
            },
        });
    }
    const stream = createReadStream(absolutePath);
    return new Response(stream as unknown as ReadableStream, {
        status: 200,
        headers: { ...base, "Content-Length": String(size) },
    });
}

/** `bytes=a-b`, `bytes=a-`, `bytes=-n`. null = serve the whole file. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | "unsatisfiable" | null {
    if (!header) return null;
    const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!m) return null; // multi-range or malformed → full response
    const [, a, b] = m;
    if (a === "" && b === "") return null;
    let start: number;
    let end: number;
    if (a === "") {
        const suffix = Number(b);
        if (suffix === 0) return "unsatisfiable";
        start = Math.max(0, size - suffix);
        end = size - 1;
    } else {
        start = Number(a);
        end = b === "" ? size - 1 : Math.min(Number(b), size - 1);
    }
    if (size === 0 || start >= size || start > end) return "unsatisfiable";
    return { start, end };
}
