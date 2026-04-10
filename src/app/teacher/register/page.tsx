"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TeacherRegisterPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/teacher/login"); }, [router]);
  return null;
}
