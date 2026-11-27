"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import type { AuthActionResult } from "@/actions/auth.actions";
import {
  type OnboardingPayload,
  anyMissing,
  identityMissing,
  payoutMissing,
  profileMissing,
} from "@/components/provider/onboarding/types";

// Confirma que el archivo existe de verdad en Storage y es de este usuario.
// No basta con confiar en la ruta que manda el navegador.
async function fileExists(
  admin: ReturnType<typeof createAdminClient>,
  bucket: "avatars" | "provider-documents",
  userId: string,
  path: string,
): Promise<boolean> {
  if (!path.startsWith(`${userId}/`)) return false;
  const fileName = path.slice(userId.length + 1);
  if (!fileName || fileName.includes("/")) return false;

  const { data, error } = await admin.storage
    .from(bucket)
    .list(userId, { search: fileName });

  return !error && Boolean(data?.some((f) => f.name === fileName));
}

export async function submitProviderOnboarding(
  payload: OnboardingPayload,
): Promise<AuthActionResult> {
  try {
    // 1. Identidad: siempre desde la sesión, nunca desde el cliente
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Session expired. Please log in again." };
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      include: { provider: true },
    });

    if (!dbUser || dbUser.role !== "PROVIDER" || !dbUser.provider) {
      return {
        success: false,
        error: "Only provider accounts can complete this step.",
      };
    }
    if (!dbUser.phoneVerified) {
      return {
        success: false,
        error: "Please verify your phone number first.",
      };
    }

    const provider = dbUser.provider;

    // Si ya envió sus datos, no se vuelve a procesar
    if (
      provider.verificationStatus !== "UNSUBMITTED" &&
      provider.verificationStatus !== "DECLINED"
    ) {
      return { success: true, redirectTo: "/provider/dashboard" };
    }

    // 2. Revalidamos todo en el servidor (el navegador se puede manipular)
    const { profile, identity, payout } = payload;

    if (
      anyMissing(profileMissing({ ...profile, avatarPreview: null })) ||
      anyMissing(identityMissing(identity)) ||
      anyMissing(payoutMissing(payout))
    ) {
      return { success: false, error: "Please complete all required fields." };
    }

    const { avatarPath } = profile;
    const { idCardPath, proofOfAddressPath } = identity;
    if (!avatarPath || !idCardPath || !proofOfAddressPath) {
      return { success: false, error: "Please upload all required files." };
    }

    const manualAddress = profile.manualAddress.trim().slice(0, 200);
    const { lat, lng } = profile;
    const hasGps = lat !== null && lng !== null;
    if (hasGps && (lat < -90 || lat > 90 || lng < -180 || lng > 180)) {
      return { success: false, error: "Invalid location coordinates." };
    }

    const bankName = payout.bankName.trim().slice(0, 60);
    const cardholderName = payout.cardholderName.trim().slice(0, 100);

    // 3. Los archivos deben existir y pertenecer a este usuario
    const admin = createAdminClient();
    const filesOk = await Promise.all([
      fileExists(admin, "avatars", user.id, avatarPath),
      fileExists(admin, "provider-documents", user.id, idCardPath),
      fileExists(admin, "provider-documents", user.id, proofOfAddressPath),
    ]);
    if (filesOk.includes(false)) {
      return { success: false, error: "Invalid file format or size exceeded." };
    }

    // 4. Las categorías elegidas deben existir y estar activas
    const serviceIds = [...new Set(profile.serviceIds)];
    const categories = await prisma.serviceCategory.findMany({
      where: { id: { in: serviceIds }, isActive: true },
    });
    if (categories.length !== serviceIds.length) {
      return {
        success: false,
        error: "One or more selected services are not available.",
      };
    }

    // 5. Datos derivados
    const address = manualAddress || `${lat?.toFixed(5)}, ${lng?.toFixed(5)}`;
    const avatarUrl = admin.storage.from("avatars").getPublicUrl(avatarPath)
      .data.publicUrl;

    // Cobro simulado: solo guardamos los últimos 4 dígitos, nunca el número completo
    const payoutAccountInfo = JSON.stringify({
      bankName,
      cardholderName,
      accountLast4: payout.accountNumber.slice(-4),
      clabeLast4: payout.clabe.slice(-4),
    });

    // 6. Todo se guarda en una transacción: o se guarda completo o nada
    await prisma.$transaction(async (tx) => {
      // Ubicación (si re-envía tras un rechazo, se actualiza la misma fila)
      let workAreaId = provider.workAreaId;
      const locationData = {
        address,
        latitude: hasGps ? lat : null,
        longitude: hasGps ? lng : null,
      };
      if (workAreaId) {
        await tx.location.update({
          where: { id: workAreaId },
          data: locationData,
        });
      } else {
        const location = await tx.location.create({ data: locationData });
        workAreaId = location.id;
      }

      // Documentos: reemplazamos los anteriores del mismo tipo
      await tx.providerDocument.deleteMany({
        where: {
          providerId: provider.id,
          type: { in: ["GOVERNMENT_ID", "PROOF_OF_ADDRESS"] },
        },
      });
      await tx.providerDocument.createMany({
        data: [
          {
            providerId: provider.id,
            type: "GOVERNMENT_ID",
            storagePath: idCardPath,
          },
          {
            providerId: provider.id,
            type: "PROOF_OF_ADDRESS",
            storagePath: proofOfAddressPath,
          },
        ],
      });

      // Servicios: creamos los que faltan y desactivamos los que ya no eligió
      const existing = await tx.providerService.findMany({
        where: { providerId: provider.id },
      });
      const existingByCategory = new Map(
        existing.map((s) => [s.categoryId, s]),
      );

      for (const category of categories) {
        const found = existingByCategory.get(category.id);
        if (found) {
          await tx.providerService.update({
            where: { id: found.id },
            data: { isActive: true },
          });
        } else {
          await tx.providerService.create({
            data: {
              providerId: provider.id,
              categoryId: category.id,
              title: category.name,
              description: `${category.name} services`,
              hourlyRate: 0, // Placeholder: el provider fija su tarifa después
            },
          });
        }
      }

      const selected = new Set(serviceIds);
      const toDeactivate = existing
        .filter((s) => !selected.has(s.categoryId))
        .map((s) => s.id);
      if (toDeactivate.length > 0) {
        await tx.providerService.updateMany({
          where: { id: { in: toDeactivate } },
          data: { isActive: false },
        });
      }

      // Estado del provider y foto de perfil
      await tx.provider.update({
        where: { id: provider.id },
        data: {
          workAreaId,
          payoutAccountInfo,
          verificationStatus: "PENDING_VERIFICATION",
          rejectionReason: null,
        },
      });
      await tx.user.update({ where: { id: dbUser.id }, data: { avatarUrl } });

      // Aviso a los administradores (paso 12 del caso de uso)
      const admins = await tx.user.findMany({
        where: {
          role: { in: ["ADMIN", "SUPER_ADMIN"] },
          status: "ACTIVE",
          deletedAt: null,
        },
        select: { id: true },
      });
      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            title: "New provider verification request",
            message: `${dbUser.firstName} ${dbUser.lastName} submitted documents for review.`,
            metadata: {
              type: "PROVIDER_VERIFICATION",
              providerId: provider.id,
            },
          })),
        });
      }
    });

    // 7. Sincronizamos Supabase para que el middleware los mande al dashboard
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...user.app_metadata,
        provider_status: "PENDING_VERIFICATION",
      },
    });

    return { success: true, redirectTo: "/provider/dashboard" };
  } catch (err) {
    console.error("submitProviderOnboarding failed:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
