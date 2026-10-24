import { GridBackground } from "./GridBackground"
import { Spotlight } from "./Spotlight"
import { useIsDesktop } from "@/hooks/useIsDesktop"

/** Grid + spotlight behind the auth screens (see app/(auth)/_layout.tsx). */
export function AuthBackdrop() {
  const isDesktop = useIsDesktop()
  return (
    <>
      <GridBackground cellSize={isDesktop ? 56 : 40} />
      <Spotlight />
    </>
  )
}
