with open(r'src/app/[slug]/PublicCalendar.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """          const canvas = await html2canvas(weekRef.current, {
              scale: 2,
              backgroundColor: '#ffffff',
              useCORS: false,
              allowTaint: true,
              logging: false,
              onclone: (clonedDoc) => {
                  // Substitui funções de cor lab() (Tailwind v4) por rgb.
                  const styleSheets = Array.from(clonedDoc.styleSheets);
                  for (const sheet of styleSheets) {
                      try {
                          const rules = Array.from(sheet.cssRules || []);
                          for (const rule of rules) {
                              if (rule.style) {
                                  for (let i = 0; i < rule.style.length; i++) {
                                      const prop = rule.style[i];
                                      const val = rule.style.getPropertyValue(prop);
                                      if (val && val.includes('lab(')) {
                                          // Substitui lab() por uma cor segura.
                                          rule.style.setProperty(prop, val.replace(/lab\\([^)]*\\)/g, '#334155'), rule.style.getPropertyPriority(prop));
                                      }
                                  }
                              }
                          }
                      } catch (e) {
                          // Cross-origin stylesheets can't be modified.
                      }
                  }
              },
          });"""

new = """          const canvas = await html2canvas(weekRef.current, {
              scale: 2,
              backgroundColor: '#ffffff',
              useCORS: false,
              allowTaint: true,
              logging: false,
              ignoreElements: (el) => false,
          });"""

if old in content:
    content = content.replace(old, new)
    with open(r'src/app/[slug]/PublicCalendar.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK")
else:
    print("NOT FOUND")