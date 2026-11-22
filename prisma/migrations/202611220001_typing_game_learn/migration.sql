-- Teachers and admins may use Typing Adventure for their own practice
-- (page permission "typing_game_learn"). Grant it to every existing teacher
-- and admin that has an explicit permission list; Access Management can
-- take it away per person. Accounts on role defaults get it from the code.
-- users has FORCE ROW LEVEL SECURITY; this flag is the same bypass the app uses.
SELECT set_config('app.is_super_admin', 'true', false);

UPDATE users
SET permissions = permissions || '["typing_game_learn"]'::jsonb
WHERE role IN ('teacher', 'admin')
  AND jsonb_typeof(permissions) = 'array'
  AND jsonb_array_length(permissions) > 0
  AND NOT permissions ? 'typing_game_learn';
