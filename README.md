# UiPath Conversational Agent — Slack Bot

A simple Slack bot that lets anyone in your workspace chat directly with a **UiPath Conversational Agent** — no `@mention` needed, just type in the channel.

---

## How it works

```
User types in Slack channel
        ↓
  Slack Bolt App (Socket Mode)
        ↓
  UiPath TypeScript SDK
        ↓
  Conversational Agent (WebSocket stream)
        ↓
  Reply posted back in same Slack thread
```

- Every message in the channel gets a response from the agent
- Each Slack **thread** maps to its own UiPath **conversation** — so context is preserved across follow-up messages
- Responses stream in real-time to your terminal as they arrive

---

## Project Structure

```
slackbot/
├── src/
│   └── app.ts        ← entire bot in one file (~150 lines)
├── .env.example      ← all required environment variables
├── package.json
└── tsconfig.json
```

---

## Prerequisites

- Node.js 18+
- A [Slack workspace](https://slack.com) where you can install apps
- A [UiPath Automation Cloud](https://cloud.uipath.com) account with a deployed Conversational Agent

---

## Slack App Setup

### 1. Create the app

Go to **[api.slack.com/apps](https://api.slack.com/apps)** → **Create New App → From scratch**

### 2. Enable Socket Mode

**Socket Mode** → Turn it on → **Create an App-Level Token**
- Scope: `connections:write`
- Copy the `xapp-` token → `SLACK_APP_TOKEN`

### 3. Add Bot Token Scopes

**OAuth & Permissions → Bot Token Scopes → Add:**

| Scope | Why |
|---|---|
| `app_mentions:read` | Receive @mention events |
| `chat:write` | Post replies |
| `channels:history` | Read channel messages |

### 4. Subscribe to Events

**Event Subscriptions → Enable → Subscribe to bot events → Add:**
- `app_mention`
- `message.channels`

### 5. Install to Workspace

**OAuth & Permissions → Install to Workspace**

Copy the `xoxb-` token → `SLACK_BOT_TOKEN`

Copy the **Signing Secret** from **Basic Information** → `SLACK_SIGNING_SECRET`

### 6. Add the bot to your channel

In Slack, open the channel (e.g. `#capstone-projects`) and run:
```
/invite @YourBotName
```

---

## UiPath Setup

### Generate a Personal Access Token (PAT)

1. Log in to [cloud.uipath.com](https://cloud.uipath.com)
2. Click your avatar (top-right) → **Preferences → Personal Access Tokens**
3. Click **Create Token**, set a name and expiry
4. Required scopes: `OR.ConversationalAgent`, `OR.Folders.Read`
5. Copy the token — it's only shown once → `UIPATH_PAT`

### Find your Org & Tenant names

From your UiPath Cloud URL:
```
https://cloud.uipath.com/<ORG_NAME>/<TENANT_NAME>/...
```

---

## Installation & Running

```bash
# 1. Clone the repo
git clone https://github.com/umanikumar-uipath/uipath-slack-bot.git
cd uipath-slack-bot

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in all values in .env

# 4. Start the bot
npm run dev
```

---

## Environment Variables

| Variable | Where to find it |
|---|---|
| `SLACK_BOT_TOKEN` | api.slack.com/apps → OAuth & Permissions → Bot User OAuth Token |
| `SLACK_SIGNING_SECRET` | api.slack.com/apps → Basic Information → Signing Secret |
| `SLACK_APP_TOKEN` | api.slack.com/apps → Basic Information → App-Level Tokens |
| `UIPATH_PAT` | cloud.uipath.com → Avatar → Preferences → Personal Access Tokens |
| `UIPATH_ORG_NAME` | Your org name from the UiPath Cloud URL |
| `UIPATH_TENANT_NAME` | Your tenant name from the UiPath Cloud URL |

---

## Example Interaction

```
User  →  what is RPA?
Bot   →  RPA (Robotic Process Automation) is a technology that uses
         software robots to automate repetitive, rule-based tasks...

User  →  give me an example in finance
Bot   →  (continues the same conversation with full context)
         A common finance example is invoice processing automation...
```

---

## Tech Stack

| Tool | Purpose |
|---|---|
| [Slack Bolt](https://slack.dev/bolt-js) | Slack event handling |
| [UiPath TypeScript SDK](https://uipath.github.io/uipath-typescript/) | Conversational Agent API |
| TypeScript + ts-node | Language & runtime |
| dotenv | Environment variable management |

---

## License

MIT
