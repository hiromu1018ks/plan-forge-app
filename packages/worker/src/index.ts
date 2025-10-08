// OpenAI クライアントをインポート
// 共通スキーマをインポート
import { UserSchema } from "@planforge/contracts";
import OpenAI from "openai";

// ========================================
// OpenAI クライアントの初期化
// ========================================

const openai = new OpenAI({
  // 環境変数からAPIキーを取得
  // 本番環境では必ず環境変数に設定すること
  apiKey: process.env.OPENAI_API_KEY || "dummy-key-for-development",
});

// ========================================
// サンプル関数: LLMを使った処理
// ========================================
async function processWithLLM(prompt: string): Promise<string> {
  try {
    // Chat Completions API を呼び出し
    const completion = await openai.chat.completions.create({
      // 使用するモデル（gpt-4o は最新の高性能モデル）
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // レスポンスから結果を取得
    const result = completion.choices[0]?.message?.content || "";

    return result;
  } catch (error) {
    console.error("❌ LLM processing error:", error);
    throw error;
  }
}

// ========================================
// サンプル関数: スキーマバリデーション
// ========================================
function validateUserData(data: unknown) {
  try {
    // Zodスキーマでデータを検証
    // contracts パッケージのスキーマを使用
    const validatedUser = UserSchema.parse(data);
    console.log("✅ Validation successful:", validatedUser);

    return validatedUser;
  } catch (error) {
    console.error("❌ Validation failed:", error);
    throw error;
  }
}

// ========================================
// 開発用のサンプル実行
// ========================================
console.log("🤖 LLM Worker initialized");
console.log("📦 Using schemas from @planforge/contracts");

// サンプルバリデーション
const testData = {
  id: "123",
  email: "worker@example.com",
  name: "LLM Worker",
  createdAt: new Date(),
};

validateUserData(testData);

// エクスポート（他のモジュールから使用可能にする）
export { processWithLLM, validateUserData };
