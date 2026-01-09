import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google' // Importa a fonte do Google
import './globals.css'

// Configura a fonte para ser usada em todo o site
const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Agenda Ministerial Pro',
  description: 'A plataforma definitiva para organização de igrejas e ministérios.',
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