import sanitizeHtml from "sanitize-html";

/**
 * Sanitizes rich-text HTML coming out of the Tiptap editor before it is
 * persisted (quiz question/option/explanation bodies). Allows the small set
 * of tags the editor's toolbar can actually produce, plus <img> for the
 * upload-through-storage image button.
 */
export function sanitizeRichText(html: string): string {
    return sanitizeHtml(html, {
        allowedTags: [
            "p", "br", "strong", "em", "u", "s",
            "ul", "ol", "li", "a", "img",
            "h1", "h2", "h3", "blockquote", "code", "pre",
        ],
        allowedAttributes: {
            a: ["href", "target", "rel"],
            img: ["src", "alt", "width", "height"],
        },
        allowedSchemes: ["http", "https", "data"],
        transformTags: {
            a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
        },
    });
}
