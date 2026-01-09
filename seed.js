const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Criando usuários e salas...')
  
  await prisma.event.deleteMany()
  await prisma.room.deleteMany()
  await prisma.user.deleteMany()

  // 1. Criar Usuário da SEDE
  const userSede = await prisma.user.create({
    data: { 
      email: 'sede@igreja.com', 
      password: '123', 
      name: 'Pastor Presidente' 
    }
  })

  // 2. Criar Usuário do SETOR 46
  const userSetor = await prisma.user.create({
    data: { 
      email: 'joao@setor46.com', 
      password: '123', 
      name: 'Pr. João (Setor 46)' 
    }
  })

  // 3. Sala da SEDE (Dono: userSede)
  const ministerio = await prisma.room.create({
    data: {
      name: 'Ministério Sede',
      slug: 'ministerio-sede',
      type: 'ministerio',
      color: '#dc2626',
      ownerId: userSede.id // <--- VINCULADO AO DONO
    }
  })

  // 4. Sala do SETOR 46 (Dono: userSetor)
  const setor = await prisma.room.create({
    data: {
      name: 'Setor 46',
      slug: 'setor-46',
      type: 'setor',
      parentId: ministerio.id,
      color: '#2563eb',
      ownerId: userSetor.id // <--- VINCULADO AO DONO
    }
  })

  console.log('✅ Tudo criado!')
  console.log('👉 Login Sede: sede@igreja.com / 123')
  console.log('👉 Login Setor: joao@setor46.com / 123')
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect())