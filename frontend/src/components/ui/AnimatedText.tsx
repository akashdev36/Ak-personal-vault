import { useEffect, useState } from 'react'

interface AnimatedTextProps {
    text: string
    className?: string
    delay?: number
    speed?: number
    gradient?: boolean
    gradientColors?: string[]
}

/**
 * Premium animated text with character-by-character reveal
 * Inspired by React Bits text animations
 */
export function AnimatedText({
    text,
    className = '',
    delay = 0,
    speed = 50,
    gradient = false,
    gradientColors = ['#3b82f6', '#8b5cf6', '#d946ef']
}: AnimatedTextProps) {
    const [displayText, setDisplayText] = useState('')
    const [isComplete, setIsComplete] = useState(false)

    useEffect(() => {
        let currentIndex = 0
        let timeoutId: ReturnType<typeof setTimeout>

        const startAnimation = () => {
            const animate = () => {
                if (currentIndex <= text.length) {
                    setDisplayText(text.slice(0, currentIndex))
                    currentIndex++
                    timeoutId = setTimeout(animate, speed)
                } else {
                    setIsComplete(true)
                }
            }
            animate()
        }

        const delayTimeout = setTimeout(startAnimation, delay)

        return () => {
            clearTimeout(delayTimeout)
            clearTimeout(timeoutId)
        }
    }, [text, delay, speed])

    const gradientStyle = gradient ? {
        background: `linear-gradient(135deg, ${gradientColors.join(', ')})`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
    } : {}

    return (
        <span className={`${className} ${isComplete ? '' : 'after:content-["_"] after:animate-pulse'}`} style={gradientStyle}>
            {displayText}
        </span>
    )
}

interface ShinyTextProps {
    text: string
    className?: string
    shimmerColor?: string
}

/**
 * Text with shimmering effect
 */
export function ShinyText({
    text,
    className = '',
    shimmerColor = 'rgba(255,255,255,0.5)'
}: ShinyTextProps) {
    return (
        <span
            className={`relative inline-block ${className}`}
            style={{
                background: `linear-gradient(90deg, transparent, ${shimmerColor}, transparent)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s infinite',
                WebkitBackgroundClip: 'text',
            }}
        >
            {text}
        </span>
    )
}

interface CountUpProps {
    end: number
    start?: number
    duration?: number
    delay?: number
    suffix?: string
    className?: string
}

/**
 * Animated number counter
 */
export function CountUp({
    end,
    start = 0,
    duration = 2000,
    delay = 0,
    suffix = '',
    className = ''
}: CountUpProps) {
    const [count, setCount] = useState(start)

    useEffect(() => {
        const delayTimeout = setTimeout(() => {
            const startTime = Date.now()
            const animate = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)

                // Ease out quad
                const eased = 1 - Math.pow(1 - progress, 3)
                const current = Math.round(start + (end - start) * eased)

                setCount(current)

                if (progress < 1) {
                    requestAnimationFrame(animate)
                }
            }
            requestAnimationFrame(animate)
        }, delay)

        return () => clearTimeout(delayTimeout)
    }, [end, start, duration, delay])

    return <span className={className}>{count}{suffix}</span>
}
