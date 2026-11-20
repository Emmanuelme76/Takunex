import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// Configuramos en qué rutas debe ejecutarse el middleware
export const config = {
  matcher: [
    /*
     * Ejecuta el middleware en todas las rutas EXCEPTO:
     * - _next/static (archivos estáticos compilados de JS/CSS)
     * - _next/image (optimización de imágenes de Next.js)
     * - favicon.ico (ícono de la pestaña)
     * - Archivos de imagen comunes (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};