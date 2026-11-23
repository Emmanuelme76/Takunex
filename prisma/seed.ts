import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DIRECT_URL or DATABASE_URL environment variable is missing.",
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  console.log("Seeding Takunex database...");

  // 1. Categorías de servicios base en inglés (incluyendo Appliance Repair)
  const categories = [
    {
      name: "Plumbing",
      description: "Pipe repairs, leak fixing, and installations.",
    },
    {
      name: "Electrical",
      description: "Wiring, outlets, lighting, and breaker repairs.",
    },
    {
      name: "Cleaning",
      description: "Deep home cleaning, sanitation, and maintenance.",
    },
    {
      name: "Carpentry",
      description: "Furniture repair, doors, cabinets, and woodwork.",
    },
    {
      name: "Locksmith",
      description: "Lock installation, emergency opening, and key duplication.",
    },
    {
      name: "Painting",
      description: "Interior and exterior residential painting.",
    },
    {
      name: "Appliance Repair",
      description:
        "Maintenance and repair of home appliances such as refrigerators, washers, and ovens.",
    },
  ];

  for (const cat of categories) {
    await prisma.serviceCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log("Service categories created.");

  // 2. Cuenta pre-registrada de SUPER_ADMIN
  const adminEmail = "admin@takunex.com";
  const adminPassword = "AdminTakunex2026!";

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

  if (authError && !authError.message.includes("already been registered")) {
    throw authError;
  }

  let supabaseUserId = authData?.user?.id;
  if (!supabaseUserId) {
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    supabaseUserId = listData.users.find((u) => u.email === adminEmail)?.id;
  }

  if (supabaseUserId) {
    const user = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: 'SUPER_ADMIN' },
      create: {
        supabaseAuthId: supabaseUserId,
        firstName: 'Super',
        lastName: 'Admin',
        email: adminEmail,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
      },
    })

    await prisma.administrator.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
      },
    })
    console.log(`Super Admin ready -> Email: ${adminEmail} | Password: ${adminPassword}`)
  }
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
