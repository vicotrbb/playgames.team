import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SocketProvider } from '@/lib/SocketContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Playgames - Multiplayer Party Games',
  description: 'Play Guessio and other fun party games with your friends! AI generates images from prompts and you guess what the prompt was.',
  keywords: 'party games, multiplayer, AI, image generation, guessing game, friends',
  authors: [{ name: 'Playgames Team' }],
  openGraph: {
    title: 'Playgames - Multiplayer Party Games',
    description: 'Play Guessio and other fun party games with your friends!',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Playgames - Multiplayer Party Games',
    description: 'Play Guessio and other fun party games with your friends!',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <SocketProvider>
            <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
              {children}
            </div>
          </SocketProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}