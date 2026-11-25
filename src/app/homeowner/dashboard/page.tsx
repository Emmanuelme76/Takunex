import { SignOutButton } from "@/components/auth/SignOutButton";

export default function HomeownerDashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              HOMEOWNER
            </span>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              Homeowner Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Your email and phone number are verified. Ready to book services.
            </p>
          </div>
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}