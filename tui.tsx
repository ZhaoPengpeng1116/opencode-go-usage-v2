import { Plugin } from "@opencode/plugin/tui"
import { Database } from "bun:sqlite"
import { createSignal, onCleanup } from "solid-js"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

// OpenCode Go usage widget (CLI plugin for OpenCode v2)
//
// Shows the OpenCode Go / Go Plus plan usage (rolling 5h / weekly / monthly)
// in the sidebar, fetched from the official read-only endpoint:
//   https://opencode.ai/zen/go/v1/usage
//
// Credential resolution order:
//   1. OPENCODE_API_KEY environment variable
//   2. OpenCode Console credential in opencode.db (OAuth access token or API key)
//   3. auth.json (legacy keys)
//
// The credential is re-read on every refresh so OAuth token rotation is
// handled automatically.

const USAGE_URL = "https://opencode.ai/zen/go/v1/usage"

type UsageWindow = { status?: string; percent?: number; resetsAt?: string }
type Usage = { rolling?: UsageWindow; weekly?: UsageWindow; monthly?: UsageWindow }
type CliOptions = { refreshInterval?: number }

let refreshFn: (() => Promise<void>) | undefined

function dataDirCandidates(): string[] {
  const out: string[] = []
  if (process.env.OPENCODE_DATA_DIR) out.push(process.env.OPENCODE_DATA_DIR)
  if (process.env.XDG_DATA_HOME) out.push(join(process.env.XDG_DATA_HOME, "opencode"))
  if (process.env.LOCALAPPDATA) out.push(join(process.env.LOCALAPPDATA, "opencode"))
  out.push(join(homedir(), ".local", "share", "opencode"))
  return out
}

function stateDirCandidates(): string[] {
  const out: string[] = []
  if (process.env.XDG_STATE_HOME) out.push(join(process.env.XDG_STATE_HOME, "opencode"))
  if (process.env.LOCALAPPDATA) out.push(join(process.env.LOCALAPPDATA, "opencode", "state"))
  out.push(join(homedir(), ".local", "state", "opencode"))
  return out
}

function readKeyFromDb(): string | undefined {
  for (const dir of dataDirCandidates()) {
    const dbPath = join(dir, "opencode.db")
    try {
      if (!existsSync(dbPath)) continue
      const db = new Database(dbPath, { readonly: true })
      try {
        const rows = db
          .prepare("SELECT value FROM credential WHERE integration_id = 'opencode' AND active = 1")
          .all() as Array<{ value: string }>
        for (const row of rows) {
          try {
            const v = JSON.parse(row.value) as { type?: string; access?: string; key?: string }
            if (v?.type === "oauth" && typeof v.access === "string" && v.access.length > 0) return v.access
            if (v?.type === "key" && typeof v.key === "string" && v.key.length > 0) return v.key
          } catch {
            // skip malformed row
          }
        }
      } finally {
        db.close()
      }
    } catch {
      // try next candidate
    }
  }
  return undefined
}

function readKeyFromAuthJson(): string | undefined {
  for (const dir of [...dataDirCandidates(), ...stateDirCandidates()]) {
    const file = join(dir, "auth.json")
    try {
      if (!existsSync(file)) continue
      const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, { key?: string }>
      const key = data?.["opencode-go"]?.key ?? data?.["opencode"]?.key
      if (typeof key === "string" && key.length > 0) return key
    } catch {
      // try next candidate
    }
  }
  return undefined
}

function readKey(): string | undefined {
  if (process.env.OPENCODE_API_KEY) return process.env.OPENCODE_API_KEY
  return readKeyFromDb() ?? readKeyFromAuthJson()
}

async function fetchUsage(key: string): Promise<Usage> {
  const res = await fetch(USAGE_URL, { headers: { Authorization: `Bearer ${key}` } })
  if (!res.ok) throw new Error(`usage API HTTP ${res.status}`)
  const body = (await res.json()) as { usage?: Usage }
  return body.usage ?? {}
}

function countdown(iso?: string): string {
  if (!iso) return ""
  const diff = new Date(iso).getTime() - Date.now()
  if (!Number.isFinite(diff)) return ""
  if (diff <= 0) return "resetting"
  const mins = Math.floor(diff / 60000)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  if (days > 0) return `in ${days}d ${hours}h`
  if (hours > 0) return `in ${hours}h ${mins % 60}m`
  return `in ${mins}m`
}

type Theme = {
  text?: {
    base?: string
    muted?: string
    feedback?: {
      success?: { base?: string }
      warning?: { base?: string }
      error?: { base?: string }
    }
  }
}

function bar(percent: number, width = 10): { filled: number; total: number } {
  const p = Math.max(0, Math.min(100, percent))
  return { filled: Math.round((p / 100) * width), total: width }
}

function UsageLine(props: { label: string; win: UsageWindow | undefined; theme?: Theme }) {
  const base = () => props.theme?.text?.base
  const muted = () => props.theme?.text?.muted
  const fill = () => props.theme?.text?.feedback?.success?.base ?? props.theme?.text?.base
  if (!props.win || typeof props.win.percent !== "number") {
    return <text fg={muted()}>{`${props.label} …`}</text>
  }
  const pct = String(Math.round(props.win.percent)).padStart(3)
  const { filled, total } = bar(props.win.percent)
  return (
    <box flexDirection="row">
      <text fg={base()}>{`${props.label} ${pct}% `}</text>
      <text fg={fill()}>{"█".repeat(filled)}</text>
      <text fg={muted()}>{"░".repeat(total - filled)}</text>
      <text fg={muted()}>{` ${countdown(props.win.resetsAt)}`}</text>
    </box>
  )
}

function GoUsage(props: { intervalSeconds: number; theme?: Theme }) {
  const [usage, setUsage] = createSignal<Usage | undefined>()
  const [error, setError] = createSignal<string | undefined>()

  const refresh = async () => {
    const key = readKey()
    if (!key) {
      setError("no credential")
      return
    }
    try {
      const next = await fetchUsage(key)
      setUsage(next)
      setError(undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  refreshFn = refresh
  void refresh()
  const timer = setInterval(() => void refresh(), Math.max(15, props.intervalSeconds) * 1000)
  onCleanup(() => {
    clearInterval(timer)
    if (refreshFn === refresh) refreshFn = undefined
  })

  const title = () => (error() ? `Go Usage · ${error()}` : "Go Usage")

  return (
    <box flexDirection="column">
      <text
        fg={
          error()
            ? props.theme?.text?.feedback?.warning?.base ?? props.theme?.text?.muted
            : props.theme?.text?.base
        }
      >
        {title()}
      </text>
      <UsageLine label="5h " win={usage()?.rolling} theme={props.theme} />
      <UsageLine label="1w " win={usage()?.weekly} theme={props.theme} />
      <UsageLine label="1mo" win={usage()?.monthly} theme={props.theme} />
    </box>
  )
}

export default Plugin.define({
  id: "go-usage.cli",
  setup(context) {
    const options = (context as unknown as { options?: CliOptions }).options ?? {}
    const parsed = Number(options.refreshInterval)
    const intervalSeconds = Number.isFinite(parsed) && parsed >= 15 ? parsed : 120

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "go-usage.refresh",
          title: "Refresh Go usage",
          group: "Go Usage",
          palette: true,
          slash: { name: "gousage" },
          run: async () => {
            await refreshFn?.()
            context.ui.toast.show({ message: "Go usage refreshed", variant: "success" })
          },
        },
      ],
    }))

    const theme = (context as unknown as { theme?: Theme }).theme

    return context.ui.slot({
      append: "sidebar.content",
      render: () => <GoUsage intervalSeconds={intervalSeconds} theme={theme} />,
    })
  },
})
