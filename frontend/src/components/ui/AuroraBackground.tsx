import { useEffect, useRef } from 'react'

interface AuroraBackgroundProps {
    colorStops?: string[]
    amplitude?: number
    blend?: number
    className?: string
}

/**
 * Premium animated aurora background effect
 * Inspired by React Bits - creates flowing gradient animation
 */
export default function AuroraBackground({
    colorStops = ['#3b82f6', '#8b5cf6', '#d946ef', '#ec4899'],
    amplitude = 1.5,
    blend = 0.65,
    className = ''
}: AuroraBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let animationId: number
        let time = 0

        const resize = () => {
            canvas.width = canvas.offsetWidth * window.devicePixelRatio
            canvas.height = canvas.offsetHeight * window.devicePixelRatio
        }

        const animate = () => {
            if (!ctx || !canvas) return

            time += 0.005
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            // Create flowing aurora waves
            for (let i = 0; i < colorStops.length; i++) {
                const color = colorStops[i]
                const offset = i * 0.5 + time

                ctx.beginPath()
                ctx.moveTo(0, canvas.height)

                // Draw wave
                for (let x = 0; x <= canvas.width; x += 10) {
                    const y = canvas.height * 0.5 +
                        Math.sin(x * 0.003 + offset) * canvas.height * 0.15 * amplitude +
                        Math.sin(x * 0.007 + offset * 1.5) * canvas.height * 0.1 * amplitude +
                        Math.sin(x * 0.001 + offset * 0.5) * canvas.height * 0.2 * amplitude
                    ctx.lineTo(x, y)
                }

                ctx.lineTo(canvas.width, canvas.height)
                ctx.closePath()

                // Gradient fill
                const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
                gradient.addColorStop(0, color + '40') // 25% opacity
                gradient.addColorStop(0.5, color + '60') // 37% opacity
                gradient.addColorStop(1, color + '20') // 12% opacity

                ctx.globalAlpha = blend
                ctx.fillStyle = gradient
                ctx.fill()
            }

            animationId = requestAnimationFrame(animate)
        }

        resize()
        animate()
        window.addEventListener('resize', resize)

        return () => {
            cancelAnimationFrame(animationId)
            window.removeEventListener('resize', resize)
        }
    }, [colorStops, amplitude, blend])

    return (
        <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full ${className}`}
            style={{ filter: 'blur(60px)' }}
        />
    )
}
