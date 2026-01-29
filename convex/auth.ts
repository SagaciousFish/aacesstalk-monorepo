import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * 生成随机 6 位数字码
 */
function generateSixDigitCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000);
  return code.toString();
}

/**
 * 创建新的 Dyad 账户
 */
export const createDyad = mutation({
  args: {
    alias: v.string(),
    childName: v.string(),
    childGender: v.union(v.literal("boy"), v.literal("girl")),
    parentType: v.union(v.literal("mother"), v.literal("father")),
    locale: v.union(v.literal("zh"), v.literal("yue"), v.literal("ko"), v.literal("en")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 创建 Dyad
    const dyadId = await ctx.db.insert("dyads", {
      alias: args.alias,
      childName: args.childName,
      childGender: args.childGender,
      parentType: args.parentType,
      locale: args.locale,
      createdAt: now,
      updatedAt: now,
    });

    // 生成登录码
    const code = generateSixDigitCode();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 天后过期

    await ctx.db.insert("dyadLoginCodes", {
      dyadId,
      code,
      issuedAt: now,
      active: true,
      expiresAt,
    });

    return { dyadId, code };
  },
});

/**
 * 使用 6 位数字码登录
 */
export const loginDyad = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 查找有效的登录码
    const loginCode = await ctx.db
      .query("dyadLoginCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code).eq("active", true))
      .first();

    if (!loginCode) {
      throw new Error("Invalid login code");
    }

    // 检查是否过期
    if (loginCode.expiresAt < now) {
      await ctx.db.patch(loginCode._id, { active: false });
      throw new Error("Login code expired");
    }

    // 获取 Dyad 信息
    const dyad = await ctx.db.get(loginCode.dyadId);
    if (!dyad) {
      throw new Error("Dyad not found");
    }

    // 生成 JWT token (这里简化处理，实际项目中应该使用加密库)
    const token = Buffer.from(
      JSON.stringify({
        sub: dyad._id,
        alias: dyad.alias,
        childName: dyad.childName,
        childGender: dyad.childGender,
        parentType: dyad.parentType,
        locale: dyad.locale,
        iat: Math.floor(now / 1000),
        exp: Math.floor(now / 1000) + 365 * 24 * 60 * 60, // 1 年后过期
      })
    ).toString("base64");

    // 获取可用的免费主题
    const freeTopics = await ctx.db
      .query("freeTopicDetails")
      .withIndex("by_dyad", (q) => q.eq("dyadId", dyad._id))
      .collect();

    return {
      token,
      dyad: {
        id: dyad._id,
        alias: dyad.alias,
        childName: dyad.childName,
        childGender: dyad.childGender,
        parentType: dyad.parentType,
        locale: dyad.locale,
      },
      freeTopics: freeTopics.map((topic) => ({
        id: topic._id,
        subtopic: topic.subtopic,
        subtopicDescription: topic.subtopicDescription,
      })),
    };
  },
});

/**
 * 验证 Dyad token
 */
export const verifyDyadToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const decoded = JSON.parse(Buffer.from(args.token, "base64").toString());
      const dyad = await ctx.db.get(decoded.sub as any);

      if (!dyad) {
        throw new Error("Dyad not found");
      }

      return {
        valid: true,
        dyad: {
          id: dyad._id,
          alias: dyad.alias,
          childName: dyad.childName,
          childGender: dyad.childGender,
          parentType: dyad.parentType,
          locale: dyad.locale,
        },
      };
    } catch (error) {
      return { valid: false, dyad: null };
    }
  },
});

/**
 * 获取所有 Dyads (管理员)
 */
export const getAllDyads = query({
  args: {},
  handler: async (ctx) => {
    const dyads = await ctx.db.query("dyads").order("desc").collect();

    const dyadsWithCodes = await Promise.all(
      dyads.map(async (dyad) => {
        const loginCode = await ctx.db
          .query("dyadLoginCodes")
          .withIndex("by_dyad", (q) => q.eq("dyadId", dyad._id).eq("active", true))
          .first();

        return {
          ...dyad,
          passcode: loginCode?.code || null,
        };
      })
    );

    return dyadsWithCodes;
  },
});

/**
 * 更新 Dyad 信息
 */
export const updateDyad = mutation({
  args: {
    dyadId: v.id("dyads"),
    alias: v.optional(v.string()),
    childName: v.optional(v.string()),
    childGender: v.optional(v.union(v.literal("boy"), v.literal("girl"))),
    parentType: v.optional(v.union(v.literal("mother"), v.literal("father"))),
    locale: v.optional(v.union(v.literal("zh"), v.literal("yue"), v.literal("ko"), v.literal("en"))),
  },
  handler: async (ctx, args) => {
    const { dyadId, ...updates } = args;

    const dyad = await ctx.db.get(dyadId);
    if (!dyad) {
      throw new Error("Dyad not found");
    }

    await ctx.db.patch(dyadId, {
      ...updates,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(dyadId);
  },
});

/**
 * 删除 Dyad
 */
export const deleteDyad = mutation({
  args: {
    dyadId: v.id("dyads"),
  },
  handler: async (ctx, args) => {
    const dyad = await ctx.db.get(args.dyadId);
    if (!dyad) {
      throw new Error("Dyad not found");
    }

    // 删除 Dyad
    await ctx.db.delete(args.dyadId);

    // 删除相关的登录码
    const loginCodes = await ctx.db
      .query("dyadLoginCodes")
      .withIndex("by_dyad", (q) => q.eq("dyadId", args.dyadId))
      .collect();

    for (const code of loginCodes) {
      await ctx.db.delete(code._id);
    }

    // 删除相关的会话
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_dyad", (q) => q.eq("dyadId", args.dyadId))
      .collect();

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    // 删除相关的自定义卡片
    const customCards = await ctx.db
      .query("userDefinedCards")
      .withIndex("by_dyad", (q) => q.eq("dyadId", args.dyadId))
      .collect();

    for (const card of customCards) {
      await ctx.db.delete(card._id);
    }

    // 删除相关的免费主题
    const freeTopics = await ctx.db
      .query("freeTopicDetails")
      .withIndex("by_dyad", (q) => q.eq("dyadId", args.dyadId))
      .collect();

    for (const topic of freeTopics) {
      await ctx.db.delete(topic._id);
    }

    return { success: true };
  },
});

/**
 * 生成新的登录码
 */
export const generateNewLoginCode = mutation({
  args: {
    dyadId: v.id("dyads"),
  },
  handler: async (ctx, args) => {
    const dyad = await ctx.db.get(args.dyadId);
    if (!dyad) {
      throw new Error("Dyad not found");
    }

    // 使旧的登录码失效
    const oldCodes = await ctx.db
      .query("dyadLoginCodes")
      .withIndex("by_dyad", (q) => q.eq("dyadId", args.dyadId).eq("active", true))
      .collect();

    for (const code of oldCodes) {
      await ctx.db.patch(code._id, { active: false });
    }

    // 生成新的登录码
    const newCode = generateSixDigitCode();
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 天后过期

    await ctx.db.insert("dyadLoginCodes", {
      dyadId: args.dyadId,
      code: newCode,
      issuedAt: now,
      active: true,
      expiresAt,
    });

    return { code: newCode };
  },
});