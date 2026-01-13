import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google' // Importa a fonte do Google
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// A tag <meta> solta que estava aqui foi removida.

export const metadata = {
  title: 'Agenda Igreja',
  description: 'A plataforma gratuita para organização de igrejas e ministérios.',
  // A verificação do Google fica aqui, que é o lugar correto:
  verification: {
    google: "OEuc9eBot0a7AMQ8ZNUiDWrylytBHU4_ey3tUV4Qr2s",
  }
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