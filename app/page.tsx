'use client';

import { useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FaGoogle, FaDatabase, FaShieldAlt, FaCheckCircle, FaBrain, FaFileAlt } from 'react-icons/fa';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/chat/legal');
    }
  }, [status, router]);

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/chat/legal' });
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

  return (
    <div className="h-screen bg-slate-950 overflow-hidden relative">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] -top-48 -left-48 animate-pulse" />
        <div className="absolute w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] -bottom-48 -right-48 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[100px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Main Content - Centered */}
      <div className="relative z-20 h-full flex flex-col justify-between px-8 py-8">
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-5xl w-full">
            {/* Logo + Title with Animation */}
            <div className="text-center mb-12">
              <div className="flex justify-center mb-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium text-emerald-200 shadow-sm shadow-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  RAG-powered assistant
                </div>
              </div>
              <h1 className="text-7xl md:text-8xl mb-6 pb-2" style={{ fontFamily: "'Space Grotesk', 'SF Pro Display', system-ui, sans-serif", fontWeight: 700, letterSpacing: '-0.04em' }}>
                <span className="inline-block animate-gradient bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent bg-[length:200%_auto] leading-tight">
                  SythaAI
                </span>
              </h1>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
                Your documents speak, not AI. <span className="text-emerald-400 font-semibold">RAG = Zero Hallucinations</span>
              </p>
            </div>

            {/* CTA Button */}
            <div className="flex justify-center">
              <button
                onClick={handleGoogleSignIn}
                className="group px-6 py-3 bg-white text-slate-900 rounded-full hover:bg-slate-100 transition-all flex items-center gap-3 text-base font-semibold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-105 duration-300"
              >
                <FaGoogle className="text-red-500 text-lg group-hover:scale-110 transition-transform" />
                Continue with Google
              </button>
            </div>
          </div>
        </div>

        {/* Disclaimer at bottom */}
        <div className="text-center">
          <p className="text-xs text-slate-500 max-w-4xl mx-auto">
            Princess Sytha might not be right all the time. Always verify important answers against the bare acts and consult a qualified lawyer when in doubt.
          </p>
        </div>
      </div>

      {/* CSS for gradient animation */}
      <style jsx>{`
        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
}
