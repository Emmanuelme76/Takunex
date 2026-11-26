"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { generateOtpCode, sendVerificationSms } from "@/services/sms.service";

export interface AuthActionResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

// Helper interno para obtener la URL base (http://localhost:3000 en desarrollo)
async function getAppOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

// ============================================================================
// 1. REGISTRO DE USUARIO (HOMEOWNER o PROVIDER)
// ============================================================================
export async function registerUser(formData: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: "HOMEOWNER" | "PROVIDER";
  acceptTerms: boolean;
}): Promise<AuthActionResult> {
  const firstName = formData.firstName.trim();
  const lastName = formData.lastName.trim();
  const email = formData.email.toLowerCase().trim();
  const { password, role, acceptTerms } = formData;

  if (!firstName || !lastName || !email || !password) {
    return { success: false, error: "All fields are required." };
  }

  if (password.length < 8) {
    return {
      success: false,
      error: "Password must be at least 8 characters long.",
    };
  }

  if (!acceptTerms) {
    return {
      success: false,
      error: "You must accept the Terms & Conditions and Privacy Policy.",
    };
  }

  if (role !== "HOMEOWNER" && role !== "PROVIDER") {
    return { success: false, error: "Invalid account role selected." };
  }

  // Verificamos si el correo ya existe en PostgreSQL
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return {
      success: false,
      error: "An account with this email already exists.",
    };
  }

  const supabase = await createClient();
  const origin = await getAppOrigin();

  // Creamos el usuario en Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        full_name: `${firstName} ${lastName}`,
      },
    },
  });

  if (error || !data.user) {
    return {
      success: false,
      error: error?.message ?? "Unable to create account. Please try again.",
    };
  }

  const isEmailConfirmed = Boolean(data.user.email_confirmed_at);

  // Creamos el usuario y su perfil de rol en PostgreSQL (Prisma)
  await prisma.user.create({
    data: {
      supabaseAuthId: data.user.id,
      firstName,
      lastName,
      email,
      role,
      status: "ACTIVE",
      emailVerified: isEmailConfirmed,
      phoneVerified: false,
      ...(role === "PROVIDER"
        ? { provider: { create: {} } }
        : { homeowner: { create: {} } }),
    },
  });

  // Sincronizamos los metadatos en Supabase para el middleware RBAC
  const adminSupabase = createAdminClient();
  await adminSupabase.auth.admin.updateUserById(data.user.id, {
    app_metadata: {
      role,
      status: "ACTIVE",
      phone_verified: false,
      provider_status: "NONE",
    },
  });

  return {
    success: true,
    redirectTo: isEmailConfirmed ? "/verify-phone" : "/verify-email",
  };
}

// ============================================================================
// 2. ENVIAR CÓDIGO OTP POR SMS CON TWILIO (Guarda en pendingPhone y otpCode)
// ============================================================================
export async function sendPhoneOtp(
  rawPhoneNumber: string
): Promise<AuthActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Session expired. Please log in again." };
  }

  // Limpiamos espacios y guiones; exigimos formato internacional (+52...)
  const cleanPhone = rawPhoneNumber.replace(/[\s()-]/g, "").trim();
  if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) {
    return {
      success: false,
      error:
        "Please enter a valid phone number in international format (e.g., +523312345678).",
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
  });

  if (!dbUser) {
    return { success: false, error: "User profile not found." };
  }

  // Evitamos que dos cuentas distintas verifiquen el mismo número celular
  const phoneInUse = await prisma.user.findFirst({
    where: {
      phoneNumber: cleanPhone,
      id: { not: dbUser.id },
    },
  });

  if (phoneInUse) {
    return {
      success: false,
      error: "This phone number is already linked to another account.",
    };
  }

  // Generamos el PIN de 6 dígitos y su expiración de 10 minutos
  const otpCode = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Guardamos temporalmente en pendingPhone sin sobrescribir phoneNumber todavía
  await prisma.user.update({
    where: { id: dbUser.id },
    data: {
      pendingPhone: cleanPhone,
      otpCode,
      otpExpiresAt,
    },
  });

const smsResult = await sendVerificationSms(cleanPhone, otpCode);

  if (!smsResult.success) {
    return {
      success: false,
      error: smsResult.error ?? "Failed to send SMS verification code.",
    };
  }

  // Sincronizamos Prisma con el código exacto de 6 dígitos que Twilio envió en la plantilla sms_2fa
  if (smsResult.actualCode && smsResult.actualCode !== otpCode) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { otpCode: smsResult.actualCode },
    });
  }

  return { success: true };
}

// ============================================================================
// 3. VERIFICAR CÓDIGO OTP DE 6 DÍGITOS Y ACTIVAR LA CUENTA
// ============================================================================
export async function verifyPhoneOtp(
  submittedCode: string
): Promise<AuthActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Session expired. Please log in again." };
  }

  const cleanCode = submittedCode.trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    return {
      success: false,
      error: "Please enter the 6-digit verification code.",
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    include: { provider: true },
  });

  if (!dbUser || !dbUser.pendingPhone || !dbUser.otpCode || !dbUser.otpExpiresAt) {
    return {
      success: false,
      error: "No pending verification code found. Please request a new SMS.",
    };
  }

  if (new Date() > dbUser.otpExpiresAt) {
    return {
      success: false,
      error: "Verification code has expired. Please request a new one.",
    };
  }

  if (cleanCode !== dbUser.otpCode) {
    return {
      success: false,
      error: "Incorrect verification code. Please try again.",
    };
  }

  // Confirmamos el teléfono y limpiamos las variables temporales del OTP
  await prisma.user.update({
    where: { id: dbUser.id },
    data: {
      phoneNumber: dbUser.pendingPhone,
      phoneVerified: true,
      pendingPhone: null,
      otpCode: null,
      otpExpiresAt: null,
    },
  });

  // Actualizamos app_metadata en Supabase para que middleware.ts libere el acceso
  const adminSupabase = createAdminClient();
  const mappedProviderStatus =
    !dbUser.provider || dbUser.provider.verificationStatus === "UNSUBMITTED"
      ? "NONE"
      : dbUser.provider.verificationStatus;

  await adminSupabase.auth.admin.updateUserById(user.id, {
    app_metadata: {
      role: dbUser.role,
      status: "ACTIVE",
      phone_verified: true,
      provider_status: mappedProviderStatus,
    },
  });

  let redirectTo = "/homeowner/dashboard";
  if (dbUser.role === "ADMIN" || dbUser.role === "SUPER_ADMIN") {
    redirectTo = "/admin/dashboard";
  } else if (dbUser.role === "PROVIDER") {
    redirectTo =
      dbUser.provider?.verificationStatus === "APPROVED"
        ? "/provider/dashboard"
        : "/provider/onboarding";
  }

  return { success: true, redirectTo };
}

// ============================================================================
// 4. INICIO DE SESIÓN CON CORREO Y CONTRASEÑA
// ============================================================================
export async function loginUser(formData: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  const email = formData.email.toLowerCase().trim();
  const { password } = formData;

  if (!email || !password) {
    return { success: false, error: "Please enter both email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { success: false, error: "Invalid email or password." };
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: data.user.id },
    include: { provider: true },
  });

  if (!dbUser) {
    await supabase.auth.signOut();
    return {
      success: false,
      error: "Account profile not found. Please contact support.",
    };
  }

  // Bloqueamos cuentas baneadas, suspendidas o borradas (Soft Delete)
  if (
    dbUser.status === "BANNED" ||
    dbUser.status === "SUSPENDED" ||
    dbUser.status === "DELETED" ||
    dbUser.deletedAt !== null
  ) {
    await supabase.auth.signOut();
    return {
      success: false,
      error: "Your account has been suspended or deactivated.",
    };
  }

  // Sincronizamos app_metadata al iniciar sesión
  const adminSupabase = createAdminClient();
  const mappedProviderStatus =
    !dbUser.provider || dbUser.provider.verificationStatus === "UNSUBMITTED"
      ? "NONE"
      : dbUser.provider.verificationStatus;

  await adminSupabase.auth.admin.updateUserById(data.user.id, {
    app_metadata: {
      role: dbUser.role,
      status: "ACTIVE",
      phone_verified: dbUser.phoneVerified,
      provider_status: mappedProviderStatus,
    },
  });

  const isAdmin = dbUser.role === "ADMIN" || dbUser.role === "SUPER_ADMIN";

  if (!isAdmin && !data.user.email_confirmed_at) {
    return { success: true, redirectTo: "/verify-email" };
  }

  if (!isAdmin && !dbUser.phoneVerified) {
    return { success: true, redirectTo: "/verify-phone" };
  }

  let redirectTo = "/homeowner/dashboard";
  if (isAdmin) {
    redirectTo = "/admin/dashboard";
  } else if (dbUser.role === "PROVIDER") {
    redirectTo =
      dbUser.provider?.verificationStatus === "APPROVED"
        ? "/provider/dashboard"
        : "/provider/onboarding";
  }

  return { success: true, redirectTo };
}

// ============================================================================
// 5. CERRAR SESIÓN
// ============================================================================
export async function logoutUser(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}