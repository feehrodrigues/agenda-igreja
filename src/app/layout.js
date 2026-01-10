import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google' // Importa a fonte do Google
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// Adicione a meta tag de verificação do Google aqui
<meta name="google-site-verification" content="OEuc9eBot0a7AMQ8ZNUiDWrylytBHU4_ey3tUV4Qr2s" />




export const metadata = {
  title: 'Agenda Igreja',
  description: 'A plataforma gratuita para organização de igrejas e ministérios.',
  // ADICIONE ESTE BLOCO AQUI 👇
  verification: {
    google: "OEuc9eBot0a7AMQ8ZNUiDWrylytBHU4_ey3tUV4Qr2s",}
}

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        {/* Aplica a classe da fonte ao body */}
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  )
}