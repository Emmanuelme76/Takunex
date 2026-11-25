"use client";

import { useRouter } from "next/navigation";
import { logoutUser } from "@/actions/auth.actions";

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await logoutUser();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
    >
      Sign Out
    </button>
  );
}