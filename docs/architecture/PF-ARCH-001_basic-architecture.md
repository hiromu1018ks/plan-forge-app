# 基本設計書（アーキテクチャ）— PlanForge LG（MVP）

- 文書番号: PF-ARCH-001
- 版数: v0.1
- 作成日: 2025-10-03
- 関連: PF-REQ-001, PF-NFR-001, PF-DM-001, PF-API-001, PF-SEC-001, PF-AUD-001, PF-UI-001

------

## 1. 目的・範囲

MVPのシステム構成、モジュール分割、データフロー、エラーハンドリング、設定・運用項目を定義する。将来拡張を阻害しない最小構成に限定。

------

## 2. 全体構成（論理図・テキスト）

```
[Browser SPA]
  ├─ UI (React) / Router / State管理
  ├─ Auth (Cookie/Bearer)
  └─ Telemetry (前段計測)

[API Gateway/Backend]
  ├─ Auth & RBAC
  ├─ Project/Why/Question
  ├─ Logic (generate/inspect)
  ├─ Framework (normalize)
  ├─ Market (sizing)
  ├─ Export (md/docx, Mermaid→SVG)
  ├─ Dictionary
  ├─ Audit (append-only)
  └─ P0検知・エクスポートブロック

[LLM Worker]
  ├─ Prompt Runner（JSON Schema検証）
  ├─ Self-repair（1回）
  └─ 出力マッパー（用語正規化）

[DB: PostgreSQL]
  ├─ Core（projects, logic_nodes, …）
  └─ Audit（append-only）

[Object Storage]
  ├─ export_artifacts（md/docx/svg/png）
  └─ audit_artifacts（必要時）

[Job/Queue]
  └─ 非同期ジョブ（長時間エクスポート）

[Observability]
  ├─ 構造化ログ
  ├─ メトリクス
  └─ アラート

[CI/CD]
  └─ lint/test/build/migrate/deploy
```

------

## 3. モジュール分割

### 3.1 フロントエンド（SPA）

- 技術想定: React + TypeScript。状態管理は軽量（例: RTK Query/React Query）。
- 主なコンポーネント
  - Layout, ProjectList, ProjectOverview, WhyWizard, QuestionQueue
  - LogicTreeEditor, FrameworkForm, MarketSizing, Preview, AuditView
- 入力検証: HTML5＋スキーマベース。比率は0〜1の範囲チェック。

### 3.2 バックエンド（API）

- 技術想定: 型安全なWebフレームワーク（TypeScript/Goあたり）。
- レイヤ
  - Router/Controller → Service → Repository → DB
  - Domain ModelはPF-DM-001準拠。
- ポリシー
  - すべての生成・検査・出力で監査ログを記録。
  - 出力前にP0/assumption/evidence/脚注連番チェック。

### 3.3 LLM Worker

- 役割: AI呼び出しの隔離、タイムアウト、JSON Schema検証、自己修復再試行（1回）。
- インターフェース: Backendから非同期呼び出し（同期でもよいが将来非同期化前提）。
- 出力は常にJSON。自然文はフィールド値（`summary_md`など）に格納。

### 3.4 バッチ・ジョブ

- エクスポート大型処理、辞書適用チェック、データ品質バッチ（孤立ノード、未紐付前提検出）。

------

## 4. データフロー（主要ユースケース）

### 4.1 Why→ロジック→検査→出力（ハッピーパス）

1. `POST /projects` 作成
2. `PATCH /projects/:id` でWhy入力
3. `GET /projects/:id/questions` で不足検知、回答
4. `POST /logic/generate` → LLM Worker → JSON Schema検証 → `logic_nodes`保存 → `audit_logs`記録
5. `POST /logic/inspect` → 検査結果・パッチ候補を返却 → 適用で差分保存
6. `POST /framework/normalize` → 1ページ要旨生成
7. `POST /market/sizing` → SOM/感度計算 → 保存
8. `POST /export` → ブロック検査 → md/docx生成 → Object Storage保存 → 監査記録

### 4.2 ブロック発生時（例: P0）

- エクスポート前検査でP0検知 → `result=blocked`で監査記録 → UIに対象箇所を返却 → 修正後再試行。

------

## 5. エラーハンドリング・再試行

| 位置     | 代表エラー              | 振る舞い                                   |
| -------- | ----------------------- | ------------------------------------------ |
| フロント | 入力検証NG              | フィールド直下とページ上部に簡潔表示       |
| API      | 400/422/409             | 統一エラーフォーマットで返却。409は版競合  |
| LLM      | タイムアウト/JSON不整合 | 再試行1回（自己修復）。以降は422＋監査退避 |
| Export   | ブロック条件            | 200系は返さず、`EXPORT_BLOCKED`を返却      |

- すべての失敗は`audit_logs`に保存（`result=error|blocked`）。

------

## 6. 設定・機能フラグ

### 6.1 設定（環境変数例）

```
APP_ENV=prod|stg|dev
DB_URL=...
OBJECT_STORE_BUCKET=...
LLM_ENDPOINT=...
EXPORT_SIGNED_URL_TTL=900
RATE_LIMIT_PER_MIN=60
SESSION_TIMEOUT_MIN=30
```

### 6.2 機能フラグ（将来拡張）

- `feat.pptx_export`（既定off）
- `feat.external_share`（既定off）
- `feat.async_export`（MVPはoffでも可）

------

## 7. デプロイ構成（MVP）

- 単一リージョン、単一AZでも可（NFRに準拠）。
- コンポーネント
  - Web/App: コンテナ2台（ローリングデプロイ）
  - DB: マネージドPostgreSQL（自動バックアップ有効）
  - Object Storage: バージョニング有効
  - Queue: 軽量メッセージング（将来）
- ネットワーク
  - 公開: Web/App
  - 非公開: DB/Storage
  - TLS終端はロードバランサ。

------

## 8. 監視・可観測性

### 8.1 ログ

- JSON構造化。`trace_id`, `actor_id`, `project_id`, `action`, `latency_ms`。
- 生成APIは入力/出力のハッシュも出力。

### 8.2 メトリクス

- p95応答時間（画面/API別）、生成・検査・統合・試算・エクスポートのレイテンシ。
- エクスポートブロック件数、422率、LLM再試行率。

### 8.3 アラート

- 主要API p95二倍閾値、エラー率>2％、レート制限多発、DB接続失敗増。

------

## 9. セキュリティ要点（実装寄り）

- 認可はサーバ側で毎リクエスト評価。フロントの制御に依存しない。
- 署名付きURLは短期。発行時に`audit_logs`へ記録。
- XSS/CSRF対策: SPAはCookie利用時にSameSite=strict、APIはCSRFトークン。
- 入力サニタイズはサーバ側。Markdown→docxはテンプレ固定＋エスケープ。

------

## 10. マイグレーション・データ初期化

- マイグレーションは連番SQL。起動時に適用。
- 初期データ: `term_dictionary`の種データ投入。
- 監査ログはスキーマ互換を最優先（列の追加は許可、削除は非推奨）。

------

## 11. 性能設計の勘所

- 生成・検査は同期呼び出しでもp95を守れる負荷でMVP運用。必要なら将来ジョブ化。
- ロジックツリーやプレビューは差分再計算を基本にし、全量ビルドを避ける。
- 用語正規化は一括ではなく保存時適用。

------

## 12. バックアップ・DR

- DB: 日次スナップショット（保持7日）。
- Object Storage: バージョニング。誤削除は復元手順で対応。
- RPO≤24h, RTO≤8h（NFR準拠）。

------

## 13. 変更管理

- 仕様変更は文書番号で追跡（本文書はPF-ARCH-001）。
- API破壊的変更はエンドポイントのバージョン切り替えで吸収。
- プロンプト変更は`prompt_id`のリビジョンを上げ、監査に残す。

------

## 14. リスクと対応（設計観点）

| リスク           | 内容                 | 対応                           |
| ---------------- | -------------------- | ------------------------------ |
| LLM出力揺らぎ    | JSON不整合・用語揺れ | Schema検証・自己修復・辞書強制 |
| 監査ログ肥大     | ストレージ圧迫       | 要約＋圧縮＋ローテーション     |
| エクスポート崩れ | 変換差異             | テンプレ固定・ゴールデン比較   |
| P0混入           | 入力・出力での漏れ   | 入力禁止/検知/ブロックの三重化 |

------

## 15. 今後の拡張ポイント

- PPTXエクスポート、KPIツリー、外部データ連携（統計API等）
- Worker非同期化、キュー導入、水平スケール
- 組織内SSO、2要素認証

------

## 16. 変更履歴

- v0.1（2025-10-03）初稿