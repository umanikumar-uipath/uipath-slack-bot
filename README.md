# UiPath Conversational Agent — Slack Bot

> A Slack bot that lets anyone in your workspace chat with a **UiPath Conversational Agent** directly from a Slack channel — no `@mention` needed, just type and get a response.

---

## Table of Contents

1. [What This Bot Does](#1-what-this-bot-does)
2. [How It Works — Big Picture](#2-how-it-works--big-picture)
3. [What You Need Before Starting](#3-what-you-need-before-starting)
4. [Step 1 — Install Node.js](#step-1--install-nodejs)
5. [Step 2 — Clone This Repo](#step-2--clone-this-repo)
6. [Step 3 — Create Your Slack App](#step-3--create-your-slack-app)
7. [Step 4 — Generate a UiPath Personal Access Token](#step-4--generate-a-uipath-personal-access-token)
8. [Step 5 — Configure Environment Variables](#step-5--configure-environment-variables)
9. [Step 6 — Install Dependencies & Run the Bot](#step-6--install-dependencies--run-the-bot)
10. [Step 7 — Add the Bot to Your Slack Channel](#step-7--add-the-bot-to-your-slack-channel)
11. [See It In Action](#see-it-in-action)
12. [Understanding the Code](#understanding-the-code)
13. [Troubleshooting](#troubleshooting)

---

## 1. What This Bot Does

Once set up, anyone in your Slack workspace can open the `#capstone-projects` channel (or any channel the bot is added to) and simply **type a message**. The bot will:

- Pick up the message automatically
- Send it to the UiPath Conversational Agent
- Stream the agent's response back into the **same thread** in Slack
- **Remember the conversation** — follow-up messages in the same thread continue from where you left off

```
You type in Slack:        "What is RPA?"
Bot replies in thread:    "RPA stands for Robotic Process Automation..."

You reply in same thread: "Give me a finance example"
Bot replies:              "Sure! Invoice processing is a great example..." ← still has context
```

---

## 2. How It Works — Big Picture

```
┌─────────────────────────────────────────────────────────────┐
│                        SLACK                                │
│   User types a message in #capstone-projects channel        │
│                          │                                  │
│            Slack sends the message to our bot               │
└──────────────────────────┼──────────────────────────────────┘
                           │ (Socket Mode — no public URL needed)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     OUR BOT (app.ts)                        │
│                                                             │
│  1. Receives the message from Slack                         │
│  2. Looks up if this thread already has a UiPath session    │
│  3. If not → creates a new UiPath conversation              │
│  4. Sends the user's text to the UiPath agent               │
│  5. Streams the response back to Slack                      │
└──────────────────────────┼──────────────────────────────────┘
                           │ (WebSocket streaming)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              UIPATH AUTOMATION CLOUD                        │
│         Conversational Agent processes the message          │
│         and streams the response back chunk by chunk        │
└─────────────────────────────────────────────────────────────┘
```

**Key concept — Session Map:**
The bot keeps a simple in-memory table like this:

| Slack Thread ID | UiPath Conversation ID |
|---|---|
| thread_abc123 | conv-uuid-001 |
| thread_xyz789 | conv-uuid-002 |

This is how it remembers which UiPath conversation belongs to which Slack thread.

---

## 3. What You Need Before Starting

| Requirement | Details |
|---|---|
| **Node.js 18+** | The JavaScript runtime that runs our bot |
| **A Slack Workspace** | You need permission to install apps in the workspace |
| **UiPath Automation Cloud account** | With a deployed Conversational Agent |
| **Git** | To clone this repository |

---

## Step 1 — Install Node.js

1. Go to **[nodejs.org](https://nodejs.org)**
2. Download the **LTS version** (the one that says "Recommended for most users")
3. Run the installer and follow the steps
4. Verify it installed correctly — open your terminal and run:

```bash
node --version
# Should print something like: v20.11.0

npm --version
# Should print something like: 10.2.4
```

---

## Step 2 — Clone This Repo

Open your terminal and run:

```bash
git clone https://github.com/umanikumar-uipath/uipath-slack-bot.git
cd uipath-slack-bot
```

You should now see these files:

```
uipath-slack-bot/
├── src/
│   └── app.ts          ← the entire bot
├── .env.example        ← template for your secret tokens
├── package.json        ← project dependencies
├── tsconfig.json       ← TypeScript settings
└── README.md           ← this file
```

---

## Step 3 — Create Your Slack App

This is the most involved part. Follow each sub-step carefully.

---

### 3a. Go to the Slack API Portal

Open **[api.slack.com/apps](https://api.slack.com/apps)** in your browser.

Click **"Create New App"** → Select **"From scratch"**

- **App Name:** `UiPath Agent` (or anything you like)
- **Workspace:** Select your company's Slack workspace
- Click **"Create App"**

---

### 3b. Enable Socket Mode

Socket Mode lets the bot receive messages over a secure connection **without needing a public URL**. This is the easiest way to get started.

1. In the left sidebar, click **"Socket Mode"**
2. Toggle it **ON**
3. You'll be prompted to create an **App-Level Token**
   - **Token Name:** `socket-token` (any name)
   - **Scope:** Click **"Add Scope"** → select `connections:write`
   - Click **"Generate"**
4. Copy the token — it starts with `xapp-`
5. Save it as **`SLACK_APP_TOKEN`** in your notes

> ⚠️ This token is shown only once. Copy it now.

---

### 3c. Add Bot Permissions (Scopes)

1. In the left sidebar, click **"OAuth & Permissions"**
2. Scroll down to **"Scopes"** → **"Bot Token Scopes"**
3. Click **"Add an OAuth Scope"** and add these three:

| Scope | What it allows |
|---|---|
| `app_mentions:read` | Bot can see when it's @mentioned |
| `chat:write` | Bot can send messages |
| `channels:history` | Bot can read messages in channels |

---

### 3d. Subscribe to Events

This tells Slack which events to send to our bot.

1. In the left sidebar, click **"Event Subscriptions"**
2. Toggle **"Enable Events"** to **ON**
3. Scroll down to **"Subscribe to bot events"**
4. Click **"Add Bot User Event"** and add both:
   - `app_mention` — fires when someone @mentions the bot
   - `message.channels` — fires when anyone posts in a channel
5. Click **"Save Changes"** at the bottom

---

### 3e. Install the App to Your Workspace

1. In the left sidebar, click **"OAuth & Permissions"**
2. At the top, click **"Install to Workspace"**
3. Click **"Allow"** on the permission screen
4. You'll see a **Bot User OAuth Token** starting with `xoxb-`
5. Copy it → save as **`SLACK_BOT_TOKEN`**

---

### 3f. Get Your Signing Secret

1. In the left sidebar, click **"Basic Information"**
2. Scroll down to **"App Credentials"**
3. Next to **"Signing Secret"**, click **"Show"**
4. Copy it → save as **`SLACK_SIGNING_SECRET`**

---

### ✅ Slack Checklist

After this step you should have three values saved:

- [ ] `SLACK_BOT_TOKEN` — starts with `xoxb-`
- [ ] `SLACK_SIGNING_SECRET` — a random string
- [ ] `SLACK_APP_TOKEN` — starts with `xapp-`

---

## Step 4 — Generate a UiPath Personal Access Token

A **Personal Access Token (PAT)** lets our bot authenticate with UiPath without needing a browser login.

### 4a. Create the Token

1. Log in to **[cloud.uipath.com](https://cloud.uipath.com)**
2. Click your **profile avatar** in the top-right corner
3. Click **"Preferences"**
4. Click **"Personal Access Tokens"** in the left menu
5. Click **"Create Token"**
6. Fill in:
   - **Name:** `slack-bot`
   - **Expiry:** Choose a date (e.g. 1 year from now)
   - **Scopes:** Check `OR.ConversationalAgent` and `OR.Folders.Read`
7. Click **"Create"**
8. Copy the token → save as **`UIPATH_PAT`**

> ⚠️ This token is shown only once. Copy it now.

---

### 4b. Find Your Org Name and Tenant Name

Look at your UiPath Cloud URL — it follows this pattern:

```
https://cloud.uipath.com/YourOrgName/YourTenantName/...
                          ^^^^^^^^^^^  ^^^^^^^^^^^^^^
                          UIPATH_ORG_NAME  UIPATH_TENANT_NAME
```

**Example:**
```
https://cloud.uipath.com/acmecorp/Production/orchestrator_/
                          ^^^^^^^^  ^^^^^^^^^^
                          acmecorp  Production
```

Save both values.

---

### 4c. Make Sure Your Agent is Deployed

1. In UiPath Cloud, go to **Agent Builder**
2. Find your Conversational Agent
3. Make sure its status is **Published** or **Active**

> If no agent is deployed yet, you'll need to create and publish one before the bot can use it.

---

### ✅ UiPath Checklist

- [ ] `UIPATH_PAT` — your personal access token
- [ ] `UIPATH_ORG_NAME` — from your cloud.uipath.com URL
- [ ] `UIPATH_TENANT_NAME` — from your cloud.uipath.com URL

---

## Step 5 — Configure Environment Variables

Environment variables are how we pass secret tokens to the app **without hardcoding them in the code**.

### 5a. Create your `.env` file

In your terminal, from inside the project folder:

```bash
cp .env.example .env
```

### 5b. Open `.env` and fill in your values

Open the `.env` file in any text editor (VS Code, Notepad, etc.) and replace the placeholders with your real values:

```env
# ── Slack ──────────────────────────────────────────
SLACK_BOT_TOKEN=xoxb-your-actual-token-here
SLACK_SIGNING_SECRET=your-actual-secret-here
SLACK_APP_TOKEN=xapp-your-actual-token-here

# ── UiPath ─────────────────────────────────────────
UIPATH_PAT=your-actual-pat-here
UIPATH_ORG_NAME=your-org-name
UIPATH_TENANT_NAME=your-tenant-name
```

> 🔒 The `.env` file is listed in `.gitignore` — it will **never** be committed to GitHub. Your tokens stay on your machine only.

---

## Step 6 — Install Dependencies & Run the Bot

### 6a. Install npm packages

```bash
npm install
```

This downloads all the libraries the bot needs (Slack Bolt, UiPath SDK, etc.) into a `node_modules` folder. Takes about 30 seconds.

### 6b. Start the bot

```bash
npm run dev
```

If everything is set up correctly, you'll see:

```
✅ UiPath Slack Bot is running!
📡 Listening for messages in all joined channels...
💡 Tip: Any message posted in the channel will get a reply.
```

> Keep this terminal open. The bot stops when you close the terminal.

---

## Step 7 — Add the Bot to Your Slack Channel

The bot won't receive messages in a channel unless it's been added to it.

1. Open **Slack**
2. Go to the channel you want (e.g. `#capstone-projects`)
3. Click the channel name at the top → **"Integrations"** tab
4. Click **"Add apps"**
5. Search for your bot's name and click **"Add"**

Or, just type this in the channel:
```
/invite @YourBotName
```

---

## See It In Action

Once the bot is running and added to the channel, test it:

**In Slack — type any message in the channel:**
```
What is RPA?
```

**In your terminal — you'll see live logs:**
```
────────────────────────────────────────────────────────────
[Slack]  Message from user U012345 in channel C067890
[Slack]  Text: "What is RPA?"
[UiPath] Discovering agents...
[UiPath] Found 1 agent(s). Using: "Capstone Agent"
[Session] New conversation created → ID: abc-123-uuid
[UiPath] Opening WebSocket session...
[UiPath] Session ready. Sending: "What is RPA?"
RPA stands for Robotic Process Automation...    ← streams in real-time
[UiPath] Exchange complete. Reply length: 284 chars
[Slack]  Posting reply to thread 1234567890.123
[Done]   ✅ Reply posted successfully
```

**In Slack — the bot replies in a thread:**
```
RPA stands for Robotic Process Automation. It is a technology
that uses software robots to automate repetitive, rule-based
digital tasks that humans normally perform...
```

**Reply in the same thread to continue the conversation:**
```
Give me a finance example
```

The bot remembers the context and continues the conversation without starting over.

---

## Understanding the Code

The entire bot lives in **`src/app.ts`** (~150 lines). Here's what each section does:

```
┌─────────────────────────────────────────────┐
│  SECTION 1 — Initialise Slack               │
│  Creates the Slack Bolt app using           │
│  Socket Mode with your tokens               │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  SECTION 2 — Initialise UiPath SDK          │
│  Connects to UiPath Cloud using your PAT    │
│  No browser login required                  │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  SECTION 3 — Session Map                    │
│  A simple Map that links each Slack thread  │
│  to a UiPath conversation ID                │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  SECTION 4 — getOrCreateConversation()      │
│  Checks if this thread already has a        │
│  UiPath conversation. If yes → reuse it.    │
│  If no → discover the agent and create one. │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  SECTION 5 — askAgent()                     │
│  Opens a WebSocket to UiPath, sends the     │
│  user's message, collects streamed chunks,  │
│  closes the session, returns full reply     │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  SECTION 6 — handleMessage()                │
│  The core function — called for every       │
│  message. Ties sections 4 + 5 together      │
│  and posts the reply back to Slack          │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  SECTION 7 — slack.message() listener       │
│  Fires for every message in the channel     │
│  Ignores bot messages to prevent loops      │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  SECTION 8 — slack.event('app_mention')     │
│  Also handles direct @mentions of the bot   │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  SECTION 9 — Start                          │
│  Boots everything up                        │
└─────────────────────────────────────────────┘
```

---

## Troubleshooting

---

**❌ Bot starts but doesn't respond in Slack**

- Make sure you added the bot to the channel (`/invite @BotName`)
- Check that `message.channels` event is enabled in Slack Event Subscriptions
- Check that `channels:history` scope is added in OAuth & Permissions
- After adding scopes, you must **reinstall the app** to the workspace

---

**❌ Error: `No UiPath Conversational Agents found`**

- Verify `UIPATH_ORG_NAME` and `UIPATH_TENANT_NAME` match exactly what's in your cloud.uipath.com URL
- Make sure your agent is **Published/Active** in UiPath Agent Builder
- Make sure your PAT has the `OR.ConversationalAgent` scope

---

**❌ Error: `invalid_auth` from Slack**

- Your `SLACK_BOT_TOKEN` is wrong or expired
- Reinstall the app to the workspace and copy the new `xoxb-` token

---

**❌ Error: `Session timed out after 30s`**

- The UiPath agent might be warming up — try sending the message again
- Check UiPath Automation Cloud status at [status.uipath.com](https://status.uipath.com)

---

**❌ Bot is responding to its own messages (loop)**

- This shouldn't happen — the code checks for `msg.bot_id` before responding
- Make sure you're using a **Bot Token** (`xoxb-`) and not a User Token

---

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| [Node.js](https://nodejs.org) | 18+ | Runtime |
| [TypeScript](https://www.typescriptlang.org) | 5.x | Language |
| [Slack Bolt](https://slack.dev/bolt-js) | 3.x | Slack event handling |
| [UiPath TypeScript SDK](https://uipath.github.io/uipath-typescript/) | 1.x | Conversational Agent API |
| [dotenv](https://github.com/motdotla/dotenv) | 16.x | Environment variable loading |

---

## License

MIT — free to use, modify, and share.
