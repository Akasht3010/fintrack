import { useEffect, useRef, useState } from "react"
import { type TextProps } from "react-native"
import { useReducedMotion } from "react-native-reanimated"
import { Text } from "@/components/ui/text"

interface NumberTickerProps extends TextProps {
  value: number
  format: (value: number) => string
  durationMs?: number
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Magic UI / Aceternity-style number ticker: counts from the previously
 * shown value to the new one. Display only — the in-between frames are
 * throwaway floats; the final frame always renders `format(value)` exactly,
 * so what's left on screen is the real figure, not an interpolated one.
 */
export function NumberTicker({ value, format, durationMs = 900, ...textProps }: NumberTickerProps) {
  const reduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    if (reduceMotion) return
    const from = fromRef.current
    const start = Date.now()
    let frame = 0
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs)
      setDisplay(t === 1 ? value : from + (value - from) * easeOutCubic(t))
      if (t < 1) frame = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      fromRef.current = value
    }
  }, [value, durationMs, reduceMotion])

  return (
    <Text accessibilityLabel={format(value)} {...textProps}>
      {format(reduceMotion ? value : display)}
    </Text>
  )
}
