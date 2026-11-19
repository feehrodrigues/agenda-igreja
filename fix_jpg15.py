with open(r'src/app/[slug]/PublicCalendar.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """          // Marca AgendaIgreja (canto superior direito).
          ctx.font = 'bold 18px Arial, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.textAlign = 'right';
          ctx.fillText('AgendaIgreja', 1030, 35);
          ctx.textAlign = 'left';

          // Nome da sala.
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 48px Arial, sans-serif';
          ctx.fillText(room.name, 50, 60);"""

new = """          // Marca AgendaIgreja (canto superior direito).
          ctx.font = 'bold 18px Arial, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.textAlign = 'right';
          ctx.fillText('AgendaIgreja', 1030, 25);
          ctx.textAlign = 'left';

          // Nome da sala.
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 48px Arial, sans-serif';
          ctx.fillText(room.name, 50, 70);"""

if old in content:
    content = content.replace(old, new)
    with open(r'src/app/[slug]/PublicCalendar.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK")
else:
    print("NOT FOUND")