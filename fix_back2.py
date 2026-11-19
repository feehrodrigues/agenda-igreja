with open(r'src/app/dashboard/[slug]/AdminCalendar.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Voltar: sempre visível, inclusive no celular */}
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition active:scale-95"
                            title="Voltar"
                            aria-label="Voltar"
                        >
                            <ArrowLeft size={18} />
                            <span className="hidden sm:inline">Voltar</span>
                        </button>

                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="flex text-slate-500 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-100 transition-colors" title="Mostrar/ocultar salas">
                            {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                        </button>"""

new = """                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="flex text-slate-500 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-100 transition-colors" title="Mostrar/ocultar salas">
                            {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                        </button>"""

if old in content:
    content = content.replace(old, new)
    with open(r'src/app/dashboard/[slug]/AdminCalendar.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK")
else:
    print("NOT FOUND")