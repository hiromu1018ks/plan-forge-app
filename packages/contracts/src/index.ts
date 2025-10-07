// このファイルは contracts パッケージのエントリーポイント
// 他のパッケージは `import { ... } from '@planforge/contracts'` で使用

// zodライブラリをインポート
import { z } from "zod";

// ========================================
// サンプルスキーマ定義
// ========================================

// ユーザースキーマの例
export const UserSchema = z.object({
  // ユーザーID（文字列型）
  id: z.string(),
  // メールアドレス（email形式のバリデーション付き）
  email: z.string().email(),
  // ユーザー名（3文字以上50文字以下）
  name: z.string().min(3).max(50),
  // 作成日時（Date型）
  createdAt: z.coerce.date(),
});

// TypeScript型をzodスキーマから自動生成
// z.infer<typeof Schema> でスキーマから型を抽出
// これにより、スキーマと型定義が常に一致する（Single Source of Truth）
export type User = z.infer<typeof UserSchema>;

// プロジェクトスキーマの例
export const ProjectSchema = z.object({
  id: z.string(),
  // 1文字以上100文字以下のプロジェクト名
  name: z.string().min(1).max(100),
  // オプショナルな説明文
  description: z.string().optional(),
  // プロジェクトオーナーのユーザーID
  ownerId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Project = z.infer<typeof ProjectSchema>;

// ========================================
// 将来的な拡張ポイント
// ========================================
// - API リクエスト/レスポンスのスキーマ
// - データベースモデルのスキーマ
// - LLM プロンプト/レスポンスのスキーマ
// - イベントペイロードのスキーマ
