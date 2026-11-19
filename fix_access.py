with open(r'src/app/dashboard/[slug]/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = '  if (!membership) redirect("/dashboard");\n'

new = '''  // Acesso herdado: se o usuario e admin/owner de um ancestral, pode gerenciar
  // esta sala (mesmo que nao seja membro direto dela).
  let acessoHerdado = false;
  if (!membership) {
      let ancestralId = room.parentId;
      while (ancestralId) {
          const m = await prisma.member.findUnique({
              where: { userId_roomId: { userId, roomId: ancestralId } },
          });
          if (m && (m.role === 'OWNER' || m.role === 'ADMIN')) {
              acessoHerdado = true;
              break;
          }
          const anc = await prisma.room.findUnique({
              where: { id: ancestralId },
              select: { parentId: true },
          });
          ancestralId = anc ? anc.parentId : null;
      }
  }

  if (!membership && !acessoHerdado) redirect("/dashboard");\n'''

if old in content:
    content = content.replace(old, new)
    with open(r'src/app/dashboard/[slug]/page.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK")
else:
    print("NOT FOUND")