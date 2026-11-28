"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { providerHomePath } from "@/lib/provider-routes";

export type ActionResult =
  | { ok: true; message?: string; redirectTo?: string }
  | { ok: false; error: string };

async function getAuthenticatedUserContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    include: { homeowner: true, provider: true },
  });

  if (!dbUser || dbUser.status !== "ACTIVE") {
    return null;
  }

  const homeowner =
    dbUser.homeowner ??
    (await prisma.homeowner.create({
      data: { userId: dbUser.id },
    }));

  return { supabase, authUser: user, dbUser, homeowner };
}

// ==========================================
// 0. SWITCH ROLE (HOMEOWNER <-> PROVIDER)
// ==========================================

export async function switchUserRoleAction(
  targetRole: "HOMEOWNER" | "PROVIDER"
): Promise<ActionResult> {
  try {
    if (targetRole !== "HOMEOWNER" && targetRole !== "PROVIDER") {
      return { ok: false, error: "Invalid target role." };
    }

    const ctx = await getAuthenticatedUserContext();
    if (!ctx) {
      return { ok: false, error: "Unauthorized. Please sign in again." };
    }

    if (ctx.dbUser.role === "ADMIN" || ctx.dbUser.role === "SUPER_ADMIN") {
      return {
        ok: false,
        error: "Administrator accounts cannot switch to client/provider roles.",
      };
    }

    let providerVerificationStatus =
      ctx.dbUser.provider?.verificationStatus ?? "UNSUBMITTED";

    // Garantizamos que exista el perfil correspondiente sin eliminar el anterior
    if (targetRole === "PROVIDER" && !ctx.dbUser.provider) {
      const createdProvider = await prisma.provider.create({
        data: { userId: ctx.dbUser.id },
      });
      providerVerificationStatus = createdProvider.verificationStatus;
    }

    if (targetRole === "HOMEOWNER" && !ctx.dbUser.homeowner) {
      await prisma.homeowner.create({
        data: { userId: ctx.dbUser.id },
      });
    }

    await prisma.user.update({
      where: { id: ctx.dbUser.id },
      data: { role: targetRole },
    });

    const mappedProviderStatus =
      providerVerificationStatus === "UNSUBMITTED"
        ? "NONE"
        : providerVerificationStatus;

    // Sincronizamos app_metadata en Supabase para que el middleware RBAC aplique el nuevo rol
    const adminSupabase = createAdminClient();
    await adminSupabase.auth.admin.updateUserById(ctx.authUser.id, {
      app_metadata: {
        ...ctx.authUser.app_metadata,
        role: targetRole,
        status: "ACTIVE",
        phone_verified: ctx.dbUser.phoneVerified,
        provider_status: mappedProviderStatus,
        role_selected: true,
      },
    });

    const redirectTo =
      targetRole === "PROVIDER"
        ? providerHomePath(providerVerificationStatus)
        : "/homeowner/dashboard";

    revalidatePath("/homeowner", "layout");
    revalidatePath("/provider", "layout");

    return { ok: true, redirectTo };
  } catch (err) {
    console.error("[switchUserRoleAction]", err);
    return {
      ok: false,
      error: "Could not switch role right now. Please try again.",
    };
  }
}

// ==========================================
// 1. PROFILE & AVATAR
// ==========================================

export async function updateHomeownerProfileAction(input: {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  avatarUrl?: string | null;
}): Promise<ActionResult> {
  try {
    const ctx = await getAuthenticatedUserContext();
    if (!ctx) {
      return { ok: false, error: "Unauthorized. Please sign in again." };
    }

    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const cleanPhone = input.phoneNumber.trim() || null;

    if (!firstName || !lastName) {
      return { ok: false, error: "First name and last name are required." };
    }

    if (cleanPhone) {
      const phoneInUse = await prisma.user.findFirst({
        where: {
          phoneNumber: cleanPhone,
          id: { not: ctx.dbUser.id },
        },
        select: { id: true },
      });

      if (phoneInUse) {
        return {
          ok: false,
          error: "This phone number is already registered to another account.",
        };
      }
    }

    const phoneChanged = cleanPhone !== ctx.dbUser.phoneNumber;

    await prisma.user.update({
      where: { id: ctx.dbUser.id },
      data: {
        firstName,
        lastName,
        phoneNumber: cleanPhone,
        ...(phoneChanged ? { phoneVerified: false } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
    });

    revalidatePath("/homeowner", "layout");
    revalidatePath("/homeowner/profile");
    revalidatePath("/homeowner/dashboard");
    revalidatePath("/homeowner/settings");

    return { ok: true, message: "Profile updated successfully." };
  } catch (err) {
    console.error("[updateHomeownerProfileAction]", err);
    return { ok: false, error: "Could not update profile. Please try again." };
  }
}

// ==========================================
// 2. SAVED PAYMENT METHODS (RF 3.4: Only last 4 digits + token)
// ==========================================

function detectCardBrand(digits: string): string {
  if (digits.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  return "Card";
}

export async function addSavedCardAction(input: {
  cardholderName: string;
  cardNumber: string;
  expirationDate: string;
  setAsDefault: boolean;
}): Promise<ActionResult> {
  try {
    const ctx = await getAuthenticatedUserContext();
    if (!ctx) {
      return { ok: false, error: "Unauthorized. Please sign in again." };
    }

    const digits = input.cardNumber.replace(/\D/g, "");
    if (!input.cardholderName.trim() || digits.length < 15 || digits.length > 16) {
      return {
        ok: false,
        error: "Enter a valid cardholder name and 15–16 digit card number.",
      };
    }

    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(input.expirationDate.trim())) {
      return {
        ok: false,
        error: "Expiration date must follow MM/YY format.",
      };
    }

    const existingCount = await prisma.paymentMethod.count({
      where: { homeownerId: ctx.homeowner.id },
    });

    const shouldBeDefault = input.setAsDefault || existingCount === 0;
    const last4 = digits.slice(-4);
    const brand = detectCardBrand(digits);
    const simulatedToken = `tok_sim_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

    await prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.paymentMethod.updateMany({
          where: { homeownerId: ctx.homeowner.id },
          data: { isDefault: false },
        });
      }

      await tx.paymentMethod.create({
        data: {
          homeownerId: ctx.homeowner.id,
          type: "CARD",
          isDefault: shouldBeDefault,
          cardDetails: {
            create: {
              cardholderName: input.cardholderName.trim(),
              last4Digits: last4,
              cardBrand: brand,
              expirationDate: input.expirationDate.trim(),
              gatewayToken: simulatedToken,
            },
          },
        },
      });
    });

    revalidatePath("/homeowner/profile");
    return { ok: true, message: "Card saved successfully." };
  } catch (err) {
    console.error("[addSavedCardAction]", err);
    return { ok: false, error: "Could not save card details." };
  }
}

export async function setDefaultPaymentMethodAction(
  paymentMethodId: string
): Promise<ActionResult> {
  try {
    const ctx = await getAuthenticatedUserContext();
    if (!ctx) {
      return { ok: false, error: "Unauthorized." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.paymentMethod.updateMany({
        where: { homeownerId: ctx.homeowner.id },
        data: { isDefault: false },
      });

      await tx.paymentMethod.updateMany({
        where: {
          id: paymentMethodId,
          homeownerId: ctx.homeowner.id,
        },
        data: { isDefault: true },
      });
    });

    revalidatePath("/homeowner/profile");
    return { ok: true };
  } catch (err) {
    console.error("[setDefaultPaymentMethodAction]", err);
    return { ok: false, error: "Could not update default payment method." };
  }
}

export async function removePaymentMethodAction(
  paymentMethodId: string
): Promise<ActionResult> {
  try {
    const ctx = await getAuthenticatedUserContext();
    if (!ctx) {
      return { ok: false, error: "Unauthorized." };
    }

    await prisma.paymentMethod.deleteMany({
      where: {
        id: paymentMethodId,
        homeownerId: ctx.homeowner.id,
      },
    });

    revalidatePath("/homeowner/profile");
    return { ok: true };
  } catch (err) {
    console.error("[removePaymentMethodAction]", err);
    return {
      ok: false,
      error: "Cannot remove a payment method linked to existing transactions.",
    };
  }
}

// ==========================================
// 3. MESSAGES & NOTIFICATIONS INBOX
// ==========================================

export async function markNotificationReadAction(
  notificationId: string
): Promise<ActionResult> {
  try {
    const ctx = await getAuthenticatedUserContext();
    if (!ctx) {
      return { ok: false, error: "Unauthorized." };
    }

    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: ctx.dbUser.id,
      },
      data: { isRead: true },
    });

    revalidatePath("/homeowner/messages");
    return { ok: true };
  } catch (err) {
    console.error("[markNotificationReadAction]", err);
    return { ok: false, error: "Could not mark notification as read." };
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    const ctx = await getAuthenticatedUserContext();
    if (!ctx) {
      return { ok: false, error: "Unauthorized." };
    }

    await prisma.notification.updateMany({
      where: {
        userId: ctx.dbUser.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    revalidatePath("/homeowner/messages");
    return { ok: true };
  } catch (err) {
    console.error("[markAllNotificationsReadAction]", err);
    return { ok: false, error: "Could not update notifications." };
  }
}

// ==========================================
// 4. SETTINGS: PASSWORD & SOFT DELETE ACCOUNT
// ==========================================

export async function updateHomeownerPasswordAction(input: {
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  try {
    const ctx = await getAuthenticatedUserContext();
    if (!ctx) {
      return { ok: false, error: "Unauthorized. Please sign in again." };
    }

    if (input.newPassword.length < 8) {
      return {
        ok: false,
        error: "Password must be at least 8 characters long.",
      };
    }

    if (input.newPassword !== input.confirmPassword) {
      return { ok: false, error: "Passwords do not match." };
    }

    const { error } = await ctx.supabase.auth.updateUser({
      password: input.newPassword,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, message: "Password updated successfully." };
  } catch (err) {
    console.error("[updateHomeownerPasswordAction]", err);
    return { ok: false, error: "Could not update password." };
  }
}

export async function softDeleteHomeownerAccountAction(): Promise<ActionResult> {
  try {
    const ctx = await getAuthenticatedUserContext();
    if (!ctx) {
      return { ok: false, error: "Unauthorized." };
    }

    const activeOrdersCount = await prisma.serviceOrder.count({
      where: {
        clientId: ctx.homeowner.id,
        status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] },
      },
    });

    if (activeOrdersCount > 0) {
      return {
        ok: false,
        error:
          "You cannot deactivate your account while you have active or pending orders.",
      };
    }

    await prisma.user.update({
      where: { id: ctx.dbUser.id },
      data: {
        status: "DELETED",
        deletedAt: new Date(),
      },
    });

    return { ok: true };
  } catch (err) {
    console.error("[softDeleteHomeownerAccountAction]", err);
    return {
      ok: false,
      error: "Could not deactivate account. Please try again.",
    };
  }
}