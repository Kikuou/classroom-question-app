import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

function getSecret(): Uint8Array {
  const secret = process.env.TEACHER_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("TEACHER_SECRET 環境変数が設定されていません。Render の Environment Variables に設定してください。");
    }
    return new TextEncoder().encode("dev-secret-change-in-production");
  }
  return new TextEncoder().encode(secret);
}

export async function createTeacherToken(): Promise<string> {
  return new SignJWT({ teacher: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(getSecret());
}

export async function isTeacher(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("teacher_token")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export async function requireTeacher(): Promise<void> {
  if (!(await isTeacher())) throw new Error("Unauthorized");
}
