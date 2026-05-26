import type { Metadata } from 'next'
import localFont from 'next/font/local'
import NextTopLoader from 'nextjs-toploader'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/providers/theme-provider'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'Anamnese IA',
  description: 'Ferramenta de apoio clínico para transcrição e estruturação de anamneses médicas.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <NextTopLoader
            color="var(--primary)"
            initialPosition={0.08}
            crawlSpeed={200}
            height={3}
            crawl={true}
            showSpinner={false}
            easing="ease"
            speed={200}
            shadow="0 0 10px var(--primary),0 0 5px var(--primary)"
          />
          {children}
          <Toaster
            richColors
            position="bottom-right"
            icons={{ loading: <></> }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
