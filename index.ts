import { Plugin } from "@opencode/plugin"

// Server-side counterpart (no-op).
// The user-facing part lives in ./tui.tsx (CLI plugin), which renders the
// OpenCode Go usage widget in the terminal sidebar.
export default Plugin.define({
  id: "go-usage",
  setup() {},
})
