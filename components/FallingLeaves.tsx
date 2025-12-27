'use client';

export default function FallingLeaves() {
  const raindrops = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 5,
    duration: 3 + Math.random() * 2,
  }));

  return (
    <>
      {/* Rain Effect */}
      <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
        {raindrops.map((drop) => (
          <div
            key={drop.id}
            className="absolute w-0.5 h-16 bg-gradient-to-b from-blue-400/15 to-transparent blur-sm"
            style={{
              left: `${drop.left}%`,
              animation: `rain ${drop.duration}s linear infinite`,
              animationDelay: `${drop.delay}s`,
            }}
          />
        ))}
      </div>

      <style jsx global>{`
        @keyframes rain {
          0% {
            transform: translateY(-10vh);
          }
          100% {
            transform: translateY(110vh);
          }
        }
      `}</style>
    </>
  );
}
