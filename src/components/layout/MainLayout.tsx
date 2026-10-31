import { type ReactNode, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'

interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isMobileMenuOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isMobileMenuOpen])

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      <TopNav
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuToggle={() => setIsMobileMenuOpen((open) => !open)}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:block w-64 fixed left-0 top-16 h-[calc(100vh-4rem)] z-30">
          <Sidebar />
        </div>

        <div
          className={isMobileMenuOpen ? 'fixed inset-0 z-40 md:hidden' : 'hidden'}
          aria-hidden={!isMobileMenuOpen}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="關閉導覽選單"
          />
          <div className="absolute bottom-0 left-0 top-0 w-72 max-w-[85vw] bg-background shadow-xl">
            <Sidebar onNavigate={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 md:ml-64">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
