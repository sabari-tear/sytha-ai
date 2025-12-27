export default function Loading() {
  return (
    <div className="h-screen bg-slate-950 flex items-center justify-center overflow-hidden">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto"></div>
        <p className="mt-4 text-slate-300">Loading...</p>
      </div>
    </div>
  );
}
