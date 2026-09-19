type HeaderProps = {
  title?: string
}

export function Header({ title = 'Landscape Simulator' }: HeaderProps) {
  return (
    <header className="border-b border-slate-700 bg-slate-950/80 px-4 py-4 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-400">Interactive design</p>
          <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Save
          </button>
          <button type="button" className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400">
            Reset
          </button>
        </div>
      </div>
    </header>
  )
}
