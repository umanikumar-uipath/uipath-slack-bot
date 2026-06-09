import 'dotenv/config';
import { App } from '@slack/bolt';
import { UiPath } from '@uipath/uipath-typescript/core';
import { ConversationalAgent } from '@uipath/uipath-typescript/conversational-agent';

// ─── 1. Initialise Slack ──────────────────────────────────────────────────────

const slack = new App({
  token: process.env.SLACK_BOT_TOKEN!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN!,
});

// ─── 2. Initialise UiPath SDK ─────────────────────────────────────────────────

const sdk = new UiPath({
  baseUrl: 'https://cloud.uipath.com',
  orgName: process.env.UIPATH_ORG_NAME!,
  tenantName: process.env.UIPATH_TENANT_NAME!,
  secret: process.env.UIPATH_PAT!,
});

const caClient = new ConversationalAgent(sdk);

// ─── 3. Session map ───────────────────────────────────────────────────────────
//
// Maps  threadTs → conversationId  so every message in the same Slack thread
// continues the same UiPath conversation.

const sessions = new Map<string, string>();

// ─── 4. Helper: get or create a UiPath conversation ──────────────────────────

async function getOrCreateConversation(threadTs: string, userId: string): Promise<string> {
  const existing = sessions.get(threadTs);
  if (existing) {
    console.log(`[Session] Reusing existing conversation for thread ${threadTs}`);
    return existing;
  }

  console.log(`[UiPath] Discovering agents...`);
  const agents = await caClient.getAll();

  if (!agents || agents.length === 0) {
    throw new Error('No UiPath Conversational Agents found. Make sure one is deployed.');
  }

  console.log(`[UiPath] Found ${agents.length} agent(s). Using: "${(agents[0] as any).name ?? 'Agent #0'}"`);

  const agent = agents[0];
  const conversation = await agent.conversations.create({
    label: `slack-${userId}-${threadTs}`,
  });

  const conversationId = (conversation as any).id as string;

  // Store both the ID (for lookup) and the conversation object (to call startSession)
  sessions.set(threadTs, conversationId);
  sessions.set(`obj-${conversationId}`, conversation as any);

  console.log(`[Session] New conversation created → ID: ${conversationId}`);
  return conversationId;
}

// ─── 5. Helper: send a message to the agent and stream back the reply ─────────

async function askAgent(conversationId: string, userText: string): Promise<string> {
  const conversation = sessions.get(`obj-${conversationId}`) as any;
  if (!conversation) throw new Error('Conversation object missing from session map.');

  console.log(`[UiPath] Opening WebSocket session for conversation ${conversationId}`);

  return new Promise((resolve, reject) => {
    let reply = '';

    const session = conversation.startSession();

    // Collect streamed chunks from the assistant
    session.onExchangeStart((exchange: any) => {
      console.log(`[UiPath] Exchange started — waiting for agent response...`);

      exchange.onMessageStart((message: any) => {
        if (message.isAssistant) {
          message.onContentPartStart((part: any) => {
            if (part.isMarkdown) {
              part.onChunk((chunk: any) => {
                process.stdout.write(chunk.data ?? ''); // stream to terminal in real-time
                reply += chunk.data ?? '';
              });
            }
          });
        }
      });

      // All chunks received — close session and return the full reply
      exchange.onEnd?.(() => {
        process.stdout.write('\n'); // newline after streamed output
        console.log(`[UiPath] Exchange complete. Reply length: ${reply.length} chars`);
        conversation.endSession?.();
        resolve(reply.trim() || '(no response)');
      });
    });

    // WebSocket is ready — fire the user message
    session.onSessionStarted(() => {
      console.log(`[UiPath] Session ready. Sending: "${userText}"`);
      const exchange = session.startExchange();
      exchange.sendMessageWithContentPart({ data: userText });
    });

    session.onError?.((err: Error) => {
      console.error(`[UiPath] Session error: ${err.message}`);
      reject(err);
    });

    // Safety net
    setTimeout(() => reject(new Error('Session timed out after 30s')), 30_000);
  });
}

// ─── 6. Core handler — shared by both message and mention events ──────────────

async function handleMessage(userId: string, channelId: string, threadTs: string, rawText: string, say: Function) {
  // Strip any @mention tokens so only the question text reaches the agent
  const userText = rawText.replace(/<@[A-Z0-9]+>/g, '').trim();

  if (!userText) return; // ignore empty messages

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[Slack] Message from user ${userId} in channel ${channelId}`);
  console.log(`[Slack] Text: "${userText}"`);

  try {
    const conversationId = await getOrCreateConversation(threadTs, userId);

    console.log(`[UiPath] Sending message to agent...`);
    const agentReply = await askAgent(conversationId, userText);

    console.log(`[Slack] Posting reply to thread ${threadTs}`);
    await say({ text: agentReply, thread_ts: threadTs });

    console.log(`[Done] ✅ Reply posted successfully`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Error] ❌ ${msg}`);
    await say({ text: `Sorry, something went wrong: \`${msg}\``, thread_ts: threadTs });
  }
}

// ─── 7. Listen to ALL messages in channels the bot has joined ─────────────────
//
// This fires for every message posted in the channel — no @mention needed.
// Users just type normally and the bot responds.

slack.message(async ({ message, say }) => {
  const msg = message as any;

  // Ignore bot messages (prevents the bot from responding to itself)
  if (msg.bot_id || msg.subtype) return;

  const threadTs = msg.thread_ts ?? msg.ts; // group replies into the same thread
  await handleMessage(msg.user, msg.channel, threadTs, msg.text ?? '', say);
});

// ─── 8. Also listen to @mentions (works in channels + anywhere the bot is tagged)

slack.event('app_mention', async ({ event, say }) => {
  const threadTs = (event as any).thread_ts ?? event.ts;
  await handleMessage(event.user ?? '', event.channel, threadTs, (event as any).text ?? '', say);
});

// ─── 9. Start ─────────────────────────────────────────────────────────────────

(async () => {
  await slack.start();
  console.log('✅ UiPath Slack Bot is running!');
  console.log('📡 Listening for messages in all joined channels...');
  console.log('💡 Tip: Any message posted in the channel will get a reply.\n');
})();
