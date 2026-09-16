// Doesn't need to be unguessable, just unique-enough per submission attempt
// — no crypto dependency required.
export function generateIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
