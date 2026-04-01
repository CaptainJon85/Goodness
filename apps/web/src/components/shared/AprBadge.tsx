import { aprColour } from '../../lib/format'

export default function AprBadge({ apr }: { apr: number }) {
  const { bg, text } = aprColour(apr)
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${bg} ${text}`}>
      {apr.toFixed(1)}% APR
    </span>
  )
}
