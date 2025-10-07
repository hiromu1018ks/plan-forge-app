import { defineConfig } from "tsup";

export default defineConfig({
  // エントリーポイント: このファイルからビルド開始
  entry: ["src/index.ts"],
  // 出力形式: ES Modules（最新の標準形式）
  format: ["esm"],
  // TypeScript型定義ファイル(.d.ts)を自動生成
  dts: true,
  // ソースマップを生成（デバッグ時にオリジナルのコード位置を表示）
  sourcemap: true,
  // ビルド前にdistディレクトリを削除（古いファイルを残さない）
  clean: true,
  // 依存関係は外部化（バンドルせず、使用側でインストール）
  external: ["zod", "zod-to-json-schema"],
});
