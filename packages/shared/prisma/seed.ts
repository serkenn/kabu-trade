import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // パスワードポリシー準拠: 12文字以上、大小英数字+記号
  const adminPassword = await bcrypt.hash("Admin@2026!Secure", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@kabutrade.local" },
    update: {},
    create: {
      email: "admin@kabutrade.local",
      name: "管理者",
      passwordHash: adminPassword,
      role: "ADMIN",
      balance: 100000000,
      balanceUsd: 100000,
    },
  });

  const userPassword = await bcrypt.hash("User@2026!Trade", 12);
  const user = await prisma.user.upsert({
    where: { email: "user@kabutrade.local" },
    update: {},
    create: {
      email: "user@kabutrade.local",
      name: "テストユーザー",
      passwordHash: userPassword,
      role: "USER",
      balance: 10000000,
      balanceUsd: 10000,
    },
  });

  console.log("Seeded:");
  console.log(`  Admin: ${admin.email} / Admin@2026!Secure`);
  console.log(`  User:  ${user.email} / User@2026!Trade`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
