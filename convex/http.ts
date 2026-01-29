import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// ============================================
// Dyad API
// ============================================

// POST /api/v1/dyad/account/login - Dyad 登录
http.route({
  path: "/api/v1/dyad/account/login",
  method: "POST",
  handler: httpAction(async ({ runMutation }, request) => {
    const { code } = await request.json();

    const result = await runMutation("auth:loginDyad", { code });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// POST /api/v1/dyad/session/new - 创建新会话
http.route({
  path: "/api/v1/dyad/session/new",
  method: "POST",
  handler: httpAction(async ({ runMutation }, request) => {
    const { topic, timezone } = await request.json();

    // 从请求头获取 token
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 验证 token 并获取 dyadId
    const token = authHeader.replace("Bearer ", "");
    const verification = await runMutation("auth:verifyDyadToken", { token });

    if (!verification.valid) {
      return new Response("Invalid token", { status: 401 });
    }

    const sessionId = await runMutation("sessions:createSession", {
      dyadId: verification.dyad!.id,
      topicCategory: topic.category,
      subtopic: topic.subtopic,
      subtopicDescription: topic.subdescription,
      localTimezone: timezone,
    });

    return new Response(JSON.stringify(sessionId), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// POST /api/v1/dyad/session/:sessionId/start - 开始会话
http.route({
  path: "/api/v1/dyad/session/:sessionId/start",
  method: "POST",
  handler: httpAction(async ({ runMutation }, request) => {
    const { sessionId } = request.params;

    const result = await runMutation("sessions:startSession", {
      sessionId: sessionId as any,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// PUT /api/v1/dyad/session/:sessionId/end - 结束会话
http.route({
  path: "/api/v1/dyad/session/:sessionId/end",
  method: "PUT",
  handler: httpAction(async ({ runMutation }, request) => {
    const { sessionId } = request.params;

    const result = await runMutation("sessions:endSession", {
      sessionId: sessionId as any,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// DELETE /api/v1/dyad/session/:sessionId/abort - 中止会话
http.route({
  path: "/api/v1/dyad/session/:sessionId/abort",
  method: "DELETE",
  handler: httpAction(async ({ runMutation }, request) => {
    const { sessionId } = request.params;

    await runMutation("sessions:abortSession", {
      sessionId: sessionId as any,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// GET /api/v1/dyad/session/list - 获取所有已终止的会话
http.route({
  path: "/api/v1/dyad/session/list",
  method: "GET",
  handler: httpAction(async ({ runMutation, runQuery }, request) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const verification = await runMutation("auth:verifyDyadToken", { token });

    if (!verification.valid) {
      return new Response("Invalid token", { status: 401 });
    }

    const sessions = await runMutation("sessions:getTerminatedSessions", {
      dyadId: verification.dyad!.id,
    });

    return new Response(JSON.stringify(sessions), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// GET /api/v1/dyad/session/:sessionId/info - 获取会话信息
http.route({
  path: "/api/v1/dyad/session/:sessionId/info",
  method: "GET",
  handler: httpAction(async ({ runQuery }, request) => {
    const { sessionId } = request.params;

    const session = await runQuery("sessions:getSessionInfo", {
      sessionId: sessionId as any,
    });

    return new Response(JSON.stringify(session), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// GET /api/v1/dyad/session/:sessionId/message/all - 获取完整对话
http.route({
  path: "/api/v1/dyad/session/:sessionId/message/all",
  method: "GET",
  handler: httpAction(async ({ runQuery }, request) => {
    const { sessionId } = request.params;

    const dialogue = await runQuery("sessions:getFullDialogue", {
      sessionId: sessionId as any,
    });

    return new Response(JSON.stringify(dialogue), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// POST /api/v1/dyad/session/:sessionId/message/parent/message/text - 添加家长文本消息
http.route({
  path: "/api/v1/dyad/session/:sessionId/message/parent/message/text",
  method: "POST",
  handler: httpAction(async ({ runMutation }, request) => {
    const { sessionId } = request.params;
    const { message } = await request.json();

    const result = await runMutation("sessions:addParentTextMessage", {
      sessionId: sessionId as any,
      message,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// POST /api/v1/dyad/session/:sessionId/message/child/add_card - 添加儿童卡片
http.route({
  path: "/api/v1/dyad/session/:sessionId/message/child/add_card",
  method: "POST",
  handler: httpAction(async ({ runMutation }, request) => {
    const { sessionId } = request.params;
    const { id, recommendation_id } = await request.json();

    await runMutation("sessions:addChildCard", {
      sessionId: sessionId as any,
      cardId: id,
      recommendationId: recommendation_id,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// PUT /api/v1/dyad/session/:sessionId/message/child/pop_last_card - 移除最后一个卡片
http.route({
  path: "/api/v1/dyad/session/:sessionId/message/child/pop_last_card",
  method: "PUT",
  handler: httpAction(async ({ runMutation }, request) => {
    const { sessionId } = request.params;

    await runMutation("sessions:removeLastChildCard", {
      sessionId: sessionId as any,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// POST /api/v1/dyad/session/:sessionId/message/child/confirm_cards - 确认卡片选择
http.route({
  path: "/api/v1/dyad/session/:sessionId/message/child/confirm_cards",
  method: "POST",
  handler: httpAction(async ({ runMutation }, request) => {
    const { sessionId } = request.params;

    const result = await runMutation("sessions:confirmChildCards", {
      sessionId: sessionId as any,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// PUT /api/v1/dyad/session/:sessionId/message/child/refresh_cards - 刷新卡片推荐
http.route({
  path: "/api/v1/dyad/session/:sessionId/message/child/refresh_cards",
  method: "PUT",
  handler: httpAction(async ({ runMutation }, request) => {
    const { sessionId } = request.params;

    const result = await runMutation("sessions:refreshCards", {
      sessionId: sessionId as any,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// ============================================
// Health Check
// ============================================

// HEAD /api/v1/ping - 健康检查
http.route({
  path: "/api/v1/ping",
  method: "HEAD",
  handler: httpAction(async () => {
    return new Response(null, { status: 204 });
  }),
});

// ============================================
// Vector Search API
// ============================================

// GET /api/v1/dyad/data/cards - 获取所有卡片
http.route({
  path: "/api/v1/dyad/data/cards",
  method: "GET",
  handler: httpAction(async ({ runQuery }, request) => {
    const category = request.nextUrl.searchParams.get("category");

    const cards = await runQuery("vectorSearch:getAllCards", {
      category: category as any,
    });

    return new Response(JSON.stringify(cards), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// POST /api/v1/dyad/cards/search - 向量搜索卡片
http.route({
  path: "/api/v1/dyad/cards/search",
  method: "POST",
  handler: httpAction(async ({ runAction }, request) => {
    const { query, category, limit } = await request.json();

    const results = await runAction("vectorSearch:searchCardsByVector", {
      query,
      category,
      limit,
    });

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// POST /api/v1/dyad/cards/similar - 获取相似卡片
http.route({
  path: "/api/v1/dyad/cards/similar",
  method: "POST",
  handler: httpAction(async ({ runAction }, request) => {
    const { cardId, limit } = await request.json();

    const results = await runAction("vectorSearch:getSimilarCards", {
      cardId,
      limit,
    });

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// POST /api/v1/dyad/cards/initialize - 初始化卡片数据
http.route({
  path: "/api/v1/dyad/cards/initialize",
  method: "POST",
  handler: httpAction(async ({ runAction }, request) => {
    const result = await runAction("vectorSearch:initializeCards", {});

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// GET /api/v1/dyad/cards/stats - 获取卡片统计信息
http.route({
  path: "/api/v1/dyad/cards/stats",
  method: "GET",
  handler: httpAction(async ({ runQuery }, request) => {
    const stats = await runQuery("vectorSearch:getCardStats", {});

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;