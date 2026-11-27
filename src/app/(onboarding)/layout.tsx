import Image from "next/image";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-tx-bg">
      <header className="bg-tx-ink px-6 py-4">
        <Image src="/logo-tx.svg" alt="Takunex logo" width={64} height={32} priority />
      </header>
      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-12">
        {children}
      </main>
    </div>
  );
}