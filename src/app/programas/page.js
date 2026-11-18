import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

// Atalho: /programas abre a aba Programas da primeira sala do usuário.
export default async function ProgramasPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  // Prioriza salas que podem promover programas (têm filhos diretos).
  const sala =
    (await prisma.room.findFirst({
      where: {
        children: { some: {} },
        members: { some: { userId } },
      },
      orderBy: { name: "asc" },
      select: { slug: true },
    })) ??
    (await prisma.room.findFirst({
      where: { members: { some: { userId } } },
      orderBy: { name: "asc" },
      select: { slug: true },
    }));

  if (sala) redirect(`/dashboard/${sala.slug}?aba=festividades`);
  redirect("/dashboard");
}
