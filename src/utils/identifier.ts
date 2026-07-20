const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type IdentifierKind = "phone" | "email" | null

export interface ClassifiedIdentifier {
  kind: IdentifierKind
  value: string
  isValid: boolean
}

export function classifyIdentifier(raw: string): ClassifiedIdentifier {
  const trimmed = raw.trim()

  if (trimmed.includes("@")) {
    return { kind: "email", value: trimmed.toLowerCase(), isValid: EMAIL_REGEX.test(trimmed) }
  }

  const digits = trimmed.replace(/\D/g, "")
  return { kind: trimmed.length > 0 ? "phone" : null, value: digits, isValid: digits.length === 10 }
}
