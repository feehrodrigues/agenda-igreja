import { UserButton } from "@clerk/nextjs"; 
import { auth } from "@clerk/nextjs/server"; 
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import JoinRoomForm from "./JoinRoomForm";
import CreateRoomForm from "./CreateRoomForm"; // <--- Importamos o novo componente

const prisma = new PrismaClient();

export default async function Dashboard() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  // Busca minhas salas
  const memberships = await prisma.member.findMany({ 
      where: { userId }, 
      include: { room: true }, 
      orderBy: { room: { name: 'asc' } } 
  });
  const myRooms = memberships.map(m => m.room);

  // Busca possíveis pais (apenas setores e ministérios) para passar pro formulário
  const allParentRooms = await prisma.room.findMany({ 
      where: { type: { in: ['ministerio', 'setor'] } }, 
      orderBy: { name: 'asc' } 
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans text-slate-900">
      <header className="max-w-7xl mx-auto flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📅</span>
            <h1 className="text-3xl font-black text-slate-900">Painel de Controle</h1>
          </div>
          <UserButton afterSignOutUrl="/"/>
      </header>
      
      <main className="max-w-7xl mx-auto grid gap-10 lg:grid-cols-3">
        {/* COLUNA DA ESQUERDA: LISTA DE SALAS */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">📂 Minhas Agendas</h2>
          {myRooms.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl shadow-sm border-2 border-dashed border-slate-200 text-center">
                <p className="text-slate-600 font-bold text-lg">Nenhuma agenda encontrada.</p>
                <p className="text-sm text-slate-500 mt-2">Use os formulários ao lado para começar.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {myRooms.map(room => (
                <div key={room.id} className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all border border-slate-200 flex flex-col overflow-hidden group hover:-translate-y-1">
                  <div className="p-6 flex-1" style={{ borderTop: `6px solid ${room.color}` }}>
                    <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200 mb-3 inline-block tracking-wide">{room.type}</span>
                    <h3 className="font-extrabold text-slate-900 text-2xl truncate">{room.name}</h3>
                    <p className="text-sm text-slate-400 mt-1 truncate">/{room.slug}</p>
                  </div>
                  <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex justify-between items-center">
                    <Link href={`/${room.slug}`} target="_blank" className="text-sm text-slate-600 hover:text-blue-600 font-bold flex items-center gap-1.5 transition-colors">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg> Ver Site
                    </Link>
                    <Link href={`/dashboard/${room.slug}`} className="text-sm bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg group-hover:bg-blue-600 transition-all">Gerenciar ➔</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COLUNA DA DIREITA: FORMULÁRIOS */}
        <div className="h-fit sticky top-8 space-y-8">
          {/* Aqui usamos o novo componente com busca */}
          <CreateRoomForm allParentRooms={allParentRooms} />
          
          <JoinRoomForm />
        </div>
      </main>
    </div>
  );
}