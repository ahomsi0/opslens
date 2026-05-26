import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <Suspense fallback={<div className="h-96 w-full max-w-sm" />}>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  );
}
