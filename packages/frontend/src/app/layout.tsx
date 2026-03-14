import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '../components/Providers'
import { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://daodegen.com'),
  title: {
    default: 'Dao DeGen',
    template: '%s | Dao DeGen',
  },
  description: '81 Verses of DeFi Wisdom. Own verses as NFTs and earn from every token trade. Powered by Uniswap V4.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
  openGraph: {
    title: 'Dao DeGen',
    description: '81 Verses of DeFi Wisdom. Own verses as NFTs and earn from every token trade.',
    siteName: 'Dao DeGen',
    type: 'website',
    locale: 'en_US',
    url: 'https://daodegen.com',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@srsmoneybizness',
    creator: '@Potatoofdoom',
    title: 'Dao DeGen',
    description: '81 Verses of DeFi Wisdom. Own verses as NFTs and earn from every token trade.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#8b5cf6" />
      </head>
      <body className={`${inter.className} bg-dao-dark text-white min-h-screen`}>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-L44YY0ZPBC" />
        <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-L44YY0ZPBC');` }} />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}