import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * 创建新会话
 */
export const createSession = mutation({
  args: {
    dyadId: v.id("dyads"),
    topicCategory: v.union(v.literal("plan"), v.literal("recall"), v.literal("free")),
    subtopic: v.optional(v.string()),
    subtopicDescription: v.optional(v.string()),
    localTimezone: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 验证 Dyad 是否存在
    const dyad = await ctx.db.get(args.dyadId);
    if (!dyad) {
      throw new Error("Dyad not found");
    }

    // 创建会话
    const sessionId = await ctx.db.insert("sessions", {
      dyadId: args.dyadId,
      status: "initial",
      topicCategory: args.topicCategory,
      subtopic: args.subtopic,
      subtopicDescription: args.subtopicDescription,
      localTimezone: args.localTimezone,
      startedAt: now,
      numTurns: 0,
      createdAt: now,
      updatedAt: now,
    });

    return sessionId;
  },
});

/**
 * 开始会话
 */
export const startSession = action({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.runQuery(api.sessions.getSessionInfo, {
      sessionId: args.sessionId,
    });

    if (!session) {
      throw new Error("Session not found");
    }

    // 更新会话状态
    await ctx.runMutation(internal.updateSessionStatus, {
      sessionId: args.sessionId,
      status: "started",
    });

    // 创建初始对话轮次
    const turnId = await ctx.runMutation(internal.insertDialogueTurn, {
      sessionId: args.sessionId,
      role: "parent",
    });

    // 生成初始家长引导（这里简化处理，实际应该调用 AI）
    const parentGuides = await ctx.runMutation(internal.insertParentGuideRecommendation, {
      sessionId: args.sessionId,
      turnId,
      guides: [
        {
          id: "guide_1",
          category: "intention",
          guide: "请开始今天的对话",
          guideLocalized: "Please start today's conversation",
          type: "messaging",
        },
      ],
    });

    return {
      turnId,
      parentGuides: await ctx.runMutation(internal.getParentGuideRecommendation, {
        recommendationId: parentGuides,
      }),
    };
  },
});

/**
 * 结束会话
 */
export const endSession = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // 更新会话状态
    await ctx.db.patch(args.sessionId, {
      status: "terminated",
      endedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 获取最后对话轮次
    const lastTurn = await ctx.db
      .query("dialogueTurns")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();

    return {
      nextTurnId: lastTurn?._id,
    };
  },
});

/**
 * 中止会话
 */
export const abortSession = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // 删除会话
    await ctx.db.delete(args.sessionId);

    // 删除相关的对话轮次
    const turns = await ctx.db
      .query("dialogueTurns")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const turn of turns) {
      await ctx.db.delete(turn._id);
    }

    // 删除相关的消息
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // 删除相关的推荐结果
    const recommendations = await ctx.db
      .query("childCardRecommendations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const rec of recommendations) {
      await ctx.db.delete(rec._id);
    }

    const parentGuides = await ctx.db
      .query("parentGuideRecommendations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const guide of parentGuides) {
      await ctx.db.delete(guide._id);
    }

    return { success: true };
  },
});

/**
 * 获取会话信息
 */
export const getSessionInfo = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    return session;
  },
});

/**
 * 获取 Dyad 的所有会话
 */
export const getDyadSessions = query({
  args: {
    dyadId: v.id("dyads"),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_dyad", (q) => q.eq("dyadId", args.dyadId))
      .order("desc")
      .collect();

    return sessions;
  },
});

/**
 * 获取已终止的会话
 */
export const getTerminatedSessions = query({
  args: {
    dyadId: v.id("dyads"),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_dyad", (q) => q.eq("dyadId", args.dyadId))
      .filter((q) => q.eq("status", "terminated"))
      .order("desc")
      .collect();

    return sessions;
  },
});

/**
 * 获取完整对话
 */
export const getFullDialogue = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const turns = await ctx.db
      .query("dialogueTurns")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const dialogue = await Promise.all(
      turns.map(async (turn) => {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_turn", (q) => q.eq("turnId", turn._id))
          .collect();

        return {
          turnId: turn._id,
          role: turn.role,
          startedAt: turn.startedAt,
          endedAt: turn.endedAt,
          messages: messages.map((msg) => ({
            messageId: msg._id,
            role: msg.role,
            contentType: msg.contentType,
            contentStr: msg.contentStr,
            contentStrLocalized: msg.contentStrLocalized,
            contentJson: msg.contentJson,
            timestamp: msg.timestamp,
          })),
        };
      })
    );

    return dialogue;
  },
});

/**
 * 添加家长文本消息
 */
export const addParentTextMessage = action({
  args: {
    sessionId: v.id("sessions"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.runQuery(api.sessions.getSessionInfo, {
      sessionId: args.sessionId,
    });

    if (!session) {
      throw new Error("Session not found");
    }

    // 创建新的对话轮次
    const turnId = await ctx.runMutation(internal.insertDialogueTurn, {
      sessionId: args.sessionId,
      role: "parent",
    });

    // 添加消息
    await ctx.runMutation(internal.insertMessage, {
      sessionId: args.sessionId,
      turnId,
      role: "parent",
      contentType: "text",
      contentStr: args.message,
    });

    // 更新会话轮次计数
    await ctx.runMutation(internal.updateSessionTurnCount, {
      sessionId: args.sessionId,
    });

    // 使用向量搜索生成儿童卡片推荐
    const recommendedCards = await ctx.runAction(api.vectorSearch.recommendCardsByContext, {
      sessionId: args.sessionId,
      context: args.message,
      limit: 5,
    });

    // 保存推荐结果
    const recommendationId = await ctx.runMutation(internal.insertChildCardRecommendation, {
      sessionId: args.sessionId,
      turnId,
      cards: recommendedCards,
    });

    return {
      nextTurnId: turnId,
      payload: {
        id: recommendationId,
        cards: recommendedCards,
        timestamp: Date.now(),
      },
    };
  },
});

/**
 * 添加儿童卡片
 */
export const addChildCard = mutation({
  args: {
    sessionId: v.id("sessions"),
    cardId: v.string(),
    recommendationId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // 添加到临时选择
    const lastTurn = await ctx.db
      .query("dialogueTurns")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();

    if (lastTurn) {
      const existingSelection = await ctx.db
        .query("interimCardSelections")
        .withIndex("by_turn", (q) => q.eq("turnId", lastTurn._id))
        .first();

      if (existingSelection) {
        await ctx.db.patch(existingSelection._id, {
          cards: [
            ...existingSelection.cards,
            {
              id: args.cardId,
              recommendationId: args.recommendationId,
              label: "Card",
              labelLocalized: "卡片",
              category: "core",
            },
          ],
        });
      } else {
        await ctx.db.insert("interimCardSelections", {
          sessionId: args.sessionId,
          turnId: lastTurn._id,
          cards: [
            {
              id: args.cardId,
              recommendationId: args.recommendationId,
              label: "Card",
              labelLocalized: "卡片",
              category: "core",
            },
          ],
          timestamp: Date.now(),
          createdAt: Date.now(),
        });
      }
    }

    return { success: true };
  },
});

/**
 * 移除最后一个儿童卡片
 */
export const removeLastChildCard = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const lastTurn = await ctx.db
      .query("dialogueTurns")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();

    if (lastTurn) {
      const existingSelection = await ctx.db
        .query("interimCardSelections")
        .withIndex("by_turn", (q) => q.eq("turnId", lastTurn._id))
        .first();

      if (existingSelection && existingSelection.cards.length > 0) {
        const newCards = existingSelection.cards.slice(0, -1);
        await ctx.db.patch(existingSelection._id, {
          cards: newCards,
        });
      }
    }

    return { success: true };
  },
});

/**
 * 确认儿童卡片选择
 */
export const confirmChildCards = action({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.runQuery(api.sessions.getSessionInfo, {
      sessionId: args.sessionId,
    });

    if (!session) {
      throw new Error("Session not found");
    }

    // 获取最后对话轮次
    const lastTurn = await ctx.runQuery(internal.getLastTurn, {
      sessionId: args.sessionId,
    });

    if (!lastTurn) {
      throw new Error("No turn found");
    }

    // 获取临时选择
    const selection = await ctx.runQuery(internal.getInterimCardSelection, {
      turnId: lastTurn._id,
    });

    // 添加消息
    await ctx.runMutation(internal.insertMessage, {
      sessionId: args.sessionId,
      turnId: lastTurn._id,
      role: "child",
      contentType: "json",
      contentJson: selection?.cards || [],
    });

    // 创建新的对话轮次
    const newTurnId = await ctx.runMutation(internal.insertDialogueTurn, {
      sessionId: args.sessionId,
      role: "parent",
    });

    // 更新会话轮次计数
    await ctx.runMutation(internal.updateSessionTurnCount, {
      sessionId: args.sessionId,
    });

    // 使用向量搜索生成新的家长引导
    const context = selection?.cards.map((c: any) => c.label).join(", ") || "selection";
    const recommendedGuides = await ctx.runAction(api.vectorSearch.searchCardsByVector, {
      query: `empathize with ${context}`,
      limit: 3,
    });

    // 生成家长引导（这里简化处理，实际应该调用 AI）
    const guides = [
      {
        id: "guide_" + Date.now(),
        category: "empathize",
        guide: "很好的选择！",
        guideLocalized: "Great choice!",
        type: "messaging" as const,
      },
    ];

    const parentGuides = await ctx.runMutation(internal.insertParentGuideRecommendation, {
      sessionId: args.sessionId,
      turnId: newTurnId,
      guides,
    });

    return {
      nextTurnId: newTurnId,
      payload: await ctx.runMutation(internal.getParentGuideRecommendation, {
        recommendationId: parentGuides,
      }),
    };
  },
});

const getInterimCardSelection = query({
  args: {
    turnId: v.id("dialogueTurns"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("interimCardSelections")
      .withIndex("by_turn", (q) => q.eq("turnId", args.turnId))
      .first();
  },
});

/**
 * 刷新卡片推荐
 */
export const refreshCards = action({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const lastTurn = await ctx.runQuery(internal.getLastTurn, {
      sessionId: args.sessionId,
    });

    if (!lastTurn) {
      throw new Error("No turn found");
    }

    // 使用向量搜索生成新的卡片推荐
    const recommendedCards = await ctx.runAction(api.vectorSearch.recommendCardsByContext, {
      sessionId: args.sessionId,
      context: "refresh",
      limit: 5,
    });

    // 保存推荐结果
    const recommendationId = await ctx.runMutation(internal.insertChildCardRecommendation, {
      sessionId: args.sessionId,
      turnId: lastTurn._id,
      cards: recommendedCards,
    });

    return {
      id: recommendationId,
      cards: recommendedCards,
      timestamp: Date.now(),
    };
  },
});

// ============================================
// Internal Helper Functions
// ============================================

const insertDialogueTurn = mutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.union(v.literal("parent"), v.literal("child")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("dialogueTurns", {
      sessionId: args.sessionId,
      role: args.role,
      startedAt: Date.now(),
      endedAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

const insertMessage = mutation({
  args: {
    sessionId: v.id("sessions"),
    turnId: v.id("dialogueTurns"),
    role: v.union(v.literal("parent"), v.literal("child")),
    contentType: v.union(v.literal("text"), v.literal("json")),
    contentStr: v.optional(v.string()),
    contentJson: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      turnId: args.turnId,
      role: args.role,
      contentType: args.contentType,
      contentStr: args.contentStr,
      contentJson: args.contentJson,
      timestamp: Date.now(),
      createdAt: Date.now(),
    });
  },
});

const updateSessionTurnCount = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(args.sessionId, {
      numTurns: session.numTurns + 1,
      updatedAt: Date.now(),
    });
  },
});

const insertChildCardRecommendation = mutation({
  args: {
    sessionId: v.id("sessions"),
    turnId: v.optional(v.id("dialogueTurns")),
    cards: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        labelLocalized: v.record(v.string(), v.string()),
        category: v.union(
          v.literal("topic"),
          v.literal("emotion"),
          v.literal("action"),
          v.literal("core")
        ),
        imageUrl: v.string(),
        score: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("childCardRecommendations", {
      sessionId: args.sessionId,
      turnId: args.turnId,
      cards: args.cards.map((card) => ({
        id: card.id,
        recommendationId: "rec_" + Date.now(),
        label: card.label,
        labelLocalized: card.labelLocalized.en || card.label,
        category: card.category,
      })),
      timestamp: Date.now(),
      createdAt: Date.now(),
    });
  },
});

const getLastTurn = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dialogueTurns")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();
  },
});

const updateSessionStatus = mutation({
  args: {
    sessionId: v.id("sessions"),
    status: v.union(
      v.literal("initial"),
      v.literal("started"),
      v.literal("conversation"),
      v.literal("terminated")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

const insertParentGuideRecommendation = mutation({
  args: {
    sessionId: v.id("sessions"),
    turnId: v.optional(v.id("dialogueTurns")),
    guides: v.array(
      v.object({
        id: v.string(),
        category: v.union(
          v.union(
            v.literal("intention"),
            v.literal("specification"),
            v.literal("choice"),
            v.literal("clues"),
            v.literal("coping"),
            v.literal("stimulate"),
            v.literal("share"),
            v.literal("empathize"),
            v.literal("encourage"),
            v.literal("emotion"),
            v.literal("extend"),
            v.literal("terminate")
          ),
          v.array(v.union(v.literal("blame"), v.literal("correction"), v.literal("complex"), v.literal("deviation")))
        ),
        guide: v.string(),
        guideLocalized: v.optional(v.string()),
        type: v.union(v.literal("messaging"), v.literal("feedback")),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("parentGuideRecommendations", {
      sessionId: args.sessionId,
      turnId: args.turnId,
      guides: args.guides,
      timestamp: Date.now(),
      createdAt: Date.now(),
    });
  },
});

const getParentGuideRecommendation = query({
  args: {
    recommendationId: v.id("parentGuideRecommendations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.recommendationId);
  },
});