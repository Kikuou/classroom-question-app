import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.TEACHER_SECRET ?? "dev-secret-change-in-production"
);

export async function createTeacherToken(): Promise<string> {
  return new SignJWT({ teacher: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(SECRET);
}

export async function isTeacher(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("teacher_token")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function requireTeacher(): Promise<void> {
  if (!(await isTeacher())) throw new Error("Unauthorized");
}
