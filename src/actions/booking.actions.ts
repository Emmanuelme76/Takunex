"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { PaymentMethodType } from "@prisma/client";
import { resolveHomeownerOffer } from "@/lib/offers";

const PLATFORM_COMMISSION_RATE = 0.12; // 12% (rango de negocio: 10% - 15%)

export interface CreateServiceOrderInput {
  providerId: string;
  serviceId: string;
  estimatedHours: number;
  scheduledDate: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  description: string;
  paymentType: "CARD" | "CASH";
  applyOffer: boolean;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  orderId?: string;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function createServiceOrderAction(
  input: CreateServiceOrderInput
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Your session expired. Please sign in again." };
    }

    if (!input.providerId || !input.serviceId) {
      return { success: false, error: "Please select a provider and a service." };
    }

    if (!input.address.trim() || !input.city.trim()) {
      return { success: false, error: "Service address and city are required." };
    }

    const scheduled = new Date(input.scheduledDate);
    if (Number.isNaN(scheduled.getTime()) || scheduled <= new Date()) {
      return {
        success: false,
        error: "Please choose a valid future date and time for the service.",
      };
    }

    const hours = Math.min(Math.max(Number(input.estimatedHours) || 1, 1), 12);

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      include: {
        homeowner: {
          select: { id: true },
        },
      },
    });

    if (!dbUser) {
      return { success: false, error: "User profile not found in database." };
    }

    const homeowner =
      dbUser.homeowner ??
      (await prisma.homeowner.create({
        data: { userId: dbUser.id },
        select: { id: true },
      }));

    const nonCancelledOrdersCount = await prisma.serviceOrder.count({
      where: {
        clientId: homeowner.id,
        status: { not: "CANCELLED" },
      },
    });

    const activeOffer = resolveHomeownerOffer(nonCancelledOrdersCount);

    const service = await prisma.providerService.findFirst({
      where: {
        id: input.serviceId,
        providerId: input.providerId,
        isActive: true,
      },
      include: {
        provider: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!service || service.provider.user.status !== "ACTIVE") {
      return {
        success: false,
        error: "The selected service or provider is currently unavailable.",
      };
    }

    const hourlyRate = Number(service.hourlyRate);
    const subtotal = roundMoney(hourlyRate * hours);

    const discountAmount =
      input.applyOffer && activeOffer
        ? roundMoney(subtotal * activeOffer.discountRate)
        : 0;

    const totalAmount = roundMoney(Math.max(subtotal - discountAmount, 0));
    const platformComission = roundMoney(totalAmount * PLATFORM_COMMISSION_RATE);
    const providerNetAmount = roundMoney(totalAmount - platformComission);

    const paymentEnum: PaymentMethodType =
      input.paymentType === "CASH" ? "CASH" : "CARD";

    const createdOrder = await prisma.$transaction(async (tx) => {
      const location = await tx.location.create({
        data: {
          address: input.address.trim(),
          city: input.city.trim(),
          state: input.state.trim() || null,
          zipCode: input.zipCode.trim() || null,
        },
      });

      const order = await tx.serviceOrder.create({
        data: {
          clientId: homeowner.id,
          providerId: service.providerId,
          serviceId: service.id,
          locationId: location.id,
          status: "PENDING",
          scheduledDate: scheduled,
          description: input.description.trim() || null,
        },
      });

      await tx.paymentTransaction.create({
        data: {
          orderId: order.id,
          paymentType: paymentEnum,
          totalAmount: totalAmount.toFixed(2),
          commissionRate: PLATFORM_COMMISSION_RATE.toFixed(2),
          platformComission: platformComission.toFixed(2),
          providerNetAmount: providerNetAmount.toFixed(2),
          status: paymentEnum === "CARD" ? "SUCCESS" : "PENDING",
        },
      });

      await tx.notification.create({
        data: {
          userId: dbUser.id,
          title: "Service request sent",
          message: `Your request for "${service.title}" with ${service.provider.user.firstName} ${service.provider.user.lastName} has been submitted.`,
          metadata: {
            orderId: order.id,
            totalAmount,
            platformComission,
            providerNetAmount,
            paymentType: paymentEnum,
            appliedOfferCode: input.applyOffer && activeOffer ? activeOffer.code : null,
          },
        },
      });

      await tx.notification.create({
        data: {
          userId: service.provider.user.id,
          title: "New service request",
          message: `${dbUser.firstName} ${dbUser.lastName} requested "${service.title}" (${hours}h).`,
          metadata: {
            orderId: order.id,
            providerNetAmount,
          },
        },
      });

      return order;
    });

    revalidatePath("/homeowner/dashboard");
    revalidatePath("/homeowner/orders");

    return {
      success: true,
      orderId: createdOrder.id,
    };
  } catch (error) {
    console.error("[createServiceOrderAction] Error:", error);
    return {
      success: false,
      error: "Unexpected error while creating your service request.",
    };
  }
}

export async function seedSampleProvidersAction(): Promise<ActionResult> {
  try {
    const existingProviders = await prisma.provider.count();
    if (existingProviders > 0) {
      return { success: true };
    }

    const categoriesData = [
      { name: "Plumbing", description: "Pipe repairs, leaks, and installations" },
      { name: "Electrical", description: "Wiring, outlets, and lighting" },
      { name: "Cleaning", description: "Deep home and office cleaning" },
      { name: "Carpentry", description: "Custom woodwork and furniture repair" },
    ];

    const categories: Record<string, string> = {};
    for (const cat of categoriesData) {
      const record = await prisma.serviceCategory.upsert({
        where: { name: cat.name },
        update: {},
        create: cat,
      });
      categories[cat.name] = record.id;
    }

    const sampleProviders = [
      {
        email: "alejandro.mendoza@takunex.demo",
        firstName: "Alejandro",
        lastName: "Mendoza",
        rating: 4.5,
        totalReviews: 18,
        aboutMe: "Specialist in residential carpentry, doors, and custom cabinetry.",
        services: [
          {
            category: "Carpentry",
            title: "Door & Cabinet Repair",
            description: "Adjustment, hinges, locks, and wood restoration.",
            hourlyRate: "32.00",
          },
          {
            category: "Carpentry",
            title: "Custom Shelving Installation",
            description: "Measuring, mounting, and finishing wooden shelves.",
            hourlyRate: "38.00",
          },
        ],
      },
      {
        email: "carlos.ramirez@takunex.demo",
        firstName: "Carlos",
        lastName: "Ramirez",
        rating: 4.1,
        totalReviews: 12,
        aboutMe: "Certified plumber and residential electrician with 8 years of experience.",
        services: [
          {
            category: "Plumbing",
            title: "Leak Detection & Pipe Repair",
            description: "Fast repair for kitchen, bathroom, and water heater leaks.",
            hourlyRate: "40.00",
          },
          {
            category: "Electrical",
            title: "Outlet & Breaker Replacement",
            description: "Safe diagnostics and replacement of switches and breakers.",
            hourlyRate: "45.00",
          },
        ],
      },
      {
        email: "genesis.torres@takunex.demo",
        firstName: "Génesis",
        lastName: "Torres",
        rating: 4.9,
        totalReviews: 31,
        aboutMe: "Detailed residential deep cleaning with eco-friendly supplies.",
        services: [
          {
            category: "Cleaning",
            title: "Full Home Deep Cleaning",
            description: "Kitchen, bathrooms, bedrooms, and living areas sanitization.",
            hourlyRate: "28.00",
          },
        ],
      },
      {
        email: "diego.garcia@takunex.demo",
        firstName: "Diego",
        lastName: "García",
        rating: 5.0,
        totalReviews: 42,
        aboutMe: "Professional, fast, and completely reliable plumbing technician.",
        services: [
          {
            category: "Plumbing",
            title: "Water Heater & Faucet Installation",
            description: "Complete installation and pressure testing.",
            hourlyRate: "42.00",
          },
        ],
      },
    ];

    for (const item of sampleProviders) {
      const user = await prisma.user.upsert({
        where: { email: item.email },
        update: {},
        create: {
          supabaseAuthId: `demo-auth-${item.email}`,
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email,
          role: "PROVIDER",
          status: "ACTIVE",
          emailVerified: true,
          phoneVerified: true,
        },
      });

      const provider = await prisma.provider.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          aboutMe: item.aboutMe,
          operationalStatus: "ACTIVE",
          verificationStatus: "APPROVED",
          rating: item.rating,
          totalReviews: item.totalReviews,
        },
      });

      for (const svc of item.services) {
        await prisma.providerService.create({
          data: {
            providerId: provider.id,
            categoryId: categories[svc.category],
            title: svc.title,
            description: svc.description,
            hourlyRate: svc.hourlyRate,
            isActive: true,
          },
        });
      }
    }

    revalidatePath("/homeowner/dashboard");
    revalidatePath("/homeowner/new-request");

    return { success: true };
  } catch (error) {
    console.error("[seedSampleProvidersAction] Error:", error);
    return {
      success: false,
      error: "Could not seed sample providers. Check database connection.",
    };
  }
}