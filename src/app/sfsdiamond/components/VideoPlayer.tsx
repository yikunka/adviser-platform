'use client'

import { useRef, useState } from 'react'

export default function VideoPlayer({
  src,
  poster,
}: {
  src: string
  poster?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  function handlePlay() {
    const v = videoRef.current
    if (!v) return
    v.play()
    setPlaying(true)
  }

  function handleVideoClick() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ maxWidth: 420, width: '100%' }}>
      <video
        ref={videoRef}
        playsInline
        poster={poster}
        className="w-full h-auto block"
        onClick={handleVideoClick}
        onEnded={() => setPlaying(false)}
        style={{ cursor: 'pointer' }}
      >
        <source src={src} type="video/mp4" />
      </video>

      {/* Play button overlay — hidden once playing */}
      {!playing && (
        <button
          onClick={handlePlay}
          aria-label="Play video"
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.35)' }}
        >
          <span
            className="flex items-center justify-center rounded-full transition-transform hover:scale-110"
            style={{
              width: 72,
              height: 72,
              background: 'rgba(201,169,110,0.92)',
              boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
            }}
          >
            {/* Triangle play icon */}
            <svg width="26" height="28" viewBox="0 0 26 28" fill="none">
              <path d="M3 2L23 14L3 26V2Z" fill="#0A0805" />
            </svg>
          </span>
        </button>
      )}
    </div>
  )
}
