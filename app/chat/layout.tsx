'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { FaGavel, FaBalanceScale, FaBook, FaFolder, FaSignOutAlt, FaUser, FaHome } from 'react-icons/fa';
import { useEffect } from 'react';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated' && pathname === '/chat') {
      router.push('/chat/legal');
    }
  }, [status, router, pathname]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' });
  };

  if (status === 'loading') {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto"></div>
          <p className="mt-4 text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const navItems = [
    {
      href: '/chat/legal',
      label: 'Chat',
      icon: FaBalanceScale,
      active: pathname === '/chat/legal'
    },
    {
      href: '/chat/cases',
      label: 'Case Analysis',
      icon: FaBook,
      active: pathname === '/chat/cases' || pathname?.startsWith('/chat/cases/')
    },
    {
      href: '/chat/documents',
      label: 'Document chat',
      icon: FaFolder,
      active: pathname === '/chat/documents' || pathname?.startsWith('/chat/documents/')
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top Navigation Bar */}
      <nav className="bg-slate-950 sticky top-0 z-50 pt-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/chat/legal" className="flex items-center group">
              <span className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent pb-1">
                🍃Sytha
              </span>
            </Link>

            {/* Center Navigation */}
            <div className="flex items-center gap-2">
              {navItems.map((item) => {
                const colors = {
                  '/chat/legal': 'emerald',
                  '/chat/cases': 'teal',
                  '/chat/documents': 'blue'
                };
                const color = colors[item.href as keyof typeof colors];
                const activeClasses = {
                  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50',
                  teal: 'bg-gradient-to-r from-emerald-500/10 to-blue-500/10 text-transparent bg-clip-text [text-shadow:none] border-emerald-500/50',
                  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/50'
                };
                const hoverClasses = {
                  emerald: 'hover:bg-emerald-500/5 hover:text-emerald-300 hover:border-emerald-500/30',
                  teal: 'hover:bg-gradient-to-r hover:from-emerald-500/5 hover:to-blue-500/5 hover:border-emerald-500/30',
                  blue: 'hover:bg-blue-500/5 hover:text-blue-300 hover:border-blue-500/30'
                };
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                      item.active
                        ? activeClasses[color as keyof typeof activeClasses]
                        : `text-slate-400 border-transparent ${hoverClasses[color as keyof typeof hoverClasses]}`
                    }`}
                  >
                    <span className={item.active && color === 'teal' ? 'bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent' : ''}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Right Side - User & Sign Out */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {session.user?.image ? (
                  <img 
                    src={session.user.image} 
                    alt="Profile" 
                    className="w-7 h-7 rounded-full"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <FaUser className="text-white text-xs" />
                  </div>
                )}
                <span className="text-sm text-slate-300 max-w-[120px] truncate">
                  {session.user?.name?.split(' ')[0] || 'User'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 rounded-xl transition-all shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40"
              >
                <FaSignOutAlt className="text-sm" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
}