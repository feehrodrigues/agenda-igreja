with open(r'src/app/[slug]/PublicCalendar.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Title bigger
old_title = """      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(203, 213, 225);
      doc.text('Agenda da Semana', margem, 24);
      doc.setFontSize(9);
      doc.text(tituloDaSemana(), margem, 31);"""
new_title = """      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(203, 213, 225);
      doc.text('Agenda da Semana', margem, 24);
      doc.setFontSize(11);
      doc.text(tituloDaSemana(), margem, 32);"""
assert old_title in content
content = content.replace(old_title, new_title)

# 2. Parent event box: remove dashed border, round corners more, black text
old_box = """              if (marcaPai) {
                  // Caixinha âmbar para eventos do pai.
                  doc.setFillColor(254, 243, 199);
                  doc.roundedRect(margem + indentacao, y - 4, larguraConteudo - indentacao, 7 + (tituloLinhas.length - 1) * 4.5 + (ev.resource?.roomName && ev.resource.isExternal ? 4 : 0), 1.5, 1.5, 'F');
                  doc.setDrawColor(251, 191, 36);
                  doc.setLineWidth(0.4);
                  doc.roundedRect(margem + indentacao, y - 4, larguraConteudo - indentacao, 7 + (tituloLinhas.length - 1) * 4.5 + (ev.resource?.roomName && ev.resource.isExternal ? 4 : 0), 1.5, 1.5, 'S');
              }

              const hora = ev.allDay ? 'Dia todo' : `${horaSP(ev.start)}–${horaSP(ev.end)}`;
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(8.5);
              doc.setTextColor(marcaPai ? 180 : 71);
              doc.text(hora, margem + 6 + indentacao, y);

              doc.setFont('helvetica', marcaPai ? 'italic' : 'bold');
              doc.setFontSize(10);
              doc.setTextColor(marcaPai ? 146 : 30);
              doc.text(tituloLinhas, margem + 34 + indentacao, y);
              y += (tituloLinhas.length - 1) * 4.5 + 7;

              const local = ev.resource?.roomName && ev.resource.isExternal ? ev.resource.roomName : null;
              if (local) {
                  doc.setFont('helvetica', marcaPai ? 'bold' : 'normal');
                  doc.setFontSize(8);
                  doc.setTextColor(marcaPai ? 180 : 100);
                  doc.text(local, margem + 34 + indentacao, y - 2);
                  y += 3;
              }"""

new_box = """              if (marcaPai) {
                  // Caixinha âmbar para eventos do pai (cantos bem arredondados).
                  doc.setFillColor(254, 243, 199);
                  doc.roundedRect(margem + indentacao, y - 4, larguraConteudo - indentacao, 7 + (tituloLinhas.length - 1) * 4.5 + (ev.resource?.roomName && ev.resource.isExternal ? 4 : 0), 4, 4, 'F');
              }

              const hora = ev.allDay ? 'Dia todo' : `${horaSP(ev.start)}–${horaSP(ev.end)}`;
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(8.5);
              doc.setTextColor(marcaPai ? 120 : 71);
              doc.text(hora, margem + 6 + indentacao, y);

              doc.setFont('helvetica', 'bold');
              doc.setFontSize(10);
              doc.setTextColor(30, 41, 59);
              doc.text(tituloLinhas, margem + 34 + indentacao, y);
              y += (tituloLinhas.length - 1) * 4.5 + 7;

              const local = ev.resource?.roomName && ev.resource.isExternal ? ev.resource.roomName : null;
              if (local) {
                  doc.setFont('helvetica', marcaPai ? 'bold' : 'normal');
                  doc.setFontSize(8);
                  doc.setTextColor(marcaPai ? 120 : 100);
                  doc.text(local, margem + 34 + indentacao, y - 2);
                  y += 3;
              }"""

assert old_box in content
content = content.replace(old_box, new_box)

# 3. Fix footer wave - single curve from bottom to top
old_footer = """          doc.setFillColor(30, 41, 59);
          const ondaY = altura - 14;
          doc.moveTo(0, ondaY);
          for (let x = 0; x <= largura; x += 0.5) {
              const yy = ondaY - 6 * Math.sin((x / largura) * Math.PI);
              doc.lineTo(x, yy);
          }
          doc.lineTo(largura, altura);
          doc.lineTo(0, altura);
          doc.close();
          doc.fill();"""

new_footer = """          doc.setFillColor(30, 41, 59);
          const ondaY = altura - 10;
          doc.moveTo(0, altura);
          doc.lineTo(0, ondaY + 8);
          doc.bezierCurveTo(largura * 0.3, ondaY - 6, largura * 0.7, ondaY + 10, largura, ondaY - 2);
          doc.lineTo(largura, altura);
          doc.close();
          doc.fill();"""

assert old_footer in content
content = content.replace(old_footer, new_footer)

with open(r'src/app/[slug]/PublicCalendar.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("OK")