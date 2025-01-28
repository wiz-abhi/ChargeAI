import { ClerkProvider } from "@clerk/nextjs"
import { Inter } from "next/font/google"
import Navbar from "@/components/Navbar"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Navbar />
          {children}
          <footer className="bg-gray-800 text-white text-center py-2 mt-8">
            <p>&copy; {new Date().getFullYear()} Created by Abhishek</p>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  )
}
