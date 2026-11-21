/**
 * Mode gate: Bangla opens after the student passes English Level 1
 * (Foundation). The English lesson track is not built yet, so until it
 * ships there is nothing to pass and Bangla stays open. When lessons land,
 * this reads the student's Level 1 assessment result.
 */
export async function isBanglaModeUnlocked(): Promise<boolean> {
  return true;
}
