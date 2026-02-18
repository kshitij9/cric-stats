export default function MatchupTable({ data }: { data: any[] }) {
    if (!data) return <div className="animate-pulse h-40 bg-zinc-800 rounded-xl" />;
  
    return (
      <div className="space-y-4">
        {data.map((row) => (
          <div key={row.bowler} className="flex justify-between items-center p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
            <div>
              <p className="font-bold text-sm">{row.bowler}</p>
              <p className="text-[10px] text-zinc-500 uppercase font-black">{row.balls} Balls Faced</p>
            </div>
            <div className="text-right">
              <span className="text-red-500 font-black text-lg">{row.dismissals}</span>
              <p className="text-[10px] text-zinc-500 uppercase font-black">Outs</p>
            </div>
          </div>
        ))}
      </div>
    );
  }