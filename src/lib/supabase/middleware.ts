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
}

export async function updateSession(request: NextRequest) {
  // 1. Creamos una respuesta inicial que permite continuar la petición
  let supabaseResponse = NextResponse.next({
    request,
  });

  // 2. Inicializamos el cliente SSR de Supabase leyendo y escribiendo cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Actualizamos las cookies en la petición entrante para los Server Components
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Reconstruimos la respuesta y adjuntamos las cookies actualizadas al navegador
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

  // 3. Validamos el usuario real contra los servidores de Supabase Auth.
  // IMPORTANTE: Siempre usa getUser() y nunca getSession() en el servidor, porque getUser()
  // detecta al instante si un Admin revocó la sesión por Ban o Soft Delete.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Definimos grupos de rutas públicas y de autenticación
  const isPublicRoute = pathname === '/' || pathname.startsWith('/auth/callback');
  const isAuthPage =
    pathname.startsWith('/login') || pathname.startsWith('/register');
  const isVerificationPage =
    pathname.startsWith('/verify-email') || pathname.startsWith('/verify-phone');

  // Helper interno para redirigir limpiamente
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
    // Si intenta entrar a /homeowner, /provider, /admin o /verify-*, lo mandamos a /login
    return redirectTo('/login');
  }

  // Extraemos metadatos seguros firmados por el servidor
  const metadata = (user.app_metadata ?? {}) as TakunexAppMetadata;
  const role: UserRole = metadata.role ?? 'HOMEOWNER';
  const status: AccountStatus = metadata.status ?? 'ACTIVE';
  const isPhoneVerified = Boolean(metadata.phone_verified);
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
  // Si una cuenta Admin/Super Admin intentó entrar con Google OAuth, la bloqueamos aquí
  const authProvider = user.app_metadata?.provider;
  if (isAdmin && authProvider === 'google') {
    await supabase.auth.signOut();
    return redirectTo('/login', 'admin_google_blocked');
  }

  // --- CASO D: VERIFICACIÓN OBLIGATORIA EN DOS PASOS (EMAIL + SMS OTP) ---
  // Aplica a Homeowner y Provider antes de usar la plataforma
  if (!isAdmin) {
    const isEmailVerified = Boolean(user.email_confirmed_at);

    if (!isEmailVerified && !pathname.startsWith('/verify-email')) {
      return redirectTo('/verify-email');
    }

    if (
      isEmailVerified &&
      !isPhoneVerified &&
      !pathname.startsWith('/verify-phone')
    ) {
      return redirectTo('/verify-phone');
    }
  }

  // --- CASO E: REDIRECCIÓN SI YA ESTÁ VERIFICADO E INTENTA IR A /login O /register ---
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

  // 1. Rutas de Administración (/admin/*)
  if (pathname.startsWith('/admin')) {
    if (!isAdmin) {
      return redirectTo(
        role === 'PROVIDER' ? '/provider/dashboard' : '/homeowner/dashboard'
      );
    }
    // Solo SUPER_ADMIN puede entrar a la gestión de administradores
    if (
      pathname.startsWith('/admin/manage-admins') &&
      role !== 'SUPER_ADMIN'
    ) {
      return redirectTo('/admin/dashboard', 'insufficient_permissions');
    }
  }

  // 2. Rutas de Proveedor (/provider/*)
  if (pathname.startsWith('/provider')) {
    if (role !== 'PROVIDER') {
      return redirectTo(
        isAdmin ? '/admin/dashboard' : '/homeowner/dashboard'
      );
    }

    // Si el proveedor NO está aprobado aún, solo puede ver Onboarding o su pantalla de espera,
    // pero tiene bloqueadas las órdenes activas y el panel de ganancias.
    const isRestrictedProviderArea =
      pathname.startsWith('/provider/orders') ||
      pathname.startsWith('/provider/earnings');

    if (providerStatus !== 'APPROVED' && isRestrictedProviderArea) {
      return redirectTo('/provider/onboarding', 'pending_verification');
    }
  }

  // 3. Rutas de Cliente (/homeowner/*)
  if (pathname.startsWith('/homeowner')) {
    if (role !== 'HOMEOWNER') {
      return redirectTo(
        isAdmin ? '/admin/dashboard' : '/provider/dashboard'
      );
    }
  }

  return supabaseResponse;
}