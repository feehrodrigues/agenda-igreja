with open(r'src/app/[slug]/PublicCalendar.js', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find("          doDia.forEach((ev) => {")
end_marker = "          y += 3;\n      });"
end = content.find(end_marker, start) + len(end_marker)

if start == -1 or end == -1 or end < start:
    print("NOT FOUND", start, end)
else:
    new_block = "          doDia.forEach((ev) => {\n              const marcaPai = ev.resource?.origem === 'pai';\n              const tituloLinhas = doc.splitTextToSize(ev.title, larguraConteudo - 42);\n              novaPaginaSePreciso(8 + (tituloLinhas.length - 1) * 4.5 + 4);\n\n              const indentacao = marcaPai ? 8 : 0;\n\n              if (marcaPai) {\n                  doc.setFillColor(254, 243, 199);\n                  doc.roundedRect(margem + indentacao, y - 4, larguraConteudo - indentacao, 7 + (tituloLinhas.length - 1) * 4.5 + (ev.resource?.roomName && ev.resource.isExternal ? 4 : 0), 1.5, 1.5, 'F');\n                  doc.setDrawColor(251, 191, 36);\n                  doc.setLineWidth(0.4);\n                  doc.roundedRect(margem + indentacao, y - 4, larguraConteudo - indentacao, 7 + (tituloLinhas.length - 1) * 4.5 + (ev.resource?.roomName && ev.resource.isExternal ? 4 : 0), 1.5, 1.5, 'S');\n              }\n\n              const hora = ev.allDay ? 'Dia todo' : (horaSP(ev.start) + '\u2013' + horaSP(ev.end));\n              doc.setFont('helvetica', 'bold');\n              doc.setFontSize(8.5);\n              doc.setTextColor(marcaPai ? 180 : 71);\n              doc.text(hora, margem + 6 + indentacao, y);\n\n              doc.setFont('helvetica', marcaPai ? 'italic' : 'bold');\n              doc.setFontSize(10);\n              doc.setTextColor(marcaPai ? 146 : 30);\n              doc.text(tituloLinhas, margem + 34 + indentacao, y);\n              y += (tituloLinhas.length - 1) * 4.5 + 7;\n\n              const local = ev.resource?.roomName && ev.resource.isExternal ? ev.resource.roomName : null;\n              if (local) {\n                  doc.setFont('helvetica', marcaPai ? 'bold' : 'normal');\n                  doc.setFontSize(8);\n                  doc.setTextColor(marcaPai ? 180 : 100);\n                  doc.text(local, margem + 34 + indentacao, y - 2);\n                  y += 3;\n              }\n              if (marcaPai) {\n                  y += 2;\n              }\n          });\n          y += 4;\n      });"

    content = content[:start] + new_block + content[end:]
    with open(r'src/app/[slug]/PublicCalendar.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK")
