import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Tipos estrictos alineados con nuestro esquema de Prisma y reglas de negocio
type UserRole = 'HOMEOWNER' | 'PROVIDER' | 'ADMIN' | 'SUPER_ADMIN';
type AccountStatus = 'ACTIVE' | 'BANNED' | 'DELETED';
type ProviderStatus = 'NONE' | 'PENDING_VERIFICATION' | 'APPROVED' | 'DECLINED';

interface TakunexAppMetadata {
  role?: UserRole;
  status?: AccountStatus;
  phone_verified?: boolean;
  provider_status?: ProviderStatus;
  role_selected?: boolean;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Rutas accesibles sin sesión activa (incluye /verify-email tras el signUp)
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/verify-email');
  const isAuthPage =
    pathname.startsWith('/login') || pathname.startsWith('/register');
  const isVerificationPage =
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/verify-phone") ||
    pathname.startsWith("/select-role"); 

  const redirectTo = (path: string, errorCode?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    if (errorCode) {
      url.searchParams.set('error', errorCode);
    }
    return NextResponse.redirect(url);
  };

  // --- CASO A: USUARIO NO AUTENTICADO ---
  if (!user) {
    if (isPublicRoute || isAuthPage) {
      return supabaseResponse;
    }
    return redirectTo('/login');
  }

  // Extraemos metadatos seguros firmados por el servidor
  const metadata = (user.app_metadata ?? {}) as TakunexAppMetadata;
  const role: UserRole = metadata.role ?? 'HOMEOWNER';
  const status: AccountStatus = metadata.status ?? 'ACTIVE';
  const isPhoneVerified = Boolean(metadata.phone_verified);
  const needsRoleSelection = metadata.role_selected === false;
  const providerStatus: ProviderStatus = metadata.provider_status ?? 'NONE';
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  // --- CASO B: CUENTA BANEADA O CON SOFT DELETE ---
  if (status === 'BANNED' || status === 'DELETED') {
    await supabase.auth.signOut();
    return redirectTo(
      '/login',
      status === 'BANNED' ? 'account_suspended' : 'account_deleted'
    );
  }

  // --- CASO C: BLOQUEO DE GOOGLE OAUTH PARA ADMINISTRADORES ---
  const authProvider = user.app_metadata?.provider;
  if (isAdmin && authProvider === 'google') {
    await supabase.auth.signOut();
    return redirectTo('/login', 'admin_google_blocked');
  }

  // --- CASO D: VERIFICACIÓN OBLIGATORIA EN DOS PASOS (EMAIL + SMS OTP) ---
  if (!isAdmin) {
    const isEmailVerified = Boolean(user.email_confirmed_at);

    if (!isEmailVerified) {
      if (pathname.startsWith("/verify-email")) {
        return supabaseResponse;
      }
      return redirectTo("/verify-email");
    }

    if (needsRoleSelection) {
      if (pathname.startsWith("/select-role")) {
        return supabaseResponse;
      }
      return redirectTo("/select-role");
    }
    // el rol se elige después del correo y antes del SMS

    if (!isPhoneVerified) {
      if (pathname.startsWith("/verify-phone")) {
        return supabaseResponse;
      }
      return redirectTo("/verify-phone");
    }
  }

  // --- CASO E: REDIRECCIÓN SI YA COMPLETÓ TODAS LAS VERIFICACIONES ---
  if (isAuthPage || isVerificationPage) {
    if (isAdmin) return redirectTo('/admin/dashboard');
    if (role === 'PROVIDER') {
      return redirectTo(
        providerStatus === 'APPROVED'
          ? '/provider/dashboard'
          : '/provider/onboarding'
      );
    }
    return redirectTo('/homeowner/dashboard');
  }

  // --- CASO F: CONTROL DE ACCESO POR ROL (RBAC) ---
  if (pathname.startsWith('/admin')) {
    if (!isAdmin) {
      return redirectTo(
        role === 'PROVIDER' ? '/provider/dashboard' : '/homeowner/dashboard'
      );
    }
    if (
      pathname.startsWith('/admin/manage-admins') &&
      role !== 'SUPER_ADMIN'
    ) {
      return redirectTo('/admin/dashboard', 'insufficient_permissions');
    }
  }

  if (pathname.startsWith('/provider')) {
    if (role !== 'PROVIDER') {
      return redirectTo(
        isAdmin ? '/admin/dashboard' : '/homeowner/dashboard'
      );
    }

    const isRestrictedProviderArea =
      pathname.startsWith('/provider/orders') ||
      pathname.startsWith('/provider/earnings');

    if (providerStatus !== 'APPROVED' && isRestrictedProviderArea) {
      return redirectTo('/provider/onboarding', 'pending_verification');
    }
  }

  if (pathname.startsWith('/homeowner')) {
    if (role !== 'HOMEOWNER') {
      return redirectTo(
        isAdmin ? '/admin/dashboard' : '/provider/dashboard'
      );
    }
  }

  return supabaseResponse;
}