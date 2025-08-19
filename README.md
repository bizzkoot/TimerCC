# Claude Code

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![npm]](https://www.npmjs.com/package/@anthropic-ai/claude-code)

[npm]: https://img.shields.io/npm/v/@anthropic-ai/claude-code.svg?style=flat-square

Claude Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex code, and handling git workflows -- all through natural language commands. Use it in your terminal, IDE, or tag @claude on Github.

**Learn more in the [official documentation](https://docs.anthropic.com/en/docs/claude-code/overview)**.

<img src="./demo.gif" />

## Get started

1. Install Claude Code:

```sh
npm install -g @anthropic-ai/claude-code
```

2. Navigate to your project directory and run `claude`.

## ⚡ Enhanced Features

### Auto-Accept Countdown (Safety Enhancement)

Add a configurable safety buffer before each auto-accept action. Perfect for users who want the convenience of auto-accept with an extra layer of safety.

**🚀 One-Command Installation:**
```sh
# Download and run the installer
curl -O https://raw.githubusercontent.com/anthropics/claude-code/main/specs/auto-accept-countdown/install.js
node install.js

# Or build from source
cd specs/auto-accept-countdown/
node build-installer.js  # Creates standalone installer
node auto-accept-countdown-installer.js
```

**✨ What you get:**
- **Configurable countdown** (0-60 seconds, default 5s) before auto-accept
- **Visual feedback** with terminal-compatible status display
- **ESC cancellation** - press ESC to cancel countdown and require manual approval
- **Persistent settings** - your timer preferences save across sessions
- **Zero breaking changes** - all existing auto-accept functionality preserved
- **Cross-platform** - works on macOS, Linux, Windows with any terminal

**📋 Quick Start:**
```sh
/timer 5        # Set 5-second countdown before auto-accept
/countdown 10   # Alternative command, same functionality
/timer          # Show current setting
/timer 0        # Disable countdown (immediate auto-accept)
```

**🎯 How it works:**
1. Enable auto-accept mode with **Shift+Tab** (existing functionality)
2. When Claude suggests an action, countdown appears: `⏳ Auto-accept in 5s (ESC to cancel)`
3. Press **ESC** to cancel and require manual approval, or wait for auto-accept
4. Settings persist across Claude Code sessions

**🔧 Installation Options:**

| Command | Description |
|---------|-------------|
| `node install.js` | Install the feature |
| `node install.js --dry-run` | Preview what would be installed |
| `node install.js --verify` | Check installation status |
| `node install.js --uninstall` | Remove the feature |
| `node install.js --help` | Show detailed help |

**📁 Manual Installation:**
If you prefer manual setup, see [`specs/auto-accept-countdown/IMPLEMENTATION_COMPLETE.md`](specs/auto-accept-countdown/IMPLEMENTATION_COMPLETE.md) for detailed integration instructions.

## Reporting Bugs

We welcome your feedback. Use the `/bug` command to report issues directly within Claude Code, or file a [GitHub issue](https://github.com/anthropics/claude-code/issues).

## Data collection, usage, and retention

When you use Claude Code, we collect feedback, which includes usage data (such as code acceptance or rejections), associated conversation data, and user feedback submitted via the `/bug` command.

### How we use your data

We may use feedback to improve our products and services, but we will not train generative models using your feedback from Claude Code. Given their potentially sensitive nature, we store user feedback transcripts for only 30 days.

If you choose to send us feedback about Claude Code, such as transcripts of your usage, Anthropic may use that feedback to debug related issues and improve Claude Code's functionality (e.g., to reduce the risk of similar bugs occurring in the future).

### Privacy safeguards

We have implemented several safeguards to protect your data, including limited retention periods for sensitive information, restricted access to user session data, and clear policies against using feedback for model training.

For full details, please review our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and [Privacy Policy](https://www.anthropic.com/legal/privacy).
