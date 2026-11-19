with open(r'src/app/[slug]/PublicCalendar.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """      const margem = 14;
      const [r, g, b] = hexToRgb(room.color || '#3b82f6');
      const DIAS_CURTOS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

      // Faixa de cabeçalho com a cor da sala.
      doc.setFillColor(r, g, b);
      doc.rect(0, 0, largura, 30, 'F');
      doc.setTextColor(255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(room.name, margem, 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Agenda da semana · ${tituloDaSemana()}`, margem, 23);

      // Marca discreta à direita.
      doc.setFontSize(8);
      doc.text('AGENDA IGREJA', largura - margem, 15, { align: 'right' });

      let y = 40;"""

new = """      const margem = 18;
      const larguraConteudo = largura - margem * 2;
      const DIAS_CURTOS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

      // Faixa de cabeçalho (padrão slate, não depende da cor da sala).
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, largura, 36, 'F');
      doc.setTextColor(255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text(room.name, margem, 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(203, 213, 225);
      doc.text('Agenda da Semana', margem, 24);
      doc.setFontSize(9);
      doc.text(tituloDaSemana(), margem, 31);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('AGENDA IGREJA', largura - margem, 16, { align: 'right' });

      let y = 46;"""

if old in content:
    content = content.replace(old, new)
    with open(r'src/app/[slug]/PublicCalendar.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK")
else:
    print("NOT FOUND")