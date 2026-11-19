with open(r'src/app/dashboard/[slug]/RoomDashboard.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
              {room.name.charAt(0)}
            </div>
            <span className="min-w-0 truncate font-black text-slate-800">{room.name}</span>
          </div>'''

new = '''          <div className="flex min-w-0 items-center gap-2">
            <button
                onClick={() => window.location.href = '/dashboard'}
                className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-xl font-bold text-sm whitespace-nowrap transition active:scale-95"
                title="Voltar"
                aria-label="Voltar"
            >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
              {room.name.charAt(0)}
            </div>
            <span className="min-w-0 truncate font-black text-slate-800">{room.name}</span>
          </div>'''

if old in content:
    content = content.replace(old, new)
    with open(r'src/app/dashboard/[slug]/RoomDashboard.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK")
else:
    print("NOT FOUND")