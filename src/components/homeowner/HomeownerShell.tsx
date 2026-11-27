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
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" />
      </svg>
    ),
  },
  {
    label: "Profile",
    href: "/homeowner/profile",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0" />
      </svg>
    ),
  },
  {
    label: "Orders",
    href: "/homeowner/orders",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h4" />
      </svg>
    ),
  },
  {
    label: "Messages",
    href: "/homeowner/messages",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3h6m-9.75 6.75V6.75A2.25 2.25 0 016 4.5h12a2.25 2.25 0 012.25 2.25v7.5A2.25 2.25 0 0118 16.5H8.25L3.75 20.25z" />
      </svg>
    ),
  },
  {
    label: "History",
    href: "/homeowner/history",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/homeowner/settings",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

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
          <div className="flex h-24 items-center px-7 pt-2">
            <Link href="/homeowner/dashboard" className="flex items-center gap-1" aria-label="Takunex Home">
              <svg className="h-12 w-auto" viewBox="0 0 110 70" fill="none">
                <path d="M6 8H56V20H37V62H24V20H6V8Z" fill="#FFFFFF" />
                <path d="M47 16H62L75 34L88 16H103L83 41L104 62H89L75 47L61 62H46L67 41L47 16Z" fill="#FFFFFF" />
              </svg>
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
                  <span className={isActive ? "text-tx-sky" : "text-white"}>
                    {item.icon}
                  </span>
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
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Columna derecha: Topbar oscuro + Área de contenido */}
      <div className="flex flex-1 flex-col">
        {/* Topbar superior (#00171F) */}
        <header className="flex h-20 items-center justify-between bg-tx-ink px-6 md:px-8">
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
              className="relative rounded-full p-2 text-white transition hover:bg-tx-navy"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>
            </button>

            {/* Avatar desplegable */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="User menu"
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white/20 bg-tx-gray-light text-tx-navy transition hover:border-tx-sky"
              >
                <svg className="h-8 w-8 text-tx-navy" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-tx-gray-light bg-white py-2 shadow-lg">
                  <div className="border-b border-tx-canvas px-4 py-2">
                    <p className="truncate text-sm font-semibold text-tx-black">{userName}</p>
                    <p className="truncate text-xs text-tx-gray-dark">{userEmail}</p>
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