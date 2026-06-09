# UiPath Conversational Agent — Slack Bot

> A Slack bot that connects any channel in your workspace to a **UiPath Conversational Agent**.  
> Just type a message in the channel — no `@mention` needed — and the bot replies in the same thread, remembering context across follow-up messages.

---

## Table of Contents

1. [What This Bot Does](#1-what-this-bot-does)
2. [How It Works — Big Picture](#2-how-it-works--big-picture)
3. [Prerequisites](#3-prerequisites)
4. [Part A — Create the Slack App](#part-a--create-the-slack-app)
5. [Part B — UiPath Setup](#part-b--uipath-setup)
6. [Part C — Project Setup & Run](#part-c--project-setup--run)
7. [Part D — The Code Explained](#part-d--the-code-explained)
8. [See It In Action](#see-it-in-action)
9. [Troubleshooting](#troubleshooting)

---

## 1. What This Bot Does

Once set up, anyone in your Slack workspace opens a channel (e.g. `#capstone-projects`) and simply **types a message**. The bot will:

- Pick up every message automatically — no `@mention` needed
- Send it to the UiPath Conversational Agent
- Stream the reply back into the **same Slack thread**
- **Remember the full conversation** — follow-up messages in the same thread keep the context

```
You type in Slack:         "What is RPA?"
Bot replies in thread:     "RPA stands for Robotic Process Automation..."

You reply in same thread:  "Give me a finance example"
Bot replies:               "Sure! Invoice processing is a great example..."  ← still has context
```

---

## 2. How It Works — Big Picture

```
┌─────────────────────────────────────────────────────────────┐
│                        SLACK                                │
│   User types a message in #capstone-projects                │
└──────────────────────────┬──────────────────────────────────┘
                           │  Socket Mode (secure WebSocket)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     BOT  (src/app.ts)                       │
│                                                             │
│  1. Receives the message from Slack                         │
│  2. Checks if this thread already has a UiPath session      │
│  3. If not → discovers the agent and creates a conversation │
│  4. Sends the user's text to the UiPath agent               │
│  5. Streams the response back into Slack                    │
└──────────────────────────┬──────────────────────────────────┘
                           │  WebSocket streaming
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              UIPATH AUTOMATION CLOUD                        │
│   Conversational Agent processes the message and            │
│   streams the reply back chunk by chunk                     │
└─────────────────────────────────────────────────────────────┘
```

**Session Map — how context is preserved:**

The bot keeps a table that links each Slack thread to a UiPath conversation:

| Slack Thread ID | UiPath Conversation ID |
|---|---|
| `1748234567.123` | `conv-uuid-abc-001` |
| `1748234890.456` | `conv-uuid-xyz-002` |

Same thread → same UiPath conversation → full context preserved.

---

## 3. Prerequisites

| What you need | Details |
|---|---|
| **Node.js 18+** | Download from [nodejs.org](https://nodejs.org) — pick the LTS version |
| **A Slack Workspace** | You need permission to install apps in the workspace |
| **UiPath Automation Cloud account** | With at least one Conversational Agent deployed |
| **Git** | To clone this repo |

**Verify Node.js is installed:**
```bash
node --version   # should print v18.x.x or higher
npm --version    # should print 9.x.x or higher
```

---

## Part A — Create the Slack App

> This section covers every click from zero to a working Slack app.  
> At the end you will have 3 tokens saved — you need all three.

---

### A1. Go to the Slack API Portal

Open → **https://api.slack.com/apps**

Sign in with your Slack workspace account if prompted.

---

### A2. Create a New App

Click the green **"Create New App"** button (top-right corner).

A popup appears — select **"From scratch"**.

Fill in:
- **App Name** → `UiPath Agent` (or any name you prefer)
- **Pick a workspace** → select your company's Slack workspace

Click **"Create App"**.

You land on your app's dashboard showing the App Name and App ID.

---

### A3. Enable Socket Mode

> Socket Mode connects the bot to Slack over a secure outbound WebSocket.  
> This means **you do not need a public URL or a server open to the internet**.

In the **left sidebar**, click → **"Socket Mode"**

Toggle the switch **ON** (turns green).

A popup appears — create an **App-Level Token**:

| Field | What to enter |
|---|---|
| Token Name | `socket-token` |
| Scope | Click "Add Scope" → select `connections:write` |

Click **"Generate"**.

A token appears starting with `xapp-1-...`

> ⚠️ **Copy this token immediately — it is only shown once.**

Save it as → `SLACK_APP_TOKEN`

Click **"Done"**.

---

### A4. Add Bot Permissions (Scopes)

In the **left sidebar**, click → **"OAuth & Permissions"**

Scroll down to the **"Scopes"** section → **"Bot Token Scopes"**.

Click **"Add an OAuth Scope"** and add these three scopes one by one:

| Scope | What it allows |
|---|---|
| `app_mentions:read` | Bot receives events when someone @mentions it |
| `chat:write` | Bot can send messages into channels |
| `channels:history` | Bot can read messages posted in channels |

---

### A5. Subscribe to Events

In the **left sidebar**, click → **"Event Subscriptions"**

Toggle **"Enable Events"** to **ON**.

Scroll to **"Subscribe to bot events"** → click **"Add Bot User Event"** and add both:

| Event | When it fires |
|---|---|
| `app_mention` | Someone types `@YourBot hello` |
| `message.channels` | Someone posts ANY message in a channel the bot joined |

Click **"Save Changes"** at the bottom of the page.

---

### A6. Install the App to Your Workspace

In the **left sidebar**, click → **"OAuth & Permissions"**

At the top of the page, click **"Install to Workspace"**.

Click **"Allow"** on the permissions screen.

You are redirected back and see:

```
Bot User OAuth Token
xoxb-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxx     [Copy]
```

Click **"Copy"** → Save it as → `SLACK_BOT_TOKEN`

> ⚠️ Never share this token — it gives full bot access to your workspace.

---

### A7. Get the Signing Secret

In the **left sidebar**, click → **"Basic Information"**

Scroll to **"App Credentials"** → next to **"Signing Secret"**, click **"Show"**.

Copy the value → Save it as → `SLACK_SIGNING_SECRET`

---

### ✅ Part A Complete — you should have all 3 Slack values:

```
SLACK_BOT_TOKEN       =  xoxb-...        (from step A6)
SLACK_SIGNING_SECRET  =  abc123...       (from step A7)
SLACK_APP_TOKEN       =  xapp-1-...      (from step A3)
```

---

## Part B — UiPath Setup

> At the end of this section you will have 3 UiPath values saved.

---

### B1. Log in to UiPath Cloud

Go to → **https://cloud.uipath.com**

---

### B2. Find Your Org Name and Tenant Name

Look at your browser's URL bar after logging in:

```
https://cloud.uipath.com/ acmecorp / Production / portal_ / ...
                           ^^^^^^^^^   ^^^^^^^^^^
                           ORG NAME    TENANT NAME
```

Save both:
- `UIPATH_ORG_NAME` = the segment right after `cloud.uipath.com/`
- `UIPATH_TENANT_NAME` = the next segment after the org name

---

### B3. Confirm Your Agent is Deployed

1. In UiPath Cloud, open **"Agent Builder"** from the left menu
2. Find your Conversational Agent in the list
3. Confirm its status shows **"Published"** or **"Active"**

> If no agent exists yet — create one in Agent Builder, configure it, and click **"Publish"** before continuing.

---

### B4. Generate a Personal Access Token (PAT)

A PAT lets the bot authenticate with UiPath from code — no browser login required.

1. Click your **profile avatar** (top-right corner)
2. Click **"Preferences"**
3. In the left menu, click **"Personal Access Tokens"**
4. Click **"Create Token"**

Fill in:

| Field | What to enter |
|---|---|
| Name | `slack-bot` |
| Expiry Date | 1 year from today |
| Scopes | ✅ `OR.ConversationalAgent`  ✅ `OR.Folders.Read` |

Click **"Create"**.

A token appears starting with `up_pat_...`

> ⚠️ **Copy this token immediately — it is only shown once.**

Save it as → `UIPATH_PAT`

---

### ✅ Part B Complete — you should have all 3 UiPath values:

```
UIPATH_PAT          =  up_pat_...    (from step B4)
UIPATH_ORG_NAME     =  your-org      (from step B2)
UIPATH_TENANT_NAME  =  your-tenant   (from step B2)
```

---

## Part C — Project Setup & Run

---

### C1. Clone the Repo

```bash
git clone https://github.com/umanikumar-uipath/uipath-slack-bot.git
cd uipath-slack-bot
```

---

### C2. Create Your `.env` File

```bash
cp .env.example .env
```

Open `.env` in VS Code (or any text editor) and replace every placeholder with your real values:

```env
# ── Slack ──────────────────────────────────────────────────────
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here

# ── UiPath ─────────────────────────────────────────────────────
UIPATH_PAT=up_pat_your-token-here
UIPATH_ORG_NAME=your-org-name
UIPATH_TENANT_NAME=your-tenant-name
```

Save the file.

> 🔒 `.env` is in `.gitignore` — your secrets will **never** be pushed to GitHub.

---

### C3. Install Dependencies

```bash
npm install
```

This downloads 3 packages into `node_modules/`:

| Package | Purpose |
|---|---|
| `@slack/bolt` | Official Slack framework — handles all Slack events |
| `@uipath/uipath-typescript` | Official UiPath SDK — talks to the Conversational Agent |
| `dotenv` | Loads your `.env` file into `process.env` |

---

### C4. Start the Bot

```bash
npm run dev
```

If everything is configured correctly you will see:

```
✅ UiPath Slack Bot is running!
📡 Listening for messages in all joined channels...
💡 Tip: Any message posted in the channel will get a reply.
```

> Keep this terminal open. The bot stops if you close it.

---

### C5. Add the Bot to Your Slack Channel

The bot won't see messages in a channel until it's been added to it.

Open Slack → go to `#capstone-projects` → type:

```
/invite @UiPathAgent
```

Or click the channel name → **Integrations** → **Add apps** → search your bot → **Add**.

---

## Part D — The Code Explained

The entire bot is in **`src/app.ts`** (~150 lines). Here is every section explained.

---

### D1. Imports

```typescript
import 'dotenv/config';
import { App } from '@slack/bolt';
import { UiPath } from '@uipath/uipath-typescript/core';
import { ConversationalAgent } from '@uipath/uipath-typescript/conversational-agent';
```

| Line | What it does |
|---|---|
| `dotenv/config` | Reads `.env` and loads all variables into `process.env` |
| `App` | The Slack Bolt class — handles all incoming Slack events |
| `UiPath` | UiPath SDK core — manages authentication to UiPath Cloud |
| `ConversationalAgent` | The SDK module that communicates with the deployed agent |

---

### D2. Initialise Slack

```typescript
const slack = new App({
  token: process.env.SLACK_BOT_TOKEN!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN!,
});
```

| Property | What it does |
|---|---|
| `token` | The `xoxb-` bot token — proves to Slack who this bot is |
| `signingSecret` | Verifies incoming events are genuinely from Slack (security check) |
| `socketMode: true` | Use WebSocket instead of HTTP — no public URL required |
| `appToken` | The `xapp-` token that authorises the WebSocket tunnel |

---

### D3. Initialise UiPath

```typescript
const sdk = new UiPath({
  baseUrl: 'https://cloud.uipath.com',
  orgName: process.env.UIPATH_ORG_NAME!,
  tenantName: process.env.UIPATH_TENANT_NAME!,
  secret: process.env.UIPATH_PAT!,
});

const caClient = new ConversationalAgent(sdk);
```

| Line | What it does |
|---|---|
| `new UiPath(...)` | Creates an authenticated connection to UiPath Cloud using the PAT |
| `new ConversationalAgent(sdk)` | Creates a client for the Conversational Agent API |

---

### D4. Session Map

```typescript
const sessions = new Map<string, string>();
```

A simple in-memory key-value store that remembers which Slack thread belongs to which UiPath conversation:

```
"slack-thread-ts-001"        →  "uipath-conversation-uuid-001"
"obj-uipath-uuid-001"        →  <conversation object>
```

Two types of entries are stored:
- `threadTs` → `conversationId` (for quick lookup)
- `obj-conversationId` → conversation object (to call `startSession()` on it)

---

### D5. `getOrCreateConversation()` — Step by Step

```typescript
async function getOrCreateConversation(threadTs: string, userId: string) {

  // Step 1 — Has this thread been seen before?
  const existing = sessions.get(threadTs);
  if (existing) return existing;              // ← YES: reuse existing conversation

  // Step 2 — First message in this thread. Discover available agents.
  const agents = await caClient.getAll();
  const agent = agents[0];                    // ← pick the first deployed agent

  // Step 3 — Create a new UiPath conversation for this thread
  const conversation = await agent.conversations.create({
    label: `slack-${userId}-${threadTs}`,
  });

  const conversationId = (conversation as any).id as string;

  // Step 4 — Save to the session map for next time
  sessions.set(threadTs, conversationId);
  sessions.set(`obj-${conversationId}`, conversation as any);

  return conversationId;
}
```

**Decision flow:**
```
Message arrives in thread
         │
         ▼
  sessions.get(threadTs)
         │
    ┌────┴────┐
   YES       NO
    │         │
  Return    Call caClient.getAll()
  existing       │
  ID         Pick agent[0]
                 │
             agent.conversations.create()
                 │
             Save to sessions Map
                 │
             Return new conversationId
```

---

### D6. `askAgent()` — Step by Step

```typescript
async function askAgent(conversationId: string, userText: string): Promise<string> {
  const conversation = sessions.get(`obj-${conversationId}`);

  return new Promise((resolve, reject) => {
    let reply = '';

    // Step 1 — Open a WebSocket session to UiPath
    const session = conversation.startSession();

    // Step 2 — Wire up streaming event handlers
    session.onExchangeStart((exchange) => {
      exchange.onMessageStart((message) => {
        if (message.isAssistant) {
          message.onContentPartStart((part) => {
            if (part.isMarkdown) {
              part.onChunk((chunk) => {
                process.stdout.write(chunk.data ?? ''); // stream to terminal
                reply += chunk.data ?? '';              // build up full reply
              });
            }
          });
        }
      });

      // Step 3 — Exchange ended: close session, return full reply
      exchange.onEnd(() => {
        conversation.endSession();
        resolve(reply.trim());
      });
    });

    // Step 4 — WebSocket ready: send the user's message
    session.onSessionStarted(() => {
      const exchange = session.startExchange();
      exchange.sendMessageWithContentPart({ data: userText });
    });

    session.onError((err) => reject(err));
    setTimeout(() => reject(new Error('Timed out after 30s')), 30_000);
  });
}
```

**WebSocket flow:**
```
conversation.startSession()
        ↓
onSessionStarted → startExchange() → sendMessageWithContentPart(text)
        ↓
onExchangeStart → onMessageStart → onContentPartStart → onChunk × many times
        ↓
onEnd → endSession() → resolve(fullReply)
```

---

### D7. `handleMessage()` — Ties Everything Together

```typescript
async function handleMessage(userId, channelId, threadTs, rawText, say) {

  // Remove @BotName token if present (e.g. from @mentions)
  const userText = rawText.replace(/<@[A-Z0-9]+>/g, '').trim();
  if (!userText) return;

  // Get or create UiPath conversation for this thread
  const conversationId = await getOrCreateConversation(threadTs, userId);

  // Send to agent, wait for full reply
  const agentReply = await askAgent(conversationId, userText);

  // Post reply into the same Slack thread
  await say({ text: agentReply, thread_ts: threadTs });
}
```

---

### D8. Event Listeners

```typescript
// Fires for every message in any channel the bot has joined
slack.message(async ({ message, say }) => {
  const msg = message as any;
  if (msg.bot_id || msg.subtype) return; // ignore bot messages — prevents loops
  const threadTs = msg.thread_ts ?? msg.ts;
  await handleMessage(msg.user, msg.channel, threadTs, msg.text ?? '', say);
});

// Also handles direct @mentions of the bot
slack.event('app_mention', async ({ event, say }) => {
  const threadTs = (event as any).thread_ts ?? event.ts;
  await handleMessage(event.user ?? '', event.channel, threadTs, (event as any).text ?? '', say);
});
```

> `msg.thread_ts ?? msg.ts` explained:
> - Reply inside an existing thread → `thread_ts` is set → groups this message under the same thread
> - New top-level message → `thread_ts` is undefined → use `ts` (the message's own timestamp)

---

### D9. Full Data Flow

```
User types "What is RPA?" in #capstone-projects
               ↓
  slack.message() fires
               ↓
  msg.bot_id? → NO → continue
               ↓
  handleMessage() called
               ↓
  getOrCreateConversation(threadTs, userId)
     ├─ seen before? → return existing conversationId
     └─ new thread?  → caClient.getAll() → agent.conversations.create()
               ↓
  askAgent(conversationId, "What is RPA?")
     ├─ conversation.startSession()       → opens WebSocket
     ├─ session.onSessionStarted()        → WebSocket ready
     ├─ session.startExchange()           → starts Q&A turn
     ├─ exchange.sendMessageWithContentPart() → sends question
     ├─ onChunk() × N                     → streams answer chunks
     └─ exchange.onEnd()                  → reply complete, close WebSocket
               ↓
  say({ text: agentReply, thread_ts })
               ↓
  Reply appears in Slack thread
```

---

## See It In Action

**In Slack — type in the channel:**
```
What can UiPath automate?
```

**Terminal — live logs:**
```
────────────────────────────────────────────────────────────
[Slack]   Message from user U012345 in channel C067890
[Slack]   Text: "What can UiPath automate?"
[UiPath]  Discovering agents...
[UiPath]  Found 1 agent(s). Using: "Capstone Agent"
[Session] New conversation created → ID: abc-123-uuid
[UiPath]  Opening WebSocket session...
[UiPath]  Session ready. Sending: "What can UiPath automate?"
UiPath can automate a wide range of...       ← streams in real-time
[UiPath]  Exchange complete. Reply: 312 chars
[Slack]   Posting reply to thread 1748234567.123
[Done]    ✅ Reply posted successfully
```

**Slack — bot replies in thread:**
```
UiPath can automate a wide range of repetitive, rule-based
digital tasks including invoice processing, data entry,
report generation, and employee onboarding workflows...
```

**Follow-up in the same thread:**
```
What about HR?
```

The bot remembers the full conversation and continues — no need to repeat context.

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Bot doesn't respond to messages | Missing `message.channels` event | Add `message.channels` in Event Subscriptions → reinstall app |
| Bot doesn't respond to @mentions | Missing `app_mention` event | Add `app_mention` in Event Subscriptions → reinstall app |
| `No UiPath Agents found` | Wrong org/tenant or agent not published | Double-check `UIPATH_ORG_NAME` and `UIPATH_TENANT_NAME` match your cloud URL exactly. Confirm agent is Published in Agent Builder |
| `invalid_auth` from Slack | Wrong or expired bot token | Reinstall app to workspace, copy fresh `xoxb-` token |
| `Session timed out after 30s` | Agent is cold-starting | Wait 10 seconds and try again |
| Bot replies twice to @mentions | Both listeners fire | Expected — `handleMessage()` deduplicates via the session map |
| PAT token expired | PAT has an expiry date | Generate a new PAT in UiPath Cloud → update `UIPATH_PAT` in `.env` → restart |

---

## Project Structure

```
uipath-slack-bot/
├── src/
│   └── app.ts          ← the entire bot (~150 lines)
├── .env.example        ← template showing all required variables
├── .gitignore          ← keeps .env and node_modules out of git
├── package.json        ← dependencies and run scripts
├── tsconfig.json       ← TypeScript compiler settings
└── README.md           ← this file
```

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

MIT
