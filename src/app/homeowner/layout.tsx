import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { HomeownerShell } from "@/components/homeowner/HomeownerShell";

export default async function HomeownerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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