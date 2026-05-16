import { vi } from "vitest"

// The swap and wallet modules import "server-only" to prevent accidental client-side use.
// Vitest runs in Node, so we mock it as a no-op.
vi.mock("server-only", () => ({}))
