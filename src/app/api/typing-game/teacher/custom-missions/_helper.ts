/**
 * Teacher custom-mission route gate. Two layers, matching
 * src/app/dashboard/typing-game/teacher/layout.tsx: the typing_game bridge
 * role (requireTeacher — any ASM teacher/admin/super_admin) AND the
 * admin-granted `typing_game_teacher` ASM permission (opt-in per teacher via
 * Access Management). Fine-grained per-mission ownership is enforced by the
 * fn_can_manage_custom_mission() checks inside the RPCs themselves.
 */
import { NextResponse } from "next/server";
import { getSession, userDbClient } from "@/lib/typing-game/server/auth";
import { AuthApiError, requireTeacher } from "@/lib/typing-game/server/staff";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  createSupabaseCustomMissionStore,
  type CustomMissionStore,
} from "@/lib/typing-game/server/custom-mission-store";
import { getServerSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import enErrors from "@/messages/typing-game/en/errors.json";

export interface TeacherCustomMissionContext {
  teacherUserId: string;
  store: CustomMissionStore;
}

function forbidden(): NextResponse {
  return NextResponse.json(
    { error: "FORBIDDEN", message: enErrors.permissionDenied },
    { status: 403 },
  );
}

export function toTeacherMissionError(e: unknown): NextResponse {
  if (e instanceof ForbiddenError) return forbidden();
  if (e instanceof ConflictError) {
    return NextResponse.json(
      { error: e.message, message: enErrors.valuesMismatch },
      { status: 409 },
    );
  }
  if (e instanceof NotFoundError) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: enErrors.fileNotAvailable },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { error: "FAILED", message: enErrors.genericDescription },
    { status: 500 },
  );
}

export async function teacherCustomMissionContext(): Promise<
  TeacherCustomMissionContext | NextResponse
> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED", message: enErrors.unauthorizedDescription },
      { status: 401 },
    );
  }
  const client = await userDbClient();
  if (!client) {
    return NextResponse.json(
      { error: "SERVICE_UNAVAILABLE", message: enErrors.storageUnavailable },
      { status: 503 },
    );
  }
  try {
    await client.rpc("fn_provision_staff_from_asm");
  } catch {
    // best-effort, same as the teacher layout
  }
  try {
    await requireTeacher(client);
  } catch (e) {
    if (e instanceof AuthApiError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
    }
    throw e;
  }
  const asmUser = await getServerSessionUser();
  if (
    !asmUser ||
    !hasPermission(asmUser.role, asmUser.permissions ?? null, "typing_game_teacher")
  ) {
    return forbidden();
  }
  return {
    teacherUserId: session.userId,
    store: createSupabaseCustomMissionStore(client),
  };
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return (await req.json()) as unknown;
  } catch {
    return {};
  }
}

export function validUuid(id: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(id);
}

export function unknownMission(): NextResponse {
  return NextResponse.json(
    { error: "NOT_FOUND", message: enErrors.fileNotAvailable },
    { status: 404 },
  );
}
