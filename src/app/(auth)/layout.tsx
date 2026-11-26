import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-tx-bg p-4">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-sm">
        {/* Panel izquierdo: se oculta en móvil (responsive) */}
        <aside className="hidden items-center justify-center bg-tx-teal p-10 md:flex md:w-2/5">
          <Image
            src="/logo-tx.svg"
            alt="Takunex logo"
            width={240}
            height={200}
            priority
          />
        </aside>

        {/* Panel derecho: aquí se renderiza cada page.tsx */}
        <section className="flex w-full items-center justify-center px-6 py-10 sm:px-12 md:w-3/5">
          <div className="w-full max-w-sm">{children}</div>
        </section>
      </div>
    </main>
  );
}