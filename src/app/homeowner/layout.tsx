import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { HomeownerShell } from "@/components/homeowner/HomeownerShell";

async function AuthenticatedHomeownerShell({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    select: {
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  if (!dbUser) {
    redirect("/login");
  }

  const fullName = `${dbUser.firstName} ${dbUser.lastName}`.trim();

  return (
    <HomeownerShell userName={fullName} userEmail={dbUser.email}>
      {children}
    </HomeownerShell>
  );
}

export default function HomeownerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <HomeownerShell userName="Loading..." userEmail="">
          <div className="mx-auto max-w-6xl animate-pulse space-y-6">
            <div className="h-44 rounded-3xl bg-white/70" />
            <div className="h-64 rounded-2xl bg-white/70" />
          </div>
        </HomeownerShell>
      }
    >
      <AuthenticatedHomeownerShell>{children}</AuthenticatedHomeownerShell>
    </Suspense>
  );
}