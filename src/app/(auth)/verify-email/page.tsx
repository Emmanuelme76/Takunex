"use client";

import { useRouter } from "next/navigation";
import { logoutUser } from "@/actions/auth.actions";

export default function VerifyEmailPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    await logoutUser();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
          />
        </svg>
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-bold text-slate-900">Check your inbox</h1>
        <p className="text-sm text-slate-600">
          We sent a confirmation link to your email address. Click the link to
          verify your email and continue to phone verification.
        </p>
      </div>

      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        Didn&apos;t receive the email? Check your spam or junk folder.
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Back to Sign In
      </button>
    </div>
  );
}