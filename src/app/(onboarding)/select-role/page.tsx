"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { setUserRole } from "@/actions/auth.actions"; // ← aún no existe, ver punto 4

type Role = "PROVIDER" | "HOMEOWNER";

const OPTIONS: { role: Role; title: string; subtitle: string; icon: string }[] = [
  {
    role: "PROVIDER",
    title: "Provider",
    subtitle: "I want to offer my services",
    icon: "/provider.svg",
  },
  {
    role: "HOMEOWNER",
    title: "Homeowner",
    subtitle: "I want help with my home",
    icon: "/homeowner.svg",
  },
];

export default function SelectRolePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!selected) return;
    setIsLoading(true);
    setErrorMessage(null);

    const result = await setUserRole(selected);

    if (!result.success) {
      setErrorMessage(result.error ?? "Could not save your role. Please try again.");
      setIsLoading(false);
      return;
    }

    router.push(result.redirectTo ?? "/verify-email");
    router.refresh();
  };

  return (
    <div className="flex w-full flex-col items-center">
      <h1 className="text-2xl font-bold text-tx-ink">Who are you?</h1>

      <div className="mt-10 grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
        {OPTIONS.map(({ role, title, subtitle, icon }) => {
          const isSelected = selected === role;
          return (
            <button
              key={role}
              type="button"
              onClick={() => setSelected(role)}
              aria-pressed={isSelected}
              className={`flex flex-col items-center gap-4 rounded-2xl bg-white p-6 transition focus:outline-none focus:ring-2 focus:ring-tx-sky ${
                isSelected ? "ring-2 ring-tx-sky" : "ring-1 ring-transparent hover:ring-tx-gray-light"
              }`}
            >
              <span className="text-base font-bold text-tx-black">{title}</span>
              <Image src={icon} alt="" width={120} height={120} />
              <span className="text-xs font-semibold text-tx-black">{subtitle}</span>
            </button>
          );
        })}
      </div>

      {errorMessage && (
        <p className="mt-6 text-xs font-medium text-red-600" role="alert">
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!selected || isLoading}
        className="mt-10 w-full max-w-xs rounded-full bg-tx-sky px-4 py-3 text-lg font-bold text-white transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-tx-teal focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Saving..." : "Continue"}
      </button>
    </div>
  );
}