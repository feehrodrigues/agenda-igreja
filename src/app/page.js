import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Calendar, Layers, Smartphone, FileText, ArrowRight, ShieldCheck, Heart } from "lucide-react";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-200">
      
      {/* NAVBAR */}
      <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-600/30">📅</div>
            <span className="text-xl font-black text-slate-800 tracking-tight">Agenda<span className="text-blue-600">Eclesiástica</span></span>
          </div>
          <div className="flex gap-4">
            <Link href="/sign-in" className="hidden md:flex items-center text-slate-600 font-bold hover:text-blue-600 transition">
              Entrar
            </Link>
            <Link href="/sign-up" className="bg-slate-900 text-white px-6 py-2.5 rounded-full font-bold hover:bg-slate-800 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
              Cadastrar Igreja
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="pt-32 pb-20 px-6 text-center lg:pt-48 lg:pb-32 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-400/20 blur-[100px] rounded-full -z-10 opacity-50"></div>

        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <Heart size={14} className="fill-emerald-700" />
            Projeto 100% Gratuito e Sem Fins Lucrativos
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-tight">
            A organização que o seu <br className="hidden md:block"/> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Ministério merece.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Uma ferramenta desenvolvida para servir ao Reino. Conecte setores, sincronize congregações e mantenha a igreja informada.
          </p>

          <div className="flex flex-col md:flex-row gap-4 justify-center pt-4">
            <Link href="/sign-up" className="flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-blue-700 transition shadow-xl shadow-blue-600/30">
              Começar a Usar <ArrowRight size={20}/>
            </Link>
            <Link href="/ajuda" className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-full font-bold text-lg hover:bg-slate-50 transition">
              Ver Recursos
            </Link>
          </div>
          
          <p className="text-sm text-slate-400 mt-4 font-medium">
            Disponível gratuitamente para todas as denominações • Sem taxas, hoje e sempre.
          </p>
        </div>
      </section>

      {/* RECURSOS */}
      <section className="bg-white py-24 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900">Feito para servir</h2>
            <p className="text-slate-500 mt-4 text-lg">Substitua planilhas complexas por um sistema simples e integrado.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm mb-6 group-hover:scale-110 transition text-blue-600">
                <Layers size={32}/>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Conexão Setorial</h3>
              <p className="text-slate-600 leading-relaxed">
                Eventos do Ministério ou Setor descem automaticamente para as agendas das congregações locais. Comunicação unificada.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm mb-6 group-hover:scale-110 transition text-emerald-600">
                <Smartphone size={32}/>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Agenda no Celular</h3>
              <p className="text-slate-600 leading-relaxed">
                Membros e obreiros podem sincronizar a agenda da igreja diretamente no Google Agenda de seus celulares.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-purple-200 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm mb-6 group-hover:scale-110 transition text-purple-600">
                <FileText size={32}/>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Relatórios Prontos</h3>
              <p className="text-slate-600 leading-relaxed">
                Gere PDFs para o mural de avisos ou exporte para Excel para a secretaria em apenas um clique.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* VERSÍCULO */}
      <section className="py-20 bg-slate-900 text-center px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-blue-500 mb-6 flex justify-center"><ShieldCheck size={48}/></div>
          <blockquote className="text-2xl md:text-3xl font-medium text-white leading-relaxed font-serif italic">
            "Mas faça-se tudo decentemente e com ordem."
          </blockquote>
          <cite className="block mt-4 text-slate-400 font-bold not-italic uppercase tracking-widest text-sm">1 Coríntios 14:40</cite>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-10 md:p-16 text-white shadow-2xl shadow-blue-900/20 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-black mb-6">Organize sua igreja hoje</h2>
            <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">Junte-se a líderes que estão transformando a gestão eclesiástica com excelência.</p>
            <Link href="/sign-up" className="inline-block bg-white text-blue-700 px-10 py-4 rounded-full font-black text-xl hover:bg-blue-50 transition shadow-lg transform hover:scale-105">
              Criar Conta Gratuita
            </Link>
          </div>
          
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-900/30 rounded-full blur-3xl"></div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-12 text-center text-slate-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-4 text-slate-900 font-bold text-lg">
            <span>📅</span> Agenda Eclesiástica
        </div>
        <p className="mb-6">Desenvolvido voluntariamente para auxiliar a obra de Deus.</p>
        <div className="flex justify-center gap-6 font-medium">
            <Link href="/ajuda" className="hover:text-blue-600 transition">Central de Ajuda</Link>
            <Link href="/sign-in" className="hover:text-blue-600 transition">Acessar Painel</Link>
        </div>
        <p className="mt-8 text-slate-400 text-xs">&copy; {new Date().getFullYear()} Projeto Sem Fins Lucrativos.</p>
      </footer>
    </div>
  );
}