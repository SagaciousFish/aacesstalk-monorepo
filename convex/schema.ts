import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// 定义枚举类型
const ParentType = v.union(
  v.literal("mother"),
  v.literal("father")
);

const ChildGender = v.union(
  v.literal("boy"),
  v.literal("girl")
);

const UserLocale = v.union(
  v.literal("zh"),  // Simplified Chinese
  v.literal("yue"), // Traditional Chinese
  v.literal("ko"),  // Korean
  v.literal("en")   // English
);

const CardCategory = v.union(
  v.literal("topic"),
  v.literal("emotion"),
  v.literal("action"),
  v.literal("core")
);

const TopicCategory = v.union(
  v.literal("plan"),
  v.literal("recall"),
  v.literal("free")
);

const SessionStatus = v.union(
  v.literal("initial"),
  v.literal("started"),
  v.literal("conversation"),
  v.literal("terminated")
);

const DialogueRole = v.union(
  v.literal("parent"),
  v.literal("child")
);

const ParentGuideCategory = v.union(
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
);

const ParentGuideType = v.union(
  v.literal("messaging"),
  v.literal("feedback")
);

export default defineSchema({
  // Dyads (用户账户 - 父母和孩子对)
  dyads: defineTable({
    alias: v.string(),
    childName: v.string(),
    childGender: ChildGender,
    parentType: ParentType,
    locale: UserLocale,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_alias", ["alias"])
    .index("by_created", ["createdAt"]),

  // Dyad Login Codes (6位数字登录码)
  dyadLoginCodes: defineTable({
    dyadId: v.id("dyads"),
    code: v.string(),
    issuedAt: v.number(),
    active: v.boolean(),
    expiresAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_dyad", ["dyadId"])
    .index("by_active", ["active"]),

  // Sessions (会话)
  sessions: defineTable({
    dyadId: v.id("dyads"),
    status: SessionStatus,
    topicCategory: TopicCategory,
    subtopic: v.optional(v.string()),
    subtopicDescription: v.optional(v.string()),
    localTimezone: v.string(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    numTurns: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_dyad", ["dyadId"])
    .index("by_status", ["status"])
    .index("by_started", ["startedAt"]),

  // Dialogue Turns (对话轮次)
  dialogueTurns: defineTable({
    sessionId: v.id("sessions"),
    role: DialogueRole,
    audioFilename: v.optional(v.string()),
    startedAt: v.number(),
    endedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_role", ["role"]),

  // Messages (消息)
  messages: defineTable({
    sessionId: v.id("sessions"),
    turnId: v.id("dialogueTurns"),
    role: DialogueRole,
    contentType: v.union(v.literal("text"), v.literal("json")),
    contentStr: v.optional(v.string()),
    contentStrLocalized: v.optional(v.string()),
    contentJson: v.optional(v.any()),
    timestamp: v.number(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_turn", ["turnId"])
    .index("by_role", ["role"]),

  // Child Card Recommendations (儿童卡片推荐结果)
  childCardRecommendations: defineTable({
    sessionId: v.id("sessions"),
    turnId: v.optional(v.id("dialogueTurns")),
    cards: v.array(
      v.object({
        id: v.string(),
        recommendationId: v.string(),
        label: v.string(),
        labelLocalized: v.string(),
        category: CardCategory,
      })
    ),
    timestamp: v.number(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_turn", ["turnId"]),

  // Interim Card Selections (临时卡片选择)
  interimCardSelections: defineTable({
    sessionId: v.id("sessions"),
    turnId: v.id("dialogueTurns"),
    cards: v.array(
      v.object({
        id: v.string(),
        recommendationId: v.string(),
        label: v.string(),
        labelLocalized: v.string(),
        category: CardCategory,
      })
    ),
    timestamp: v.number(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_turn", ["turnId"]),

  // Parent Guide Recommendations (家长引导推荐结果)
  parentGuideRecommendations: defineTable({
    sessionId: v.id("sessions"),
    turnId: v.optional(v.id("dialogueTurns")),
    guides: v.array(
      v.object({
        id: v.string(),
        category: v.union(
          ParentGuideCategory,
          v.array(v.union(
            v.literal("blame"),
            v.literal("correction"),
            v.literal("complex"),
            v.literal("deviation")
          ))
        ),
        guide: v.string(),
        guideLocalized: v.optional(v.string()),
        type: ParentGuideType,
      })
    ),
    timestamp: v.number(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_turn", ["turnId"]),

  // Parent Example Messages (家长示例消息)
  parentExampleMessages: defineTable({
    sessionId: v.id("sessions"),
    recommendationId: v.id("childCardRecommendations"),
    guideId: v.string(),
    message: v.string(),
    messageLocalized: v.optional(v.string()),
    timestamp: v.number(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_recommendation", ["recommendationId"])
    .index("by_guide", ["guideId"]),

  // Interactions (用户交互追踪)
  interactions: defineTable({
    sessionId: v.id("sessions"),
    type: v.string(),
    turnId: v.optional(v.id("dialogueTurns")),
    metadataJson: v.optional(v.any()),
    timestamp: v.number(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_type", ["type"]),

  // User Defined Cards (用户自定义卡片)
  userDefinedCards: defineTable({
    dyadId: v.id("dyads"),
    label: v.optional(v.string()),
    labelLocalized: v.string(),
    category: CardCategory,
    imageFilename: v.optional(v.string()),
    imageWidth: v.optional(v.number()),
    imageHeight: v.optional(v.number()),
    timestamp: v.number(),
    createdAt: v.number(),
  })
    .index("by_dyad", ["dyadId"])
    .index("by_category", ["category"]),

  // Free Topic Details (自定义对话主题)
  freeTopicDetails: defineTable({
    dyadId: v.id("dyads"),
    subtopic: v.string(),
    subtopicDescription: v.string(),
    topicImageFilename: v.optional(v.string()),
    timestamp: v.number(),
    createdAt: v.number(),
  })
    .index("by_dyad", ["dyadId"]),

  // Cards (卡片数据 - 用于向量搜索)
  cards: defineTable({
    id: v.string(),
    label: v.string(),
    labelLocalized: v.record(UserLocale, v.string()),
    category: CardCategory,
    imageUrl: v.string(),
    embedding: v.array(v.float64()),
    createdAt: v.number(),
  })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1024,
      filterFields: ["category"],
    })
    .index("by_category", ["category"])
    .index("by_id", ["id"]),

  // Admin Users (管理员用户)
  adminUsers: defineTable({
    username: v.string(),
    hashedPassword: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_username", ["username"]),
});