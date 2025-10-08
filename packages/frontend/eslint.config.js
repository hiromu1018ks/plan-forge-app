import tsEsLint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginHooks from "eslint-plugin-react-hooks";
import pluginRefresh from "eslint-plugin-react-refresh";
import pluginJsxA11y from "eslint-plugin-jsx-a11y";
import pluginImport from "eslint-plugin-import";
import pluginSimpleImportSort from "eslint-plugin-simple-import-sort";
import pluginUnusedImports from "eslint-plugin-unused-imports";
import pluginJs from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import pluginJest from "eslint-plugin-jest";
import pluginStylistic from "@stylistic/eslint-plugin";
import configPrettier from "eslint-config-prettier";

// テスト用の設定
// Jest推奨ルールを適用し、テストファイル（*.test.ts, *.spec.tsxなど）に対して有効化
const testConfig = {
  ...pluginJest.configs["flat/recommended"],
  name: "Test Config",
  files: [
    "src/**/*.{test,spec}.{js,ts,jsx,tsx}",
    "src/**/__tests__/**/*.{js,ts,jsx,tsx}",
  ],
};

// スタイルガイド設定
// コードの可読性を高めるため、特定の箇所に空行を強制する
const stylisticConfig = {
  name: "Stylistic Config",
  files: ["src/**/*.{js,ts,jsx,tsx}"],
  plugins: { "@stylistic": pluginStylistic },
  rules: {
    "@stylistic/padding-line-between-statements": [
      "error",
      { blankLine: "always", prev: "*", next: "return" }, // return文の前に空行
      { blankLine: "always", prev: "*", next: ["function", "class"] }, // 関数・クラスの前に空行
      { blankLine: "always", prev: "*", next: ["if", "switch"] }, // 条件分岐の前に空行
      { blankLine: "always", prev: "directive", next: "*" }, // ディレクティブの前に空行
      { blankLine: "always", prev: "*", next: "directive" }, // ディレクティブ後に空行
      { blankLine: "never", prev: "directive", next: "directive" }, // ディレクティブ間は空行なし
    ],
  },
};

// インポート管理設定
// import文の順序を自動整列し、未使用のimportを検出
const importConfig = {
  name: "Import Config",
  files: ["src/**/*.{js,ts,jsx,tsx}"],
  plugins: {
    import: pluginImport,
    "simple-import-sort": pluginSimpleImportSort,
    "unused-imports": pluginUnusedImports,
  },
  settings: {
    ...pluginImport.configs.react.settings,
    ...pluginImport.configs.typescript.settings,
    "import/resolver": {
      ...pluginImport.configs.typescript.settings["import/resolver"],
      typescript: {
        alwaysTryTypes: true, // 型定義ファイル（.d.ts）を常に解決
      },
    },
  },
  rules: {
    ...pluginImport.configs.recommended.rules,
    ...pluginImport.configs.typescript.rules,
    // 画像ファイルのimportは無視（Viteが処理するため）
    "import/no-unresolved": ["error", { ignore: ["^/.+\\.(svg|png|jpg)$"] }],
    // ファイル拡張子を常に記述（ESMモジュール仕様に準拠）
    "import/extensions": [
      "error",
      "always",
      {
        js: "always",
        jsx: "always",
        ts: "always",
        tsx: "always",
        ignorePackages: true,
      },
    ],
    // Import順序の自動整列ルール
    // 1. React関連 → 2. Node.js組み込み → 3. 外部パッケージ → 4. 内部パッケージ → 5. 相対パス
    "simple-import-sort/imports": [
      "error",
      {
        groups: [
          ["^react(-dom)?", "^node:", "^@?\\w", "^@/.*", "^\\.+/(?!assets/)"],
          ["^.+\\.json$", "^.+\\.(svg|png|jpg)$", "^.+\\.s?css$"],
        ],
      },
    ],
    "simple-import-sort/exports": "error", // Export文も整列
    "import/first": "error", // Import文をファイルの最初に配置
    "import/newline-after-import": "error", // Import文の後に空行
    "import/no-duplicates": "error", // 重複したimportを禁止
    // 未使用変数の検出（TypeScript標準ルールを上書き）
    "@typescript-eslint/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error", // 未使用importを削除
    "unused-imports/no-unused-vars": [
      "warn",
      {
        args: "after-used", // 使用後の引数のみチェック
        argsIgnorePattern: "^_", // _で始まる引数は無視
        caughtErrorsIgnorePattern: "^_", // _で始まるエラー変数は無視
        destructuredArrayIgnorePattern: "^_", // 分割代入の_で始まる変数は無視
        vars: "all",
        varsIgnorePattern: "^_", // _で始まる変数は無視
      },
    ],
  },
};

// React設定
// React、React Hooks、アクセシビリティ（a11y）のルールを適用
const reactConfig = {
  name: "React Config",
  files: ["src/**/*.{js,ts,jsx,tsx}"],
  languageOptions: {
    ...pluginJsxA11y.flatConfigs.recommended.languageOptions,
  },
  settings: {
    react: { version: "detect" }, // Reactバージョンを自動検出
  },
  plugins: {
    react: pluginReact,
    "react-hooks": pluginHooks,
    "react-refresh": pluginRefresh,
    "jsx-a11y": pluginJsxA11y,
  },
  rules: {
    ...pluginReact.configs.flat.recommended.rules,
    ...pluginHooks.configs.recommended.rules,
    ...pluginRefresh.configs.recommended.rules,
    ...pluginJsxA11y.flatConfigs.recommended.rules,
    // React 17+では不要なimportを無効化
    "react/jsx-uses-react": "off",
    "react/react-in-jsx-scope": "off",
  },
};

// 全体の設定をエクスポート
export default defineConfig([
  // 対象ファイル
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"] },
  // 無視するファイル
  {
    ignores: [
      "{dist,build,public,node_modules}/**", // ビルド成果物と依存関係
      "**/lib/utils.{js,ts}", // shadcn/uiのユーティリティ
      "**/components/ui/**/*.{jsx,tsx}", // shadcn/uiのコンポーネント
      "**/*.config.*", // 設定ファイル自体
    ],
  },
  // 言語設定
  {
    languageOptions: {
      ecmaVersion: "latest", // 最新のECMAScript仕様
      globals: {
        ...globals.browser, // ブラウザのグローバル変数（window, documentなど）
        ...globals.es2024, // ES2024のグローバル変数
      },
      parserOptions: {
        project: ["tsconfig.json", "tsconfig.*.json"], // TypeScript設定ファイル
      },
    },
  },
  // 各種設定を適用
  pluginJs.configs.recommended, // JavaScript推奨ルール
  reactConfig, // React設定
  tsEsLint.configs.recommendedTypeChecked, // TypeScript型チェック推奨ルール
  tsEsLint.configs.stylistic, // TypeScriptスタイルルール
  importConfig, // Import管理設定
  stylisticConfig, // スタイルガイド設定
  testConfig, // テスト設定
  configPrettier, // Prettierとの競合を回避（最後に配置が重要）
]);
