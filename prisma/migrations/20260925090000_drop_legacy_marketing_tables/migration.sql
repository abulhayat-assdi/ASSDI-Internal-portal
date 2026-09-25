-- Removes six tables left over from the public marketing site that the course
-- subdomains replaced. No code has read or written them since the
-- multi-tenant migration — a course subdomain is a login portal now, with no
-- blog, hero slider, success stories or video testimonials.
--
-- Guard first: this is destructive and irreversible, so refuse to run at all
-- if any of the tables still holds a row. A deploy that fails loudly is much
-- cheaper than one that silently discards content somebody still wanted.
DO $$
DECLARE
    total bigint;
BEGIN
    SELECT
        (SELECT count(*) FROM "blog_comments")
      + (SELECT count(*) FROM "posts")
      + (SELECT count(*) FROM "success_stories")
      + (SELECT count(*) FROM "video_testimonials")
      + (SELECT count(*) FROM "video_stories")
      + (SELECT count(*) FROM "hero_images")
    INTO total;

    IF total > 0 THEN
        RAISE EXCEPTION
            'Refusing to remove legacy marketing tables: % row(s) still present. Export or clear them first, then re-run this migration.',
            total;
    END IF;
END $$;

-- blog_comments references posts, so it goes first.
DROP TABLE "blog_comments";
DROP TABLE "posts";
DROP TABLE "success_stories";
DROP TABLE "video_testimonials";
DROP TABLE "video_stories";
DROP TABLE "hero_images";
