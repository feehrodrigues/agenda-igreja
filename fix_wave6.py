with open(r'src/app/[slug]/PublicCalendar.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """          doc.setFillColor(30, 41, 59);
          doc.moveTo(0, altura);
          for (let x = 0; x <= largura; x += 0.5) {
              const t = x / largura;
              // Curva que come�a em baixo, sobe com uma onda no meio, termina em cima.
              const base = altura - 2 - 22 * t;
              const onda = 6 * Math.sin(t * Math.PI * 2);
              const yy = base + onda;
              doc.lineTo(x, yy);
          }
          doc.lineTo(largura, altura);
          doc.lineTo(0, altura);
          doc.close();
          doc.fill();"""

new = """          doc.setFillColor(30, 41, 59);
          doc.moveTo(0, altura);
          for (let x = 0; x <= largura; x += 0.5) {
              const t = x / largura;
              // Onda elegante: comeca em baixo, sobe, desce, sobe ate o topo.
              const base = altura - 4 - 18 * t;
              const onda = 10 * Math.sin(t * Math.PI);
              const yy = base + onda;
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