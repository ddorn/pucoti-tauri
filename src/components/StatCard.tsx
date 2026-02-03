import { Text } from './catalyst/text'

export function StatCard({
  value,
  label,
  sublabel,
  color,
}: {
  value: string
  label: string
  sublabel?: string
  color: 'emerald' | 'amber' | 'zinc'
}) {
  const colorClasses = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    zinc: 'text-zinc-100',
  }

  return (
    <div className="bg-surface-raised rounded-lg p-5">
      <div className="text-zinc-100 mb-1">{label}</div>
      <div className={`text-3xl font-bold ${colorClasses[color]}`}>
        {value}
      </div>
      {sublabel && (
        <Text className="text-xs text-zinc-500 mt-2">{sublabel}</Text>
      )}
    </div>
  )
}
