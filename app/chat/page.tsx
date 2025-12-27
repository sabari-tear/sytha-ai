'use client';

import { useRouter } from 'next/navigation';
import { FaBalanceScale, FaBook, FaFolder, FaArrowRight, FaPlus, FaChartBar } from 'react-icons/fa';
import Link from 'next/link';

export default function Page() {
  const router = useRouter();

  const features = [
    {
      title: 'Legal Knowledge',
      description: 'Ask natural-language questions about Indian laws, acts, and legal procedures',
      icon: FaBalanceScale,
      href: '/chat/legal',
      color: 'emerald',
      stats: 'Access to comprehensive legal database'
    },
    {
      title: 'Case Analysis',
      description: 'Upload and analyze multiple case documents with legal context',
      icon: FaBook,
      href: '/chat/cases',
      color: 'brand',
      stats: 'Manage and analyze your cases'
    },
    {
      title: 'Document Chat',
      description: 'Chat about specific documents without legal knowledge',
      icon: FaFolder,
      href: '/chat/documents',
      color: 'blue',
      stats: 'Focus on your documents'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <header className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium text-emerald-200 shadow-sm shadow-emerald-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Legal AI Assistant
        </div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
          Welcome to Your Legal Assistant
        </h1>
        <p className="mx-auto max-w-2xl text-balance text-sm text-slate-300 sm:text-base">
          Choose how you want to interact with the AI legal assistant
        </p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800/60 backdrop-blur-xl">
          <FaChartBar className="text-2xl mb-2 text-emerald-400" />
          <div className="text-2xl font-bold text-slate-50">500+</div>
          <div className="text-xs text-slate-400">Legal Acts</div>
        </div>
        <div className="rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800/60 backdrop-blur-xl">
          <FaBook className="text-2xl mb-2 text-brand-400" />
          <div className="text-2xl font-bold text-slate-50">1000+</div>
          <div className="text-xs text-slate-400">Case Laws</div>
        </div>
        <div className="rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800/60 backdrop-blur-xl">
          <FaFolder className="text-2xl mb-2 text-blue-400" />
          <div className="text-2xl font-bold text-slate-50">∞</div>
          <div className="text-xs text-slate-400">Documents</div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          const colorClasses = {
            emerald: 'bg-emerald-500 shadow-emerald-500/40 hover:bg-emerald-400 hover:shadow-emerald-400/50 text-emerald-400',
            brand: 'bg-brand-500 shadow-brand-500/40 hover:bg-brand-400 hover:shadow-brand-400/50 text-brand-400',
            blue: 'bg-blue-500 shadow-blue-500/40 hover:bg-blue-400 hover:shadow-blue-400/50 text-blue-400'
          };
          return (
            <Link
              key={feature.href}
              href={feature.href}
              className="group rounded-3xl border border-slate-800/60 bg-slate-900/60 shadow-[0_0_60px_rgba(15,23,42,0.8)] backdrop-blur-xl hover:border-slate-700/80 transition-all duration-300"
            >
              <div className="p-6 space-y-4">
                <div className={`inline-flex p-4 rounded-2xl ${colorClasses[feature.color as keyof typeof colorClasses].split(' ').slice(0, 2).join(' ')} text-slate-50 shadow-lg transition-all duration-300`}>
                  <Icon className="text-2xl" />
                </div>
                <h3 className="text-xl font-semibold text-slate-50">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-300">
                  {feature.description}
                </p>
                <div className="text-xs text-slate-400 border-t border-slate-800/60 pt-3">
                  {feature.stats}
                </div>
                <div className={`flex items-center ${colorClasses[feature.color as keyof typeof colorClasses].split(' ').slice(-1)} group-hover:translate-x-2 transition-all`}>
                  <span className="text-sm font-medium">Get Started</span>
                  <FaArrowRight className="ml-2" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="rounded-3xl border border-slate-800/60 bg-slate-900/60 shadow-[0_0_60px_rgba(15,23,42,0.8)] backdrop-blur-xl p-6">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">⚡ Quick Actions</h3>
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/chat/cases"
            className="flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-brand-500/30 hover:border-brand-500 bg-brand-900/20 hover:bg-brand-900/30 transition-all group"
          >
            <FaPlus className="text-brand-400 group-hover:scale-110 group-hover:rotate-90 transition-all duration-300" />
            <span className="text-sm text-slate-300 group-hover:text-slate-50">Add New Case</span>
          </Link>
          <Link
            href="/chat/documents"
            className="flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-blue-500/30 hover:border-blue-500 bg-blue-900/20 hover:bg-blue-900/30 transition-all group"
          >
            <FaPlus className="text-blue-400 group-hover:scale-110 group-hover:rotate-90 transition-all duration-300" />
            <span className="text-sm text-slate-300 group-hover:text-slate-50">Upload Document</span>
          </Link>
        </div>
      </div>
    </div>
  );
}