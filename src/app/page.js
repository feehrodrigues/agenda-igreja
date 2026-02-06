import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowRight, Heart, Calendar } from "lucide-react";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#3D3630]">
      <nav className="fixed w-full z-50 bg-[#FDFBF7]/80 backdrop-blur-md border-b border-[#F2E8D5]">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#3D3630] rounded-2xl flex items-center justify-center text-[#FDFBF7] shadow-xl shadow-[#3d3630]/10 text-xl">📅</div>
            <span className="text-xl font-black tracking-tight">Agenda<span className="text-[#D2B48C]">Igreja</span></span>
          </div>
          <div className="flex gap-4 items-center">
            <Link href="/sign-in" className="text-sm font-bold hover:text-[#D2B48C] transition px-4">Entrar</Link>
            <Link href="/sign-up" className="bg-[#3D3630] text-white px-6 py-3 rounded-2xl text-sm font-bold hover:shadow-2xl transition-all active:scale-95 shadow-lg shadow-[#3d3630]/20">Cadastrar Igreja</Link>
          </div>
        </div>
      </nav>

      <main className="pt-48 pb-32 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[#D2B48C]/5 blur-[120px] rounded-full -z-10"></div>
        
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <div className="inline-flex items-center gap-2 bg-white border border-[#F2E8D5] text-[#8B7355] px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-sm">
            <Heart size={14} className="fill-[#8B7355]" /> Projeto Gratuito para o Reino
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black leading-[0.9] tracking-tighter text-[#3D3630]">
            A organização que <br className="hidden md:block"/> seu <span className="italic font-serif text-[#D2B48C] font-normal">Ministério</span> merece.
          </h1>
          
          <p className="text-xl md:text-2xl text-[#7A7167] max-w-2xl mx-auto font-medium leading-relaxed">
            Sincronize sua igreja, organize seus departamentos e mantenha todos informados com elegância e simplicidade.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Link href="/sign-up" className="flex items-center justify-center gap-3 bg-[#3D3630] text-[#FDFBF7] px-12 py-6 rounded-[2rem] font-bold text-xl hover:shadow-2xl transition-all active:scale-95 shadow-xl shadow-[#3d3630]/20">
              Começar Agora <ArrowRight size={24}/>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#F2E8D5] py-20 text-center text-[#7A7167]">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 items-center gap-10">
          <div className="text-left font-black text-xl">Agenda<span className="text-[#D2B48C]">Igreja</span></div>
          <div className="text-sm font-medium italic">"Mas faça-se tudo decentemente e com ordem."</div>
          <div className="text-right text-xs font-bold uppercase tracking-widest">© {new Date().getFullYear()} - FEEH RODRIGUES</div>
        </div>
      </footer>
    </div>
  );
}