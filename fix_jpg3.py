with open(r'src/app/[slug]/PublicCalendar.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """          const canvas = await html2canvas(weekRef.current, {
              scale: 2,
              backgroundColor: '#ffffff',
              useCORS: false,
              allowTaint: true,
              logging: false,
              ignoreElements: (el) => false,
          });"""

new = """          const canvas = await html2canvas(weekRef.current, {
              scale: 2,
              backgroundColor: '#ffffff',
              useCORS: false,
              allowTaint: true,
              logging: false,
              onclone: (clonedDoc) => {
                  // Remove todos os stylesheets (Tailwind v4 usa lab() que html2canvas não suporta).
                  const links = clonedDoc.querySelectorAll('link[rel="stylesheet"], style');
                  links.forEach((el) => el.remove());
                  // Aplica estilos inline básicos.
                  const el = clonedDoc.querySelector('[data-week-ref]') || clonedDoc.querySelector('.rounded-2xl');
                  if (el) {
                      el.style.fontFamily = 'Arial, sans-serif';
                      el.style.color = '#334155';
                      el.style.backgroundColor = '#ffffff';
                  }
              },
          });"""

if old in content:
    content = content.replace(old, new)
    with open(r'src/app/[slug]/PublicCalendar.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK")
else:
    print("NOT FOUND")