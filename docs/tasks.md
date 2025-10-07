# PlanForge LG MVP Implementation Tasks

本タスクリストは PF-REQ/PF-NFR/PF-ARCH/PF-API/PF-UI/PF-DM/PF-SEC/PF-AUD 等のドキュメントを前提に、MVP 開発を段階的に進めるための詳細な実装方針を整理する。

## 1. プロジェクト基盤整備

- **環境セットアップ**: Monorepo 構成/言語選定（Backend: TypeScript or Go, Frontend: React+TypeScript）を確定し、Builder/Linter/Formatter/Testing フレームワークを定義。CI/CD の骨格（lint/test/build）を走らせる。
- **インフラ構成ベース**: docker-compose もしくは devcontainer を用意し、まずは PostgreSQL だけを安定稼働させる。MinIO や LLM スタブは要件が固まり次第、別 Compose ファイルやサービス追加として段階的に組み込む。
- **共通ライブラリ**: API レスポンス/エラーフォーマット、JSON Schema 検証ユーティリティ、RBAC/セッション管理の共通モジュールを準備。
- **全体方針**:
  - `pnpm` ワークスペース＋ `Turborepo` に frontend／backend／LLM-worker を束ね、PF-ARCH-001 2章のモジュール分割と PF-REQ-001 に沿った Monorepo 前提を満たす。
  - `docker-compose` は v1 では PostgreSQL サービスのみを対象にし、周辺（MinIO／LLM スタブ／メッセージキュー）は設計確定後に追加する。Cloudflare 環境との差分はリードミーで補足し、将来の compose 拡張を想定したファイル分割ルールを用意する。
  - `zod` スキーマを `@planforge/contracts` パッケージで共有し、Hono API／フロント／LLM 検証を一元化。`zod-to-json-schema` で JSON Schema を生成し、PF-AI-001 2.4 および PF-API-001 3.2 の統一エラー形式を実現する。
  - backend は Hono.js＋Prisma＋Auth.js(Core)＋Cloudflare KV セッションで構成し、監査記録は Prisma ミドルレイヤを経由して PF-AUD-001 5章の必須フィールドを自動付与する。
  - frontend は React 19＋Vite＋TanStack Query＋React Router で構成し、UI コンポーネントは Radix UI＋Tailwind を基盤に PF-UI-001 のアクセシビリティ要件とショートカット仕様を満たす。
  - LLM ワーカーは Node.js(TypeScript)＋`openai` ライブラリで JSON Schema 検証を `ajv` で行い、自己修復 1 回・監査ログ送出・Cloudflare Workers への将来移行を想定した抽象化を実装する。
  - CI/CD は GitHub Actions で lint/test/build/migrate/deploy を構成し、SAST（Semgrep）・DAST（OWASP ZAP）・依存更新（Renovate）・OpenAPI 契約テスト（Schemathesis）を組み込み PF-NFR-001／PF-QA-001／PF-SEC-001 の非機能要件をカバーする。

## 2. データ層（PF-DM-001 準拠）

- **スキーマ実装**: `users`, `projects`, `assumptions`, `assumption_sources`, `evidence`, `logic_nodes`, `framework_inputs`, `market_sizing`, `kpis`, `export_artifacts`, `audit_logs`, `questions`, `term_dictionary`, `patches` のテーブル DDL をマイグレーションで実装。外部キー・インデックス・CHECK 制約を反映。
- **シードデータ**: `term_dictionary` の初期辞書投入、RBAC ロールの初期設定、サンプルプロジェクトの作成スクリプト。
- **データアクセスレイヤ**: Repository パターンのインターフェースを作成し、トランザクション/並列処理に備えたユニットテストを準備。

## 3. 認証・認可・セキュリティ（PF-SEC-001／PF-NFR-001）

- **セッション/トークン実装**: Cookie セッション＋ Bearer トークン両対応。HttpOnly/SameSite=strict/Secure 属性を確認し、30 分タイムアウトを実装。
- **RBAC**: Project 単位の `owner/editor/viewer` 判定をミドルウェア化し、全 API がサーバ側認可チェックを通過するようにする。
- **レート制限・監査**: IP/ユーザー単位 60 req/min のレートリミット、監査ログに `actor_id` `action` `result` 等を記録する仕組み。
- **P0 コントロール**: 入力時マスキング／アップロード拒否のフック、エクスポート手前の P0 検査ジョブを設計。

## 4. API バックエンド（PF-API-001）

- **プロジェクト管理** (`POST/GET/PATCH /projects` ほか): Why データ、成功条件/制約/利害関係者 CRUD、検索 API。
- **追撃質問** (`GET`/`POST answer`): 質問生成結果を DB に保存し、回答を型に沿って検証するエンドポイント。
- **ロジックツリー** (`POST /logic/generate`, `POST /logic/inspect`, `GET /logic`): LLM ワーカー連携用キュー・同期処理、パッチ適用 API。
- **フレームワーク要旨** (`POST /framework/normalize`, `GET /framework`): 入力正規化と矛盾ログ返却。
- **市場規模試算** (`POST /market/sizing`): 数値レンジのバリデーション、感度分析ロジック実装。
- **プレビュー/エクスポート** (`POST /preview/synthesize`, `POST /export`): Markdown/Docx 生成、ブロック条件（P0/assumption/evidence/脚注）検査。
- **監査ログ** (`GET /audit`): ページング取得、フィルタ条件。
- **Assumption/Evidence API**: 多対多紐付けの CRUD (`POST /assumptions`, `POST/DELETE /assumptions/:aid/sources`, `POST /evidence`).
- **辞書 API** (`GET /dictionary`): 正規化辞書の参照。
- **共通エラー処理**: `VALIDATION_ERROR`, `SCHEMA_MISMATCH`, `EXPORT_BLOCKED` 等のレスポンス整備。

## 5. LLM ワーカー（PF-AI-001）

- **プロンプト実装**: Why 要約, 追撃質問生成, ロジック生成, MECE/矛盾検査, フレームワーク統合, 市場規模試算補助, 章立て叙述生成のプロンプト定義とテンプレート化。
- **JSON Schema 検証**: 生成結果を検証する Validator を実装。自己修復（再試行 1 回）フロー。
- **モデルメタ記録**: `model_id`, `prompt_id`, `tokens`, `latency` を監査ログへ送出するミドルレイヤ。
- **テストダブル**: ローカル開発用にスタブレスポンスを返すモックワーカーを用意。

## 6. フロントエンド SPA（PF-UI-001）

- **ルーティング**: G-01〜G-09 の React Router 設定。Project 概要 → 各機能画面への遷移を設計。
- **状態管理**: RTK Query などで API 呼び出しとキャッシュを統合。セッション情報と RBAC 表示制御。
- **UI 実装**:
  - Why ウィザード（入力検証、警告バッジ、AI 補完結果の表示）
  - 追撃質問キュー（形式別入力、blocking 表示）
  - ロジックツリー編集（ツリービュー＋検査タブ＋パッチ適用フロー）
  - フレームワーク入力タブ、矛盾ログサイドパネル
  - 市場規模試算（レンジ入力とトルネード図）
  - 出力プレビュー（章立て表示、未確定タグ、ブロックダイアログ）
  - 監査ログビュー（フィルタ＋詳細モーダル）
- **アクセシビリティ**: キーボード操作、WCAG AA を満たすラベル/コントラスト設定。
- **テスト**: Storybook/コンポーネントテスト＋主要フローの E2E（Why→ エクスポート）。

## 7. エクスポート/帳票（PF-EXP-001）

- **Markdown テンプレ**: `templates/export/default.md.tmpl` の構築、章立て・脚注・未確定タグを反映。
- **Docx 出力**: Pandoc もしくは同等ライブラリでの変換、Footnote とヘッダ/フッタ設定、文字化け対策。
- **図表生成**: Mermaid→SVG/PNG パイプライン。フォントフォールバック・文字切れチェック。
- **検査フロー**: assumption/evidence/P0/章番号/脚注整合の検証関数を実装。

## 8. 監査・ログ・運用（PF-AUD-001 / PF-OPS-001）

- **監査ログ保管**: Append-only ストレージへの書き込み層、`result`/`payload` フィールドの構造化。
- **メトリクス/アラート**: API latency p95, エラーレート, export_blocked_count の収集とダッシュボード連携。
- **運用 Runbook**: エクスポートブロック時の対応手順、権限変更ワークフロー、バックアップ/復旧手順のドキュメント化。

## 9. テスト戦略（PF-QA-001）

- **ユニット/統合テスト**: API ごとのバリデーションパス、LLM スタブを使った Happy/Sad パス。
- **E2E テスト**: G-03→G-08 の 30 分以内シナリオ、エクスポートブロック条件（P0/assumption/evidence/脚注）を網羅。
- **非機能テスト**: 性能（p95 目標）、レート制限、RBAC の負ケース確認、アクセシビリティ検査。

## 10. デリバリー/リリース

- **CI/CD 自動化**: main ブランチへのマージで lint/test/build を走らせ、Staging/Prod デプロイパイプラインを構築。
- **運用引き継ぎ**: 管理者向けガイド（権限付与、監査ログ閲覧、バックアップ復元）、利用者向けガイド（Why 入力〜エクスポートの手順）。
- **リリース判定**: PF-REQ/PF-NFR/PF-BIZ/PF-UC に記載の受け入れ基準チェックリストを作成し、すべての [ ] を完了状態にしてからリリース承認。
