import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.TEACHER_SECRET ?? "dev-secret-change-in-production"
);

export async function createTeacherToken(teacherId: number): Promise<string> {
  return new SignJWT({ teacherId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(SECRET);
}

export async function getTeacherId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("teacher_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload.teacherId as number;
  } catch {
    return null;
  }
}

export async function requireTeacher(): Promise<number> {
  const teacherId = await getTeacherId();
  if (!teacherId) throw new Error("Unauthorized");
  return teacherId;
}
