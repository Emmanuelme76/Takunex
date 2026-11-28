import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { HomeownerSettingsClient } from "@/components/homeowner/HomeownerSettingsClient";

async function SettingsContent() {
    await connection();

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const dbUser = await prisma.user.findUnique({
        where: { supabaseAuthId: user.id },
        select: {
            email: true,
            role: true,
            createdAt: true,
        },
    });

    if (!dbUser) {
        redirect("/login");
    }

    const createdAtLabel = new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
    }).format(dbUser.createdAt);

    return (
        <HomeownerSettingsClient
            email={dbUser.email}
            role={dbUser.role}
            createdAtLabel={createdAtLabel}
        />
    );
}

export default function SettingsPage() {
    return (
        <Suspense
            fallback={
                <div className="mx-auto max-w-4xl animate-pulse space-y-6">
                    <div className="h-32 rounded-2xl bg-white" />
                    <div className="h-48 rounded-2xl bg-white" />
                </div>
            }
        >
            <SettingsContent />
        </Suspense>
    );
}