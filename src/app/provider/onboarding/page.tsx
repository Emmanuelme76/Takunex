import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "@/components/provider/onboarding/OnboardingWizard";

async function WizardWithServices() {
  const services = await prisma.serviceCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return <OnboardingWizard services={services} />;
}

export default function ProviderOnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-tx-bg" />}>
      <WizardWithServices />
    </Suspense>
  );
}