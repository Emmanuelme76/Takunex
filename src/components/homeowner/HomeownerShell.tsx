"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutUser } from "@/actions/auth.actions";

interface HomeownerShellProps {
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  {
    label: "Home",
    href: "/homeowner/dashboard",
    iconSrc: "/home-si-rellenar%201.svg",
  },
  {
    label: "Profile",
    href: "/homeowner/profile",
    iconSrc: "/Profile%20side%20bar.svg",
  },
  {
    label: "Orders",
    href: "/homeowner/orders",
    iconSrc: "/list%201.svg",
  },
  {
    label: "Messages",
    href: "/homeowner/messages",
    iconSrc: "/message%201.svg",
  },
  {
    label: "History",
    href: "/homeowner/history",
    iconSrc: "/history%201.svg",
  },
  {
    label: "Settings",
    href: "/homeowner/settings",
    iconSrc: "/settings%201.svg",
  },
];

function SidebarSvgIcon({
  src,
  isActive,
}: {
  src: string;
  isActive: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-5 w-5 shrink-0 transition-colors ${
        isActive ? "bg-tx-sky" : "bg-white"
      }`}
      style={{
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

export function HomeownerShell({
  userName,
  userEmail,
  children,
}: HomeownerShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      router.push("/homeowner/dashboard");
      return;
    }
    router.push(`/homeowner/dashboard?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSignOut = async () => {
    await logoutUser();
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-screen bg-tx-canvas">
      {/* Sidebar fijo izquierdo (#00171F) */}
      <aside className="hidden w-56 shrink-0 flex-col justify-between bg-tx-ink text-white md:flex">
        <div>
          {/* Logo TX */}
          <div className="flex h-28 items-center px-6 pt-3">
            <Link
              href="/homeowner/dashboard"
              className="flex items-center"
              aria-label="Takunex Home"
            >
              <img
                src="/logo-tx.svg"
                alt="Takunex"
                className="h-16 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Navegación principal */}
          <nav className="mt-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3.5 border-l-4 px-6 py-3.5 text-sm font-medium transition ${
                    isActive
                      ? "border-tx-sky bg-tx-navy text-tx-sky"
                      : "border-transparent text-white/90 hover:bg-tx-navy/50 hover:text-white"
                  }`}
                >
                  <SidebarSvgIcon src={item.iconSrc} isActive={isActive} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Botón cerrar sesión al fondo del sidebar */}
        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-tx-gray transition hover:bg-tx-navy hover:text-white"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Columna derecha: Topbar azul (#003459) + Área de contenido */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-20 items-center justify-between bg-tx-navy px-6 md:px-8">
          {/* Buscador tipo píldora */}
          <form onSubmit={handleSearch} className="w-full max-w-md">
            <div className="relative flex items-center">
              <svg
                className="pointer-events-none absolute left-4 h-5 w-5 text-tx-gray-light"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find a Provider ..."
                className="w-full rounded-full bg-white py-2.5 pl-12 pr-4 text-sm text-tx-black placeholder-tx-gray-muted shadow-sm focus:outline-none focus:ring-2 focus:ring-tx-sky"
              />
            </div>
          </form>

          {/* Iconos derechos: Notificaciones y Avatar */}
          <div className="ml-4 flex items-center gap-5">
            <button
              type="button"
              aria-label="Notifications"
              className="relative rounded-full p-2 transition hover:bg-tx-ink/40"
            >
              <img
                src="/notifications-outline%201.svg"
                alt="Notifications"
                className="h-6 w-6 object-contain"
              />
            </button>

            {/* Avatar desplegable */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="User menu"
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white/20 transition hover:border-tx-sky"
              >
                <img
                  src="/profile.svg"
                  alt={userName || "User profile"}
                  className="h-full w-full object-cover"
                />
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-tx-gray-light bg-white py-2 shadow-lg">
                  <div className="border-b border-tx-canvas px-4 py-2">
                    <p className="truncate text-sm font-semibold text-tx-black">
                      {userName}
                    </p>
                    <p className="truncate text-xs text-tx-gray-dark">
                      {userEmail}
                    </p>
                  </div>
                  <Link
                    href="/homeowner/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-xs font-medium text-tx-ink hover:bg-tx-canvas"
                  >
                    My Profile
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="block w-full px-4 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Contenido principal */}
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}