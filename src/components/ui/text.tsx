import { createContext, useContext } from "react"
import { Text as RNText, type TextProps } from "react-native"
import { cn } from "@/lib/utils"

/**
 * Lets a parent (Button, Badge) set the text style for whatever <Text>
 * children it's given — React Native has no CSS inheritance, so this is how
 * `<Button variant="outline"><Text>Save</Text></Button>` picks up the
 * outline variant's text color without the caller repeating it.
 */
export const TextClassContext = createContext<string | undefined>(undefined)

export function Text({ className, ...props }: TextProps) {
  const inherited = useContext(TextClassContext)
  return <RNText className={cn("text-base text-foreground", inherited, className)} {...props} />
}
