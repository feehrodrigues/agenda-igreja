with open(r'src/app/[slug]/PublicCalendar.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Move AgendaIgreja up and room name down
old1 = """          // Marca AgendaIgreja (canto superior direito).
          ctx.font = 'bold 18px Arial, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.textAlign = 'right';
          ctx.fillText('AgendaIgreja', 1030, 35);
          ctx.textAlign = 'left';

          // Nome da sala.
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 48px Arial, sans-serif';
          ctx.fillText(room.name, 50, 60);

          // Subtítulo.
          ctx.font = '24px Arial, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('Agenda da Semana', 50, 95);

          // Data da semana (mais visível).
          ctx.font = 'bold 22px Arial, sans-serif';
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText(tituloDaSemana(), 50, 125);"""

new1 = """          // Marca AgendaIgreja (canto superior direito).
          ctx.font = 'bold 18px Arial, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.textAlign = 'right';
          ctx.fillText('AgendaIgreja', 1030, 28);
          ctx.textAlign = 'left';

          // Nome da sala.
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 48px Arial, sans-serif';
          ctx.fillText(room.name, 50, 70);

          // Subtítulo.
          ctx.font = '24px Arial, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('Agenda da Semana', 50, 105);

          // Data da semana (mais visível).
          ctx.font = 'bold 22px Arial, sans-serif';
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText(tituloDaSemana(), 50, 135);"""

assert old1 in content, "old1 not found"
content = content.replace(old1, new1)

with open(r'src/app/[slug]/PublicCalendar.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("OK")