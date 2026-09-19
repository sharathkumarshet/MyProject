import type { ScoreBreakdown } from '../../types/scoring'

export function ScoreDashboard({ score }: { score: ScoreBreakdown }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">Score overview</h3>
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
          {score.percentage}%
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries(score.categories).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{key}</p>
            <p className="mt-2 text-2xl font-bold text-slate-100">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
        <p className="mb-2 text-sm font-medium text-slate-200">Why did I get this score?</p>
        <ul className="space-y-2 text-sm text-slate-300">
          {score.lines.map((line) => (
            <li key={line.label} className="rounded-lg border border-slate-700 px-3 py-2">
              <span className="font-semibold text-emerald-300">{line.points}</span> {line.description}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
