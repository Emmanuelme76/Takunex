import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user?.email) {
    return NextResponse.redirect(`${origin}/login?error=invalid_or_expired_link`);
  }

  const supabaseUser = data.user;
  const email = supabaseUser.email!.toLowerCase();
  const authProvider = supabaseUser.app_metadata?.provider; // "google" o "email"
  const adminSupabase = createAdminClient();

  // Buscamos si el usuario ya existe en PostgreSQL (Prisma)
  let dbUser = await prisma.user.findFirst({
    where: {
      OR: [{ supabaseAuthId: supabaseUser.id }, { email }],
    },
    include: { provider: true },
  });

  // 1. Bloquear Google OAuth para ADMIN y SUPER_ADMIN
  if (
    authProvider === "google" &&
    dbUser &&
    (dbUser.role === "ADMIN" || dbUser.role === "SUPER_ADMIN")
  ) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=admin_google_blocked`);
  }

  // 2. Bloquear cuentas baneadas, suspendidas o eliminadas (Soft Delete)
  if (
    dbUser &&
    (dbUser.status === "BANNED" ||
      dbUser.status === "SUSPENDED" ||
      dbUser.status === "DELETED" ||
      dbUser.deletedAt !== null)
  ) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?error=${
        dbUser.status === "BANNED" ? "account_suspended" : "account_deleted"
      }`
    );
  }

  // 3. Si es la primera vez que entra con Google y aún no existe en Prisma, lo creamos como HOMEOWNER
  if (!dbUser) {
    const fullName: string = supabaseUser.user_metadata?.full_name ?? "";
    const [firstName = "Takunex", ...rest] = fullName.trim().split(" ");
    const lastName = rest.join(" ") || "User";

    dbUser = await prisma.user.create({
      data: {
        supabaseAuthId: supabaseUser.id,
        email,
        firstName,
        lastName,
        avatarUrl: supabaseUser.user_metadata?.avatar_url ?? null,
        role: "HOMEOWNER",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: false,
        homeowner: { create: {} },
      },
      include: { provider: true },
    });
  } else if (!dbUser.emailVerified) {
    // Si ya existía por registro con correo, marcamos su email como verificado
    dbUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        emailVerified: true,
        supabaseAuthId: supabaseUser.id,
      },
      include: { provider: true },
    });
  }

  // 4. Sincronizamos app_metadata en Supabase para que tu middleware.ts tenga los datos al día
  const mappedStatus =
    dbUser.status === "BANNED" || dbUser.status === "SUSPENDED"
      ? "BANNED"
      : dbUser.status === "DELETED"
      ? "DELETED"
      : "ACTIVE";

  const mappedProviderStatus =
    !dbUser.provider || dbUser.provider.verificationStatus === "UNSUBMITTED"
      ? "NONE"
      : dbUser.provider.verificationStatus;

  await adminSupabase.auth.admin.updateUserById(supabaseUser.id, {
    app_metadata: {
      role: dbUser.role,
      status: mappedStatus,
      phone_verified: dbUser.phoneVerified,
      provider_status: mappedProviderStatus,
    },
  });

  // 5. Redirigimos según su estado de verificación y rol
  if (!dbUser.phoneVerified && dbUser.role !== "ADMIN" && dbUser.role !== "SUPER_ADMIN") {
    return NextResponse.redirect(`${origin}/verify-phone`);
  }

  if (dbUser.role === "ADMIN" || dbUser.role === "SUPER_ADMIN") {
    return NextResponse.redirect(`${origin}/admin/dashboard`);
  }

  if (dbUser.role === "PROVIDER") {
    return NextResponse.redirect(
      dbUser.provider?.verificationStatus === "APPROVED"
        ? `${origin}/provider/dashboard`
        : `${origin}/provider/onboarding`
    );
  }

  return NextResponse.redirect(`${origin}/homeowner/dashboard`);
}