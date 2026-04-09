interface MethodToggleProps {
  method: 'avalanche' | 'snowball'
  onChange: (method: 'avalanche' | 'snowball') => void
}

export default function MethodToggle({ method, onChange }: MethodToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
      {(['avalanche', 'snowball'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
            method === m
              ? 'bg-white shadow-sm text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {m === 'avalanche' ? '🔥 Avalanche' : '⛄ Snowball'}
        </button>
      ))}
    </div>
  )
}
