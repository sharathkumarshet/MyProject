import clsx from 'clsx'

type RangeProps = {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  suffix?: string
}

export function Slider({ label, value, min, max, onChange, suffix = '' }: RangeProps) {
  return (
    <label className="block text-sm text-slate-300">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="text-xs text-slate-400">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-emerald-500"
      />
    </label>
  )
}

export function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block text-sm text-slate-300">
      <span className="mb-2 block">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value))))}
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-0"
      />
    </label>
  )
}

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { label: string; value: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className="block text-sm text-slate-300">
      <span className="mb-2 block">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

export function Radio({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="block text-sm text-slate-300">
      <span className="mb-2 block">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={clsx(
              'rounded-full border px-3 py-1.5 text-xs transition',
              value === option ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-slate-600 text-slate-300 hover:bg-slate-800',
            )}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
