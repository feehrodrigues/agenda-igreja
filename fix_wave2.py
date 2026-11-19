with open(r'src/app/[slug]/PublicCalendar.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """          doc.setFillColor(30, 41, 59);
          const ondaY = altura - 10;
          doc.moveTo(0, altura);
          for (let x = 0; x <= largura; x += 0.5) {
              const t = x / largura;
              const yy = altura - 4 - 14 * (1 - Math.cos(t * Math.PI * 0.5));
              doc.lineTo(x, yy);
          }
          doc.lineTo(largura, altura);
          doc.lineTo(0, altura);
          doc.close();
          doc.fill();"""

new = """          doc.setFillColor(30, 41, 59);
          doc.moveTo(0, altura - 2);
          for (let x = 0; x <= largura; x += 0.5) {
              const t = x / largura;
              const yy = altura - 2 - 18 * Math.pow(t, 0.6);
              doc.lineTo(x, yy);
          }
          doc.lineTo(largura, altura);
          doc.lineTo(0, altura);
          doc.close();
          doc.fill();"""

if old in content:
    content = content.replace(old, new)
    with open(r'src/app/[slug]/PublicCalendar.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK")
else:
    print("NOT FOUND")