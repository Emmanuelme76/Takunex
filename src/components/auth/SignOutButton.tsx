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
      className="rounded-full bg-tx-gray-light/40 px-5 py-2 text-sm font-medium text-tx-ink transition hover:bg-tx-gray-light/70 focus:outline-none focus:ring-2 focus:ring-tx-sky"
    >
      Sign Out
    </button>
  );
}