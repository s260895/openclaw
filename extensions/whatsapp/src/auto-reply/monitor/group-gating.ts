import { resolveMentionGating } from "openclaw/plugin-sdk/channel-inbound";
import { hasControlCommand } from "openclaw/plugin-sdk/command-detection";
import type { loadConfig } from "openclaw/plugin-sdk/config-runtime";
import { recordPendingHistoryEntryIfEnabled } from "openclaw/plugin-sdk/reply-history";
import { parseActivationCommand } from "openclaw/plugin-sdk/reply-runtime";
import { normalizeE164 } from "openclaw/plugin-sdk/text-runtime";
import {
  getPrimaryIdentityId,
  getReplyContext,
  getSelfIdentity,
  getSenderIdentity,
  identitiesOverlap,
} from "../../identity.js";
import type { MentionConfig } from "../mentions.js";
import { buildMentionConfig, debugMention, resolveOwnerList } from "../mentions.js";
import type { WebInboundMsg } from "../types.js";
import { stripMentionsForCommand } from "./commands.js";
import { resolveGroupActivationFor, resolveGroupPolicyFor } from "./group-activation.js";
import { noteGroupMember } from "./group-members.js";

/**
 * Check if message starts with any activation keyword (case-insensitive).
 * Returns the matched keyword if found, otherwise null.
 */
function matchActivationKeyword(
  body: string,
  keywords: string[] | undefined,
): string | null {
  if (!keywords || keywords.length === 0) {
    return null;
  }
  const trimmedBody = body.trim().toLowerCase();
  for (const keyword of keywords) {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (normalizedKeyword && trimmedBody.startsWith(normalizedKeyword)) {
      return keyword;
    }
  }
  return null;
}

/**
 * Resolve activation keywords for a group from config.
 * Checks group-specific config first, then falls back to wildcard "*" config.
 */
function resolveActivationKeywords(
  cfg: ReturnType<typeof loadConfig>,
  conversationId: string,
): string[] | undefined {
  const groups = cfg.channels?.whatsapp?.groups as
    | Record<string, { activationKeywords?: string[] } | undefined>
    | undefined;
  if (!groups) {
    return undefined;
  }
  // Check group-specific config first
  const groupConfig = groups[conversationId];
  if (groupConfig?.activationKeywords) {
    return groupConfig.activationKeywords;
  }
  // Fall back to wildcard config
  const wildcardConfig = groups["*"];
  return wildcardConfig?.activationKeywords;
}

export type GroupHistoryEntry = {
  sender: string;
  body: string;
  timestamp?: number;
  id?: string;
  senderJid?: string;
};

type ApplyGroupGatingParams = {
  cfg: ReturnType<typeof loadConfig>;
  msg: WebInboundMsg;
  conversationId: string;
  groupHistoryKey: string;
  agentId: string;
  sessionKey: string;
  baseMentionConfig: MentionConfig;
  authDir?: string;
  groupHistories: Map<string, GroupHistoryEntry[]>;
  groupHistoryLimit: number;
  groupMemberNames: Map<string, Map<string, string>>;
  logVerbose: (msg: string) => void;
  replyLogger: { debug: (obj: unknown, msg: string) => void };
};

function isOwnerSender(baseMentionConfig: MentionConfig, msg: WebInboundMsg) {
  const sender = normalizeE164(getSenderIdentity(msg).e164 ?? "");
  if (!sender) {
    return false;
  }
  const owners = resolveOwnerList(baseMentionConfig, getSelfIdentity(msg).e164 ?? undefined);
  return owners.includes(sender);
}

function recordPendingGroupHistoryEntry(params: {
  msg: WebInboundMsg;
  groupHistories: Map<string, GroupHistoryEntry[]>;
  groupHistoryKey: string;
  groupHistoryLimit: number;
}) {
  const senderIdentity = getSenderIdentity(params.msg);
  const sender =
    senderIdentity.name && senderIdentity.e164
      ? `${senderIdentity.name} (${senderIdentity.e164})`
      : (senderIdentity.name ??
        senderIdentity.e164 ??
        getPrimaryIdentityId(senderIdentity) ??
        "Unknown");
  recordPendingHistoryEntryIfEnabled({
    historyMap: params.groupHistories,
    historyKey: params.groupHistoryKey,
    limit: params.groupHistoryLimit,
    entry: {
      sender,
      body: params.msg.body,
      timestamp: params.msg.timestamp,
      id: params.msg.id,
      senderJid: senderIdentity.jid ?? params.msg.senderJid,
    },
  });
}

function skipGroupMessageAndStoreHistory(params: ApplyGroupGatingParams, verboseMessage: string) {
  params.logVerbose(verboseMessage);
  recordPendingGroupHistoryEntry({
    msg: params.msg,
    groupHistories: params.groupHistories,
    groupHistoryKey: params.groupHistoryKey,
    groupHistoryLimit: params.groupHistoryLimit,
  });
  return { shouldProcess: false } as const;
}

export function applyGroupGating(params: ApplyGroupGatingParams) {
  const sender = getSenderIdentity(params.msg);
  const self = getSelfIdentity(params.msg, params.authDir);
  const groupPolicy = resolveGroupPolicyFor(params.cfg, params.conversationId);
  if (groupPolicy.allowlistEnabled && !groupPolicy.allowed) {
    params.logVerbose(`Skipping group message ${params.conversationId} (not in allowlist)`);
    return { shouldProcess: false };
  }

  noteGroupMember(
    params.groupMemberNames,
    params.groupHistoryKey,
    sender.e164 ?? undefined,
    sender.name ?? undefined,
  );

  const mentionConfig = buildMentionConfig(params.cfg, params.agentId);
  const commandBody = stripMentionsForCommand(
    params.msg.body,
    mentionConfig.mentionRegexes,
    self.e164,
  );
  const activationCommand = parseActivationCommand(commandBody);
  const owner = isOwnerSender(params.baseMentionConfig, params.msg);
  const shouldBypassMention = owner && hasControlCommand(commandBody, params.cfg);

  if (activationCommand.hasCommand && !owner) {
    return skipGroupMessageAndStoreHistory(
      params,
      `Ignoring /activation from non-owner in group ${params.conversationId}`,
    );
  }

  const mentionDebug = debugMention(params.msg, mentionConfig, params.authDir);
  params.replyLogger.debug(
    {
      conversationId: params.conversationId,
      wasMentioned: mentionDebug.wasMentioned,
      ...mentionDebug.details,
    },
    "group mention debug",
  );
  const wasMentioned = mentionDebug.wasMentioned;
  const activation = resolveGroupActivationFor({
    cfg: params.cfg,
    agentId: params.agentId,
    sessionKey: params.sessionKey,
    conversationId: params.conversationId,
  });
  const requireMention = activation !== "always";
  const replyContext = getReplyContext(params.msg, params.authDir);
  // Detect reply-to-bot: compare JIDs, LIDs, and E.164 numbers.
  // WhatsApp may report the quoted message sender as either a phone JID
  // (xxxxx@s.whatsapp.net) or a LID (xxxxx@lid), so we compare both.
  const implicitMention = identitiesOverlap(self, replyContext?.sender);

  // Check for activation keywords (e.g., "!ai", "@bot")
  const activationKeywords = resolveActivationKeywords(params.cfg, params.conversationId);
  const matchedKeyword = matchActivationKeyword(params.msg.body, activationKeywords);
  const keywordActivated = matchedKeyword !== null;
  if (keywordActivated) {
    params.logVerbose(
      `Activation keyword "${matchedKeyword}" detected in group ${params.conversationId}`,
    );
  }

  const mentionGate = resolveMentionGating({
    requireMention,
    canDetectMention: true,
    wasMentioned,
    implicitMention,
    // Bypass mention requirement if activation keyword matched or other bypass conditions
    shouldBypassMention: shouldBypassMention || keywordActivated,
  });
  params.msg.wasMentioned = mentionGate.effectiveWasMentioned || keywordActivated;
  if (!shouldBypassMention && !keywordActivated && requireMention && mentionGate.shouldSkip) {
    return skipGroupMessageAndStoreHistory(
      params,
      `Group message stored for context (no mention detected) in ${params.conversationId}: ${params.msg.body}`,
    );
  }

  return { shouldProcess: true };
}
