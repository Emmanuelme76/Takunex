import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/SignOutButton";
import Image from "next/image";

async function DashboardContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isApproved = user?.app_metadata?.provider_status === "APPROVED";

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-tx-navy">Dashboard</h1>
        <SignOutButton />
      </div>

      {!isApproved && (
        <div className="fixed inset-0 flex items-center justify-center bg-white/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-bold text-tx-navy">Verification Pending</h2>
              <Image
                src="/lock.png"
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 object-contain"
              />
            </div>
            <p className="mt-4 text-sm text-tx-black">
              We are reviewing your profile and documents to ensure a safe community.
              This usually takes 24 to 48 hours.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                className="rounded-lg bg-tx-sky px-4 py-2.5 text-sm font-semibold text-white"
              >
                Learn How it works
              </button>
              <button
                type="button"
                className="rounded-lg border border-tx-navy px-4 py-2.5 text-sm font-semibold text-tx-navy"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ProviderDashboardPage() {
  return (
    <main className="relative min-h-screen bg-tx-bg p-8">
      <Suspense fallback={<h1 className="text-4xl font-bold text-tx-navy">Dashboard</h1>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}