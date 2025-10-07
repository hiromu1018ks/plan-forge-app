import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { zValidator } from "@hono/zod-validator";
import { UserSchema } from "@planforge/contracts";
import { z } from "zod";

const app = new Hono();

// ========================================
// ルート定義
// ========================================

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.post("/users", zValidator("json", UserSchema), (c) => {
  const user = c.req.valid("json");

  return c.json(
    {
      success: true,
      user,
    },
    201 // ← ステータスコードはここ
  );
});

const QuerySchema = z.object({
  name: z.string().min(1), // ← min(1) に修正（1文字以上）
});

app.get("/hello", zValidator("query", QuerySchema), (c) => {
  const { name } = c.req.valid("query");
  return c.json({
    message: `Hello, ${name}!`,
  });
});

// ========================================
// サーバー起動
// ========================================
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`🚀 Server starting on http://localhost:${port}`);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`✅ Listening on http://localhost:${info.port}`);
  }
);
