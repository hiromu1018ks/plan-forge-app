# 監査ログ仕様（Auditor-Trail）— PlanForge LG（MVP）

- 文書番号: PF-AUD-001
- 版数: v0.1
- 作成日: 2025-10-03
- 関連: PF-REQ-001, PF-NFR-001, PF-API-001, PF-DM-001, PF-SEC-001

------

## 1. 目的

生成系・検査系・出力系を含む重要操作の追跡性を担保し、説明責任とインシデント対応を可能にする。

------

## 2. 対象イベント

- 生成系: ロジック生成、フレームワーク統合、章立て叙述生成（プレビュー）、試算計算
- 検査系: MECE/重複/飛躍/矛盾検査、パッチ適用
- 入出力: Why保存、質問回答、用語辞書適用、エクスポート（md/docx）
- 権限: メンバー追加/削除、役割変更
- セキュリティ: ログイン/ログアウト、レート制限発火
- システム: マイグレーション、辞書更新、設定変更

------

## 3. データモデル（論理）

- テーブル: `audit_logs`（PF-DM-001準拠、追記専用）
- 主なカラム
  - `id` bigint, `timestamp` timestamptz
  - `actor_id` uuid, `project_id` uuid, `action` text
  - `model_id` text, `prompt_id` text（AI時）
  - `input_hash` text, `output_hash` text, `tokens_in/out` int, `latency_ms` int
  - `payload` jsonb（要約・差分・失敗理由など）
  - `result` text enum: `success|blocked|error`

付随ストア（任意採用）

- `audit_artifacts` オブジェクト保存（大きな要約やレポート断片の格納先キー）

------

## 4. ログ記録ポリシー

- 記録は**成功・失敗を問わず**必須。ブロック理由も保存
- 入力・出力の原文は保存しない。**要約とハッシュ**で代替
- 相関ID（`trace_id`）をAPI層で採番し全ログに付与
- 時系列一貫性: サーバ側でUTC保存、表示時にJST

------

## 5. アクション定義（コードと必須フィールド）

| action                      | 説明               | 追加必須                                      |
| --------------------------- | ------------------ | --------------------------------------------- |
| `generate_logic`            | ロジックツリー生成 | `model_id,prompt_id,tokens_in/out,latency_ms` |
| `inspect_logic`             | 検査実行           | `payload.issues_count`                        |
| `apply_patch`               | パッチ適用         | `payload.patch_ops[]`                         |
| `normalize_framework`       | 要点統合           | `model_id,prompt_id`                          |
| `market_sizing`             | 試算               | `payload.inputs_hash`                         |
| `preview_synthesize`        | プレビュー叙述生成 | `model_id,prompt_id,latency_ms,sections_count`|
| `export_md` / `export_docx` | エクスポート       | `payload.sections[],output_hash`              |
| `save_why`                  | Why保存            | `payload.fields[]`                            |
| `answer_question`           | 質問回答           | `payload.question_id,status`                  |
| `update_membership`         | 権限変更           | `payload.user_id,old_role,new_role`           |
| `login` / `logout`          | 認証               | `payload.ip`                                  |
| `rate_limited`              | レート制限         | `payload.key(limit,window)`                   |

------

## 6. 監査用差分仕様

- テキスト差分は行単位のunified diffを要約して格納（5行前後）
- 図・バイナリはハッシュのみ（`sha256`）
- パッチ適用は操作リスト（例）
  - `{"op":"merge","from":"L2_B2","to":"L2_A1"}`
  - `{"op":"add","node_id":"L3_C1","parent":"L2_C"}`

------

## 7. ブロック条件とログ要件

- P0残存: `result=blocked`、`payload.reason="P0_detected", payload.locations[]`
- 出典/前提欠落: `result=blocked`, `payload.missing=["assumption","evidence"]` （要出典状態の残存）
- スキーマ不整合: `result=error`, `payload.error="SCHEMA_MISMATCH"`

------

## 8. 可観測性メトリクス（集計）

- `logic_generate_latency_p95`, `inspect_error_rate`, `export_blocked_count`
- `tokens_in_total/day`, `tokens_out_total/day`
- `rate_limited_events/day`, `role_change_events/day`

------

## 9. アクセス制御

- 閲覧: 監査/情報政策ロールのみ。プロジェクトOwnerは自案件のみ閲覧可
- エクスポート: 監査ログの外部出力は禁止（内部監査用CSVは可）

------

## 10. API（監査ビュー）

- `GET /projects/:id/audit?limit=&cursor=&action=&actor=&from=&to=`
  - 応答: `items[], next_cursor`
- `GET /audit/:id` 詳細（payload全体、関連オブジェクトキー）

------

## 11. 保持・ライフサイクル

- 保持年限は規程に従い設定（既定未確定）。削除は匿名化で代替
- ログ圧縮: 30日超は圧縮、365日超は概要のみ保持（要件に応じ設定）

------

## 12. テスト観点

- 重要操作の全てでログが1件以上生成される
- ブロック条件で`result=blocked`となり理由・箇所が特定可能
- 相関IDで任意のエクスポートから上流の生成・検査へ辿れる
- 負荷時（p95二倍閾値）にアラートが発火し、ログで根因追跡可能

------

## 13. 運用手順（抜粋）

- 月次でロール変更イベントの棚卸を実施
- 監査ログからの抽出レポートを自動生成（主要KPI、ブロック件数）
- インシデント時は相関IDで範囲抽出→要約を関係部署へ共有

------

## 14. 変更履歴

- v0.1（2025-10-03）初稿
