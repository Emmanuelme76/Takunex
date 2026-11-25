import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight text-slate-900"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-base font-extrabold text-white">
            T
          </span>
          <span>Takunex</span>
        </Link>
        <p className="mt-2 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
          Trusted Home Services Marketplace
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}