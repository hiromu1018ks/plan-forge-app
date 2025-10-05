# API仕様書 — PlanForge LG（MVP）

- 文書番号: PF-API-001
- 版数: v0.1
- 作成日: 2025-10-03
- 関連: PF-REQ-001, PF-NFR-001, PF-BIZ-001, PF-UC-001, PF-DM-001

------

## 1. 概要

MVPに必要なサーバAPIの仕様。REST/JSON。認証必須。全応答は`application/json; charset=utf-8`（エクスポートのみバイナリ可）。

- ベースURL例: `/api`
- バージョン付与: パスで管理（MVPは固定）
- タイムゾーン: JST（DBはUTC）

------

## 2. 認証・認可

- 認証: セッショントークン（Cookie）またはBearerトークン（Header: `Authorization: Bearer <token>`）
- 認可: プロジェクト単位RBAC（owner/editor/viewer）
  - `owner`: すべて
  - `editor`: 読み取り＋編集＋生成
  - `viewer`: 読み取りのみ（エクスポート不可）

------

## 3. 共通仕様

### 3.1 ステータスコード

- 200/201: 成功
- 400: 入力不正（バリデーション）
- 401/403: 未認証/権限不足
- 404: 対象なし
- 409: 競合（重複、版不一致）
- 422: スキーマ不整合（LLM出力不適合等）
- 429: レート制限
- 500: サーバエラー

### 3.2 エラー形式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "field 'title' is required",
    "details": [{"field":"title","rule":"required"}],
    "trace_id": "a1b2c3"
  }
}
```

### 3.3 ページング

- `?limit=<int>&cursor=<opaque>`。応答に`next_cursor`を含む。

### 3.4 監査

- 生成/検査/エクスポートなど主要操作は監査ログに自動記録。

------

## 4. エンドポイント一覧（MVP）

| 分類                | メソッド/パス                              | 概要              |
| ------------------- | ------------------------------------------ | ----------------- |
| Projects            | `POST /projects`                           | プロジェクト作成  |
|                     | `GET /projects?query=`                     | プロジェクト検索  |
|                     | `GET /projects/:id`                        | 取得              |
|                     | `PATCH /projects/:id`                      | 更新              |
|                     | `POST /projects/:id/why/success-criteria`  | 成功条件追加      |
|                     | `PATCH /projects/:id/why/success-criteria/:cid` | 成功条件更新 |
|                     | `DELETE /projects/:id/why/success-criteria/:cid` | 成功条件削除 |
|                     | `POST /projects/:id/why/constraints`       | 制約追加          |
|                     | `PATCH /projects/:id/why/constraints/:constraint_id` | 制約更新 |
|                     | `DELETE /projects/:id/why/constraints/:constraint_id` | 制約削除 |
|                     | `POST /projects/:id/why/stakeholders`      | 利害関係者追加    |
|                     | `PATCH /projects/:id/why/stakeholders/:stakeholder_id` | 利害関係者更新 |
|                     | `DELETE /projects/:id/why/stakeholders/:stakeholder_id` | 利害関係者削除 |
| Questions           | `GET /projects/:id/questions`              | 追撃質問一覧      |
|                     | `POST /projects/:id/questions/:qid/answer` | 回答              |
| Logic               | `POST /projects/:id/logic/generate`        | ツリー生成        |
|                     | `GET /projects/:id/logic`                  | ロジックツリー取得|
|                     | `POST /projects/:id/logic/inspect`         | MECE/矛盾検査     |
| Framework           | `POST /projects/:id/framework/normalize`   | 1ページ要旨生成   |
|                     | `GET /projects/:id/framework`              | 正規化済み入力取得|
| Market              | `POST /projects/:id/market/sizing`         | TAM/SAM/SOM・感度 |
|                     | `GET /projects/:id/market`                 | 試算結果取得      |
| Preview             | `POST /projects/:id/preview/synthesize`    | 章立て叙述生成    |
| Export              | `POST /projects/:id/export`                | md/docx出力       |
| Audit               | `GET /projects/:id/audit`                  | 監査ログ一覧      |
| Dictionary          | `GET /dictionary?domain=`                  | 用語辞書参照      |
| Assumption/Evidence | `POST /projects/:id/assumptions`           | 前提登録          |
|                     | `POST /projects/:id/evidence`              | 出典登録          |
|                     | `POST /projects/:id/assumptions/:aid/sources` | 前提に出典を紐付け |
|                     | `DELETE /projects/:id/assumptions/:aid/sources/:eid` | 前提から出典を削除 |
|                     | `GET /projects/:id/assumptions/:aid`       | 前提詳細取得（紐付きEvidence含む） |

以降、主要APIの詳細。

------

## 5. Projects

### 5.1 POST `/projects`

プロジェクト新規作成。

**Request**

```json
{
  "title": "旧○○中活用計画",
  "region_code": "46214",
  "category": "idle_asset"  // enum
}
```

**Response 201**

```json
{
  "id": "uuid",
  "title": "旧○○中活用計画",
  "region_code": "46214",
  "category": "idle_asset",
  "created_at": "2025-10-03T05:00:00Z"
}
```

**Errors**: `VALIDATION_ERROR`

------

### 5.2 GET `/projects?query=&limit=&cursor=`

簡易検索。`query`はタイトル前方一致。

**Response 200**

```json
{ "items": [{ "id":"uuid","title":"..." }], "next_cursor": null }
```

------

### 5.3 GET `/projects/:id`

**Response 200**

```json
{
  "id":"uuid",
  "title":"...",
  "region_code":"46214",
  "category":"idle_asset",
  "why": {
    "background":"...",
    "desired_future":"...",
    "success_criteria": ["..."],
    "constraints": ["..."],
    "stakeholders": ["..."]
  }
}
```

------

### 5.4 PATCH `/projects/:id`

Whyの追記やメタ更新。

**Request**

```json
{
  "why": {
    "background": "維持費が年間1800万円",
    "desired_future": "多世代交流拠点"
  }
}
```

**Response 200**

```json
{ "updated": true }
```

------

### 5.5 POST `/projects/:id/why/success-criteria`

成功条件を追加。`sort_order` は小さいほど上位に表示される。

**Request**

```json
{
  "title": "利用率を70％まで回復",
  "description": "年間イベント開催数を20件以上にする",
  "sort_order": 10
}
```

**Response 201**

```json
{ "id": "sc_001" }
```

**Errors**: `VALIDATION_ERROR`, `404`（プロジェクト未存在）

------

### 5.6 PATCH `/projects/:id/why/success-criteria/:cid`

成功条件を更新。省略フィールドは変更なし。

**Request**

```json
{
  "title": "利用率を75％まで回復",
  "sort_order": 5
}
```

**Response 200**

```json
{ "updated": true }
```

**Errors**: `404`（成功条件未存在）, `409`（競合）

------

### 5.7 DELETE `/projects/:id/why/success-criteria/:cid`

成功条件を削除。

**Response 204**: 本文なし

**Errors**: `404`

------

### 5.8 POST `/projects/:id/why/constraints`

制約条件を追加。`constraint_type` は任意（例: `budget`, `policy` など）。

**Request**

```json
{
  "constraint_text": "改修費は年間1,000万円以内",
  "constraint_type": "budget",
  "sort_order": 10
}
```

**Response 201**

```json
{ "id": "c_001" }
```

**Errors**: `VALIDATION_ERROR`, `404`

------

### 5.9 PATCH `/projects/:id/why/constraints/:constraint_id`

制約条件を更新。

**Request**

```json
{
  "constraint_text": "改修費は年間800万円以内",
  "sort_order": 5
}
```

**Response 200**

```json
{ "updated": true }
```

**Errors**: `404`, `409`

------

### 5.10 DELETE `/projects/:id/why/constraints/:constraint_id`

制約条件を削除。

**Response 204**: 本文なし

**Errors**: `404`

------

### 5.11 POST `/projects/:id/why/stakeholders`

利害関係者を追加。`stakeholder_category` は `internal/external/citizen/partner/other` のいずれか。

**Request**

```json
{
  "stakeholder_name": "地域づくり課",
  "stakeholder_category": "internal",
  "stakeholder_role": "計画推進",
  "sort_order": 10
}
```

**Response 201**

```json
{ "id": "st_001" }
```

**Errors**: `VALIDATION_ERROR`, `404`

------

### 5.12 PATCH `/projects/:id/why/stakeholders/:stakeholder_id`

利害関係者を更新。

**Request**

```json
{
  "stakeholder_role": "意思決定",
  "sort_order": 5
}
```

**Response 200**

```json
{ "updated": true }
```

**Errors**: `404`, `409`

------

### 5.13 DELETE `/projects/:id/why/stakeholders/:stakeholder_id`

利害関係者を削除。

**Response 204**: 本文なし

**Errors**: `404`

------

## 6. Questions

### 6.1 GET `/projects/:id/questions`

**Response 200**

```json
{
  "items": [
    {"id":"q_001","text":"KGIの算定式は？","expects":"formula","blocking":true,"status":"open"}
  ]
}
```

### 6.2 POST `/projects/:id/questions/:qid/answer`

**Request**

```json
{ "answer": "年間来訪×平均単価−維持費=0" }
```

**Response 200**

```json
{ "status": "answered", "answered_at": "2025-10-03T05:10:00Z" }
```

------

## 7. Logic

### 7.1 POST `/projects/:id/logic/generate`

Whyからロジックツリー草案を生成。

**Request**

```json
{
  "why_summary": "財政負担の削減と地域ニーズ充足",
  "constraints": ["改修最小限","人員2名"],
  "seed_nodes": []
}
```

**Response 200**

```json
{
  "nodes": [
    {
      "id":"L1_A",
      "parent_id":null,
      "title":"維持費過大",
      "node_type":"problem",
      "rationale":"固定費が稼働に非連動",
      "assumption_ids":["A-001"],
      "confidence":"med"
    }
  ],
  "gaps": ["料金弾力性の前提不足"]
}
```

**Errors**: `SCHEMA_MISMATCH`（LLM出力不整合）

------

### 7.2 GET `/projects/:id/logic`

保存済みのロジックツリーと関連メタ情報を取得。ノード配列は階層を親子IDで表現する。

**Response 200**

```json
{
  "nodes": [
    {"id":"L1_A","parent_id":null,"title":"維持費過大","node_type":"problem","rationale":"固定費が稼働に非連動","assumption_ids":["A-001"],"confidence":"med","status":"open"}
  ],
  "updated_at": "2025-10-03T05:15:00Z"
}
```

**Errors**: `404`（プロジェクトまたはツリー未作成）

### 7.3 POST `/projects/:id/logic/inspect`

MECE、重複、飛躍、矛盾を検査。

**Request**

```json
{ "nodes": [{ "id":"L2_A1","title":"稼働率低い","parent_id":"L1_A"}] }
```

**Response 200**

```json
{
  "duplicates": [
    {"keep":"L2_A1","merge":["L2_B2"],"reason":"同義語: 稼働率/利用率"}
  ],
  "leaps": [
    {"node_id":"L2_A1","reason":"原因→施策へ飛躍","suggestion":"中間仮説を追加"}
  ],
  "contradictions": [
    {"a":"PEST:S=需要増","b":"KPI:来訪目標=縮小","fix_hint":"KPI再設定"}
  ],
  "patch": { "operations": [ /* 可逆パッチ */ ] }
}
```

------

## 8. Framework

### 8.1 POST `/projects/:id/framework/normalize`

最小入力から1ページ要旨を生成。

**Request**

```json
{
  "PEST":{"P":"子育て交付金継続","E":"所得0.9","S":"保護者需要未充足","T":"SaaSで代替可"},
  "3C":{"Customer":"徒歩圏2800人/子育て450世帯","Company":"施設保有","Competitor":"小規模スペース数件"},
  "SWOT":{"S":["立地/駐車場"],"W":["改修制約"],"O":["交付金"],"T":["人口減少"]},
  "5F":{"entry":"低中","substitute":"中","buyer":"中","supplier":"中","rivalry":"低中"}
}
```

**Response 200**

```json
{
  "summary_md": "## 1ページ要旨 ...",
  "normalized_terms": [{"raw":"利用率","norm":"稼働率"}],
  "conflicts": [{"field":"PEST-S vs KPI","detail":"矛盾"}]
}
```

### 8.2 GET `/projects/:id/framework`

最新の統合要旨と入力セットを取得。空欄はAI補完済みの値を返す。

**Response 200**

```json
{
  "summary_md": "## 1ページ要旨 ...",
  "normalized_terms": [{"raw":"利用率","norm":"稼働率"}],
  "conflicts": [{"field":"PEST-S vs KPI","detail":"矛盾"}],
  "inputs": {
    "PEST": {"P":"...","E":"..."},
    "3C": {"Customer":"..."}
  },
  "updated_at": "2025-10-03T05:20:00Z"
}
```

**Errors**: `404`（入力未登録）

------

## 9. Market

### 9.1 POST `/projects/:id/market/sizing`

SOMと感度を算出。

**Request**

```json
{
  "population_tam": 2800,
  "sam_population": 800,
  "visits_per_person_per_year": {"low":2,"mode":3,"high":5},
  "reach_rate": {"low":0.10,"mode":0.20,"high":0.35},
  "conversion_rate": {"low":0.20,"mode":0.30,"high":0.45}
}
```

**Response 200**

```json
{
  "som": {"low":480,"med":1440,"high":3780},
  "sensitivity_rank": [
    {"param":"reach_rate","elasticity":0.67},
    {"param":"conversion_rate","elasticity":0.50}
  ],
  "assumptions_link": ["A-002","A-003"]
}
```

### 9.2 GET `/projects/:id/market`

保存済みの試算結果（TAM/SAM/SOMおよび感度）を取得。`assumptions` は関連前提IDを返す。

**Response 200**

```json
{
  "tam": 2800,
  "sam": 800,
  "som": {"low":480,"med":1440,"high":3780},
  "sensitivity_rank": [{"param":"reach_rate","elasticity":0.67}],
  "assumptions": ["A-002","A-003"],
  "updated_at": "2025-10-03T05:25:00Z"
}
```

**Errors**: `404`（試算未登録）

------

## 10. Preview

### 10.1 POST `/projects/:id/preview/synthesize`

プレビュー用の章立て叙述を生成。Backend→Worker→JSON Schema検証→応答のフローで同期処理する（保存はしない）。

**Request**

```json
{
  "outline": ["1 ミッション","2 顧客課題"],
  "logic_nodes": [{"id":"L1_A","title":"維持費過大","confidence":"med"}],
  "framework_summary_md": "## 1ページ要旨 ...",
  "market_sizing": {"som":{"low":480,"med":1440,"high":3780}},
  "assumptions": [{"id":"A-001","text":"維持費1800万円","confidence":"high"}]
}
```

**Response 200**

```json
{
  "sections": [
    {"id":"1","title":"ミッション","body_md":"地域交流を再起動する...","assumption_ids":["A-001"]}
  ],
  "gaps": ["資金計画の前提が不足"],
  "latency_ms": 2100
}
```

**Errors**: `SCHEMA_MISMATCH`（LLM出力不整合）、`422`（入力不足）

------

## 11. Export

### 11.1 POST `/projects/:id/export`

Markdown/Wordを生成。前提や出典の欠落、P0残存がある場合はビルドを拒否。

**Request**

```json
{
  "format": "docx",          // enum: md|docx
  "sections": ["1","2","3"]  // 省略時は全章
}
```

**Response 200**

```json
{
  "artifact_id": "uuid",
  "version": "v0.3",
  "hash": "sha256:...",
  "download_url": "/download/uuid"
}
```

**Errors**

- `EXPORT_BLOCKED`: P0残存、assumption/evidence欠落（要出典状態の残存）
- `TEMPLATE_ERROR`: テンプレ組版不正

------

## 12. Audit

### 12.1 GET `/projects/:id/audit?limit=&cursor=`

**Response 200**

```json
{
  "items": [
    {
      "id": 12345,
      "action": "generate_logic",
      "actor_id": "uuid",
      "model_id": "gpt-*-*",
      "prompt_id": "logic_v1",
      "latency_ms": 2200,
      "created_at": "2025-10-03T05:30:00Z"
    }
  ],
  "next_cursor": null
}
```

------

## 13. Dictionary

### 13.1 GET `/dictionary?domain=gov|common|consulting&raw=利用率`

**Response 200**

```json
{ "normalized": "稼働率" }
```

------

## 14. Assumption/Evidence

### 14.1 POST `/projects/:id/assumptions`

前提を作成。`evidence_ids`は省略可（要出典状態を許容）。

**Request**

```json
{
  "tag": "data",
  "text": "年間維持費1800万円",
  "confidence": "high",
  "evidence_ids": ["E-001", "E-002"]  // 省略可、複数指定可
}
```

**Response 201**

```json
{ "id": "A-001" }
```

**Errors**: `VALIDATION_ERROR`, `404`（evidence_id未存在）

### 14.2 GET `/projects/:id/assumptions/:aid`

前提の詳細と紐付きEvidenceを取得。

**Response 200**

```json
{
  "id": "A-001",
  "tag": "data",
  "text": "年間維持費1800万円",
  "confidence": "high",
  "evidence": [
    {"id": "E-001", "title": "令和6年度決算", "kind": "url", "url": "https://..."},
    {"id": "E-002", "title": "施設管理報告書", "kind": "document"}
  ],
  "created_at": "2025-10-03T05:00:00Z"
}
```

**Errors**: `404`（Assumption未存在）

------

### 14.3 POST `/projects/:id/assumptions/:aid/sources`

前提に出典を紐付け（追加）。既存の紐付けは維持される。

**Request**

```json
{
  "evidence_id": "E-003"
}
```

**Response 201**

```json
{ "added": true }
```

**Errors**: `404`（Assumptionまたはevidence_id未存在）, `409`（既に紐付け済み）

------

### 14.4 DELETE `/projects/:id/assumptions/:aid/sources/:eid`

前提から特定の出典の紐付けを削除。

**Response 204**: 本文なし

**Errors**: `404`（紐付け未存在）

------

### 14.5 POST `/projects/:id/evidence`

出典を登録。

**Request**

```json
{
  "kind": "url",
  "title": "令和6年度決算",
  "url": "https://example.gov/...",
  "year": 2024
}
```

**Response 201**

```json
{ "id": "E-001" }
```

**Errors**: `VALIDATION_ERROR`

------

## 15. レート制限

- 既定: 60 req/分/ユーザー。`429`時は`Retry-After`秒を返す。

------

## 16. スキーマ検証

- 生成APIはLLM出力をJSON Schemaで検証。失敗時は`422 SCHEMA_MISMATCH`で原文を監査ログに退避。

------

## 17. 変更履歴

- v0.1（2025-10-03）初稿
