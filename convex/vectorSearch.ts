import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * 卡片向量搜索
 * 使用 OpenAI embeddings 和 Convex 向量搜索
 */

/**
 * 为卡片生成 embedding
 */
export const generateCardEmbedding = action({
  args: {
    cardId: v.string(),
    label: v.string(),
    labelLocalized: v.record(v.string(), v.string()),
    category: v.union(
      v.literal("topic"),
      v.literal("emotion"),
      v.literal("action"),
      v.literal("core")
    ),
  },
  handler: async (ctx, args) => {
    // 这里应该调用 OpenAI API 生成 embedding
    // 由于这是示例，我们使用模拟数据

    console.log(`[VectorSearch] Generating embedding for card: ${args.cardId}`);

    // 模拟生成 1024 维的 embedding
    const embedding = new Array(1024).fill(0).map(() => Math.random() * 2 - 1);

    // 保存到数据库
    await ctx.runMutation(api.vectorSearch.saveCardEmbedding, {
      cardId: args.cardId,
      label: args.label,
      labelLocalized: args.labelLocalized,
      category: args.category,
      embedding,
    });

    return { success: true };
  },
});

/**
 * 批量生成卡片 embeddings
 */
export const generateBatchCardEmbeddings = action({
  args: {
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
      })
    ),
  },
  handler: async (ctx, args) => {
    console.log(`[VectorSearch] Generating embeddings for ${args.cards.length} cards`);

    const results = [];

    for (const card of args.cards) {
      try {
        const result = await ctx.runAction(api.vectorSearch.generateCardEmbedding, card);
        results.push({ cardId: card.id, success: true });
      } catch (error) {
        console.error(`[VectorSearch] Failed to generate embedding for card ${card.id}:`, error);
        results.push({ cardId: card.id, success: false, error });
      }
    }

    return results;
  },
});

/**
 * 保存卡片 embedding 到数据库
 */
export const saveCardEmbedding = mutation({
  args: {
    cardId: v.string(),
    label: v.string(),
    labelLocalized: v.record(v.string(), v.string()),
    category: v.union(
      v.literal("topic"),
      v.literal("emotion"),
      v.literal("action"),
      v.literal("core")
    ),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    // 检查是否已存在
    const existing = await ctx.db
      .query("cards")
      .withIndex("by_id", (q) => q.eq("id", args.cardId))
      .first();

    if (existing) {
      // 更新现有记录
      await ctx.db.patch(existing._id, {
        embedding: args.embedding,
      });
    } else {
      // 创建新记录
      await ctx.db.insert("cards", {
        id: args.cardId,
        label: args.label,
        labelLocalized: args.labelLocalized,
        category: args.category,
        embedding: args.embedding,
        imageUrl: "", // 需要单独设置
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * 向量搜索卡片
 */
export const searchCardsByVector = action({
  args: {
    query: v.string(),
    category: v.optional(
      v.union(
        v.literal("topic"),
        v.literal("emotion"),
        v.literal("action"),
        v.literal("core")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    console.log(`[VectorSearch] Searching for cards with query: "${args.query}"`);

    // 生成查询的 embedding
    const queryEmbedding = new Array(1024).fill(0).map(() => Math.random() * 2 - 1);

    // 执行向量搜索
    const results = await ctx.vectorSearch("cards", "by_embedding", {
      vector: queryEmbedding,
      limit,
      filter: (doc) => {
        if (args.category) {
          return doc.category === args.category;
        }
        return true;
      },
    });

    return results.map((result) => ({
      id: result.document.id,
      label: result.document.label,
      labelLocalized: result.document.labelLocalized,
      category: result.document.category,
      imageUrl: result.document.imageUrl,
      score: result.score,
    }));
  },
});

/**
 * 根据会话上下文推荐卡片
 */
export const recommendCardsByContext = action({
  args: {
    sessionId: v.id("sessions"),
    context: v.string(),
    category: v.optional(
      v.union(
        v.literal("topic"),
        v.literal("emotion"),
        v.literal("action"),
        v.literal("core")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    console.log(`[VectorSearch] Recommending cards for session: ${args.sessionId}`);

    // 获取会话信息
    const session = await ctx.runQuery(api.sessions.getSessionInfo, {
      sessionId: args.sessionId,
    });

    if (!session) {
      throw new Error("Session not found");
    }

    // 获取 Dyad 信息
    const dyad = await ctx.db.get(session.dyadId);

    // 生成上下文 embedding（结合会话历史、Dyad 信息等）
    const contextEmbedding = new Array(1024).fill(0).map(() => Math.random() * 2 - 1);

    // 执行向量搜索
    const results = await ctx.vectorSearch("cards", "by_embedding", {
      vector: contextEmbedding,
      limit,
      filter: (doc) => {
        // 根据类别过滤
        if (args.category && doc.category !== args.category) {
          return false;
        }

        // 可以根据 Dyad 的 locale 等信息进行过滤
        // 这里可以添加更复杂的过滤逻辑

        return true;
      },
    });

    return results.map((result) => ({
      id: result.document.id,
      label: result.document.label,
      labelLocalized: result.document.labelLocalized,
      category: result.document.category,
      imageUrl: result.document.imageUrl,
      score: result.score,
    }));
  },
});

/**
 * 获取相似卡片
 */
export const getSimilarCards = action({
  args: {
    cardId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 5;

    // 获取目标卡片
    const card = await ctx.db
      .query("cards")
      .withIndex("by_id", (q) => q.eq("id", args.cardId))
      .first();

    if (!card || !card.embedding) {
      throw new Error("Card not found or no embedding available");
    }

    // 执行向量搜索
    const results = await ctx.vectorSearch("cards", "by_embedding", {
      vector: card.embedding,
      limit: limit + 1, // +1 因为会包含自身
    });

    // 过滤掉自身
    const similarCards = results
      .filter((result) => result.document.id !== args.cardId)
      .slice(0, limit)
      .map((result) => ({
        id: result.document.id,
        label: result.document.label,
        labelLocalized: result.document.labelLocalized,
        category: result.document.category,
        imageUrl: result.document.imageUrl,
        score: result.score,
      }));

    return similarCards;
  },
});

/**
 * 初始化卡片数据（从现有数据导入）
 */
export const initializeCards = action({
  args: {},
  handler: async (ctx) => {
    console.log("[VectorSearch] Initializing cards...");

    // 这里应该从现有数据源导入卡片
    // 由于这是示例，我们使用模拟数据

    const sampleCards = [
      {
        id: "card_happy",
        label: "Happy",
        labelLocalized: {
          en: "Happy",
          ko: "행복",
          zh: "开心",
          yue: "開心",
        },
        category: "emotion" as const,
      },
      {
        id: "card_sad",
        label: "Sad",
        labelLocalized: {
          en: "Sad",
          ko: "슬픔",
          zh: "难过",
          yue: "難過",
        },
        category: "emotion" as const,
      },
      {
        id: "card_excited",
        label: "Excited",
        labelLocalized: {
          en: "Excited",
          ko: "흥분",
          zh: "兴奋",
          yue: "興奮",
        },
        category: "emotion" as const,
      },
      {
        id: "card_angry",
        label: "Angry",
        labelLocalized: {
          en: "Angry",
          ko: "화남",
          zh: "生气",
          yue: "生氣",
        },
        category: "emotion" as const,
      },
      {
        id: "card_love",
        label: "Love",
        labelLocalized: {
          en: "Love",
          ko: "사랑",
          zh: "爱",
          yue: "愛",
        },
        category: "emotion" as const,
      },
      {
        id: "card_breakfast",
        label: "Breakfast",
        labelLocalized: {
          en: "Breakfast",
          ko: "아침식사",
          zh: "早餐",
          yue: "早餐",
        },
        category: "topic" as const,
      },
      {
        id: "card_lunch",
        label: "Lunch",
        labelLocalized: {
          en: "Lunch",
          ko: "점심",
          zh: "午餐",
          yue: "午餐",
        },
        category: "topic" as const,
      },
      {
        id: "card_dinner",
        label: "Dinner",
        labelLocalized: {
          en: "Dinner",
          ko: "저녁",
          zh: "晚餐",
          yue: "晚餐",
        },
        category: "topic" as const,
      },
      {
        id: "card_play",
        label: "Play",
        labelLocalized: {
          en: "Play",
          ko: "놀기",
          zh: "玩",
          yue: "玩",
        },
        category: "action" as const,
      },
      {
        id: "card_eat",
        label: "Eat",
        labelLocalized: {
          en: "Eat",
          ko: "먹기",
          zh: "吃",
          yue: "食",
        },
        category: "action" as const,
      },
    ];

    // 批量生成 embeddings
    const results = await ctx.runAction(api.vectorSearch.generateBatchCardEmbeddings, {
      cards: sampleCards,
    });

    console.log(`[VectorSearch] Initialized ${results.length} cards`);

    return {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };
  },
});

/**
 * 获取所有卡片
 */
export const getAllCards = query({
  args: {
    category: v.optional(
      v.union(
        v.literal("topic"),
        v.literal("emotion"),
        v.literal("action"),
        v.literal("core")
      )
    ),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("cards");

    if (args.category) {
      query = query.withIndex("by_category", (q) => q.eq("category", args.category));
    }

    const cards = await query.collect();

    return cards.map((card) => ({
      id: card.id,
      label: card.label,
      labelLocalized: card.labelLocalized,
      category: card.category,
      imageUrl: card.imageUrl,
      hasEmbedding: card.embedding && card.embedding.length > 0,
    }));
  },
});

/**
 * 获取卡片统计信息
 */
export const getCardStats = query({
  args: {},
  handler: async (ctx) => {
    const allCards = await ctx.db.query("cards").collect();

    const stats = {
      total: allCards.length,
      withEmbedding: allCards.filter((c) => c.embedding && c.embedding.length > 0).length,
      byCategory: {
        topic: 0,
        emotion: 0,
        action: 0,
        core: 0,
      },
    };

    for (const card of allCards) {
      stats.byCategory[card.category]++;
    }

    return stats;
  },
});