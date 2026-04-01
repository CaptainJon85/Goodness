import { useRef, useState, DragEvent } from 'react'
import { Upload, Image as ImageIcon } from 'lucide-react'

interface ScreenshotUploaderProps {
  onUpload: (file: File) => void
  isLoading: boolean
}

export default function ScreenshotUploader({ onUpload, isLoading }: ScreenshotUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  function handleFile(file: File) {
    const allowed = ['image/jpeg', 'image/png', 'image/heic', 'image/webp']
    if (!allowed.includes(file.type)) {
      alert('Please upload a JPEG, PNG, HEIC, or WebP image.')
      return
    }
    setPreview(URL.createObjectURL(file))
    onUpload(file)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
        dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-300 bg-gray-50'
      }`}
    >
      {preview ? (
        <div className="space-y-3">
          <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain shadow" />
          {isLoading && (
            <p className="text-sm text-brand-600 font-medium animate-pulse">Analysing with OCR…</p>
          )}
        </div>
      ) : (
        <>
          <div className="inline-flex rounded-full bg-gray-100 p-4 mb-3">
            {isLoading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
            ) : (
              <ImageIcon className="h-8 w-8 text-gray-400" />
            )}
          </div>
          <p className="font-medium text-gray-700">Drop your card screenshot here</p>
          <p className="text-sm text-gray-500 mt-1">JPEG, PNG, HEIC, WebP · max 10 MB</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isLoading}
            className="btn-secondary mt-4"
          >
            <Upload className="h-4 w-4 mr-2" />
            Browse files
          </button>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/heic,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
