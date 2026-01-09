import Link from "next/link";
import { ArrowLeft, Calendar, Shield, Share2, Search, Layers } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white border-b p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
            <h1 className="text-2xl font-black text-slate-900">Central de Ajuda</h1>
            <Link href="/" className="flex items-center gap-2 text-slate-600 font-bold hover:text-blue-600 transition">
                <ArrowLeft size={20}/> Voltar ao Início
            </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-10">
        
        {/* Intro */}
        <section className="text-center py-10">
            <h2 className="text-4xl font-black text-slate-900 mb-4">Como usar a Agenda da Igreja?</h2>
            <p className="text-lg text-slate-600">Um guia rápido para Secretários, Líderes e Membros.</p>
        </section>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center text-blue-600 mb-4"><Shield size={24}/></div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Para Administradores</h3>
                <ul className="space-y-2 text-slate-600 text-sm">
                    <li>• <strong>Criar Salas:</strong> Crie agendas para setores, departamentos ou congregações.</li>
                    <li>• <strong>Hierarquia:</strong> Associe uma congregação a um Setor (Pai) para receber eventos automaticamente.</li>
                    <li>• <strong>Categorias:</strong> Crie cores e etiquetas para organizar (ex: "Jovens", "Círculo de Oração").</li>
                    <li>• <strong>Gestão:</strong> Edite, exclua ou repita eventos com facilidade.</li>
                </ul>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="bg-emerald-100 w-12 h-12 rounded-lg flex items-center justify-center text-emerald-600 mb-4"><Calendar size={24}/></div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Para Membros</h3>
                <ul className="space-y-2 text-slate-600 text-sm">
                    <li>• <strong>Visualizar:</strong> Acesse a agenda da sua congregação sempre atualizada.</li>
                    <li>• <strong>Seguir:</strong> Receba atualizações e salve no seu Google Agenda.</li>
                    <li>• <strong>Buscar:</strong> Pesquise eventos passados ou futuros facilmente.</li>
                    <li>• <strong>Baixar:</strong> Exporte a agenda do mês em PDF ou Excel.</li>
                </ul>
            </div>
        </div>

        {/* FAQ / Dicas */}
        <section className="space-y-6">
            <h3 className="text-2xl font-bold text-slate-900 border-b pb-2">Perguntas Frequentes</h3>
            
            <div className="space-y-4">
                <details className="bg-white p-4 rounded-xl border border-slate-200 cursor-pointer group">
                    <summary className="font-bold text-slate-800 flex items-center gap-2 list-none"><Layers size={18} className="text-blue-500"/> O que é a "Visão em Cascata"?</summary>
                    <p className="mt-3 text-slate-600 text-sm pl-7">É um recurso inteligente. Se um Setor cria um evento (ex: "Santa Ceia Geral") e marca como "Visível para filhos", esse evento aparecerá automaticamente na agenda de todas as congregações ligadas àquele setor.</p>
                </details>

                <details className="bg-white p-4 rounded-xl border border-slate-200 cursor-pointer group">
                    <summary className="font-bold text-slate-800 flex items-center gap-2 list-none"><Share2 size={18} className="text-blue-500"/> Como sincronizo com meu celular?</summary>
                    <p className="mt-3 text-slate-600 text-sm pl-7">Na página pública da agenda, clique no botão <strong>"Add Google"</strong>. Isso abrirá seu Google Agenda. Confirme a inscrição. Agora, tudo que o secretário lançar aparecerá no seu celular automaticamente.</p>
                </details>

                <details className="bg-white p-4 rounded-xl border border-slate-200 cursor-pointer group">
                    <summary className="font-bold text-slate-800 flex items-center gap-2 list-none"><Search size={18} className="text-blue-500"/> Como acho um evento antigo?</summary>
                    <p className="mt-3 text-slate-600 text-sm pl-7">Use a barra de pesquisa no topo. Digite o nome e aperte <strong>ENTER</strong>. O sistema vai gerar uma lista com todos os eventos encontrados, desde o passado até o futuro.</p>
                </details>
            </div>
        </section>
      </main>
    </div>
  );
}