import { useState } from 'react'
import { Eye, Snowflake, Wifi } from 'lucide-react'
import { api } from '../../lib/api'

interface VirtualCardDisplayProps {
  modulrCardId: string
  isFrozen: boolean
}

export default function VirtualCardDisplay({ modulrCardId, isFrozen }: VirtualCardDisplayProps) {
  const [revealed, setRevealed] = useState(false)
  const [details, setDetails] = useState<{ maskedPan: string; expiryDate: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function reveal() {
    if (revealed) { setRevealed(false); return }
    setLoading(true)
    try {
      const d = await api.virtualCard.details()
      setDetails(d)
      setRevealed(true)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const pan = revealed && details ? details.maskedPan : '**** **** **** ????'
  const expiry = revealed && details ? details.expiryDate : '••/••'

  return (
    <div className={`relative rounded-2xl overflow-hidden select-none transition-all ${isFrozen ? 'opacity-60 grayscale' : ''}`}
      style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)', aspectRatio: '1.586' }}>
      {/* Card shine */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />

      {/* Contactless symbol */}
      <div className="absolute top-4 right-4 opacity-70">
        <Wifi className="h-6 w-6 text-white rotate-90" />
      </div>

      {/* Frozen overlay */}
      {isFrozen && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-2xl">
          <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2">
            <Snowflake className="h-5 w-5 text-white" />
            <span className="text-white font-semibold text-sm">Card frozen</span>
          </div>
        </div>
      )}

      <div className="absolute inset-0 p-6 flex flex-col justify-between">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/60 text-xs font-medium uppercase tracking-wider">ClearPath</p>
            <p className="text-white text-sm font-semibold">Virtual Card</p>
          </div>
          <div className="flex gap-1">
            <div className="h-8 w-8 rounded-full bg-red-500 opacity-90" />
            <div className="h-8 w-8 rounded-full bg-amber-400 opacity-90 -ml-3" />
          </div>
        </div>

        {/* PAN */}
        <div>
          <p className="text-white font-mono text-lg tracking-widest mb-1">{pan}</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/50 text-xs">EXPIRES</p>
              <p className="text-white font-mono text-sm">{expiry}</p>
            </div>
            <button
              onClick={reveal}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 text-white text-xs font-medium"
            >
              <Eye className="h-3.5 w-3.5" />
              {loading ? 'Loading…' : revealed ? 'Hide' : 'Reveal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
