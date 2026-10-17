<div align="center">

# opencode-go-usage-v2

**Keep an eye on your OpenCode Go quota — right in the terminal sidebar.**

A tiny CLI plugin for **OpenCode v2** that shows your Go / Go Plus plan usage
(rolling 5h · weekly · monthly) with progress bars and reset countdowns.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![opencode v2](https://img.shields.io/badge/opencode-v2-blue)
![tested with 2.0.32](https://img.shields.io/badge/tested%20with-2.0.32-brightgreen)

**[English](README.md) · [中文](README.zh.md)**

<img src="assets/preview.svg" alt="Go Usage section in the OpenCode sidebar" width="480">

<sub>The “Go Usage” section appears in the sidebar, below the files section (illustration).</sub>

</div>

---

## Why

OpenCode Go is a $10/month plan, but usage is tracked in rolling windows (5-hour / weekly / monthly).
This plugin keeps the numbers always visible — so you never blow your quota mid-task, and always
know when it resets.

## Features

- 🎛 **Sidebar section** — renders in `sidebar.content`, right below the files section
- 📊 **Three windows** — rolling 5h / weekly / monthly: percent + progress bar + “resets in” countdown
- ⏱ **Auto-refresh** — every 2 minutes by default; credential is re-read on every refresh, so OAuth
  token rotation is handled automatically
- ⌨️ **`/gousage` command** (also *Refresh Go usage* in the command palette) for instant refresh
- 🔌 **Zero config** — automatically picks up your OpenCode Console login from `opencode.db`
- 🖥 **Cross-platform** — `OPENCODE_DATA_DIR` / `XDG_DATA_HOME` / `LOCALAPPDATA` / defaults
- 🔒 **No quota consumed** — reads the official endpoint `https://opencode.ai/zen/go/v1/usage`, read-only

## Install

```bash
git clone https://github.com/ZhaoPengpeng1116/opencode-go-usage-v2 ~/.config/opencode/plugins/go-usage
```

Then **fully restart OpenCode**. Open a session and show the sidebar — **Go Usage** appears below
the files section.

> **Requirements:** OpenCode **v2** (tested with 2.0.32) and a signed-in **OpenCode Console**
> account with a Go or Go Plus subscription (`opencode auth login opencode`).
> This is a CLI-side plugin slot — the terminal TUI is supported; desktop/web UIs are untested.

### Options (optional)

When loading the plugin from `cli.json` with the object form:

```json
{
  "plugins": [
    {
      "package": "/absolute/path/to/opencode-go-usage-v2",
      "options": { "refreshInterval": 120 }
    }
  ]
}
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `refreshInterval` | number | `120` | Auto-refresh interval in seconds (minimum 15) |

## FAQ

**The numbers don’t match the web console.**
The plugin resolves credentials in this order: `OPENCODE_API_KEY` env → **OpenCode Console login in
`opencode.db`** → legacy `auth.json` keys. If your account has both an old v1 API key and a v2
Console login, the Console credential wins — that’s the one the web console shows. (Using an old v1
key against the same endpoint can return stale or other-cycle numbers.)

**The section doesn’t appear.**
1. Fully restart OpenCode — CLI plugins load at startup.
2. The section lives in the **session sidebar**: open it (wide terminals show it automatically;
   or toggle the sidebar from the command palette).

**I use only third-party API keys (no Console login).**
There’s nothing to display — the section shows `no credential`. The plugin targets OpenCode Go
subscribers.

## Uninstall

```bash
rm -rf ~/.config/opencode/plugins/go-usage
```

## License

[MIT](LICENSE) · Unofficial community plugin, not affiliated with OpenCode.
If this saved you a surprise, a ⭐ helps others find it.
