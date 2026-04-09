interface UtilisationBarProps {
  balance: number
  creditLimit: number
}

export default function UtilisationBar({ balance, creditLimit }: UtilisationBarProps) {
  const pct = creditLimit > 0 ? Math.min(100, (balance / creditLimit) * 100) : 0
  const colour = pct >= 75 ? 'bg-red-500' : pct >= 30 ? 'bg-amber-400' : 'bg-green-500'
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{pct.toFixed(0)}% used</span>
        <span>{creditLimit > 0 ? `£${(creditLimit / 100).toFixed(0)} limit` : ''}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200">
        <div className={`h-1.5 rounded-full transition-all ${colour}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
