# データモデル定義（ERD/スキーマ）— PlanForge LG（MVP）

- 文書番号: PF-DM-001
- 版数: v0.1（整形再掲）
- 作成日: 2025-10-03
- 関連: PF-REQ-001, PF-NFR-001, PF-BIZ-001, PF-UC-001

------

## 1. 目的

MVPで必要な永続データとAPI入出力の論理モデルを定義する。RDBはPostgreSQL想定。JSONは補助に限定。

------

## 2. エンティティ一覧（要約）

- **User**: 利用者
- **Project**: 計画案件
- **Membership**: Project×Userの権限
- **ProjectSuccessCriterion**: Whyの成功条件。順序と詳細説明を保持
- **ProjectConstraint**: 制約条件。分類と表示順を保持
- **ProjectStakeholder**: 利害関係者。カテゴリ・役割情報を保持
- **Assumption**: 前提（confidence付）。各Assumptionは0個以上のEvidenceを参照可能（多対多）。作業中は要出典状態（Evidence未紐付け）を許容し、エクスポート時に検証
- **Evidence**: 出典（URL/書誌/添付）。プロジェクト単位で管理
- **LogicNode**: ロジックツリーのノード
- **FrameworkInput**: PEST/3C/SWOT/5Fの正規化済み入力
- **MarketSizing**: TAM/SAM/SOMと感度
- **KPI**: KGI/KPI/先行指標
- **ExportArtifact**: 出力成果物（md/docx/svg等）
- **AuditLog**: 監査ログ（AI入出力・操作）
- **Question**: 追撃質問キュー
- **TermDictionary**: 用語正規化辞書
- **Patch**: 検査修正パッチ履歴

------

## 3. ERD（テキスト表現）

```
User 1---* Membership *---1 Project
Project 1---* LogicNode
Project 1---* FrameworkInput
Project 1---1 MarketSizing
Project 1---* KPI
Project 1---* Assumption
Project 1---* Evidence
Project 1---* ExportArtifact
Project 1---* AuditLog
Project 1---* Question
Project 1---* ProjectSuccessCriterion
Project 1---* ProjectConstraint
Project 1---* ProjectStakeholder
LogicNode *---* Assumption
Assumption *---* Evidence
FrameworkInput *---* Assumption
KPI *---* Assumption
TermDictionary （独立、参照のみ）
Patch *---1 Project, Patch *---* LogicNode
```

------

## 4. テーブル定義（DDLスケッチ）

### 4.1 users

```sql
create table users (
  id uuid primary key,
  email text unique not null,
  name text,
  created_at timestamptz not null default now()
);
```

### 4.2 projects

```sql
create table projects (
  id uuid primary key,
  title text not null,
  region_code text,
  category text check (category in ('idle_asset','mobility','childcare','tourism','welfare','other')),
  why_background text,
  why_desired_future text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_projects_category on projects(category);
```

### 4.3 project_success_criteria

```sql
create table project_success_criteria (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  sort_order smallint not null default 0,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);
create index idx_project_success_criteria_project on project_success_criteria(project_id, sort_order);
```

### 4.4 project_constraints

```sql
create table project_constraints (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  sort_order smallint not null default 0,
  constraint_text text not null,
  constraint_type text,
  created_at timestamptz not null default now()
);
create index idx_project_constraints_project on project_constraints(project_id, sort_order);
```

### 4.5 project_stakeholders

```sql
create table project_stakeholders (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  sort_order smallint not null default 0,
  stakeholder_name text not null,
  stakeholder_category text check (stakeholder_category in ('internal','external','citizen','partner','other')),
  stakeholder_role text,
  created_at timestamptz not null default now()
);
create index idx_project_stakeholders_project on project_stakeholders(project_id, sort_order);
```

### 4.6 memberships（RBAC）

```sql
create table memberships (
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  primary key (project_id, user_id)
);
```

### 4.7 assumptions

```sql
create table assumptions (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  tag text not null check (tag in ('hypothesis','data','constraint','risk')),
  text text not null,
  confidence text not null check (confidence in ('low','med','high')),
  note text,
  created_at timestamptz not null default now()
);
create index idx_assumptions_project on assumptions(project_id);
```

#### 4.7.1 assumption_sources

```sql
create table assumption_sources (
  assumption_id uuid references assumptions(id) on delete cascade,
  evidence_id uuid references evidence(id) on delete cascade,
  primary key (assumption_id, evidence_id)
);
create index idx_assumption_sources_assumption on assumption_sources(assumption_id);
create index idx_assumption_sources_evidence on assumption_sources(evidence_id);
```

### 4.8 evidence

```sql
create table evidence (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null check (kind in ('url','document','book','dataset','other')),
  title text,
  url text,
  citation text,
  file_object_key text,
  year int,
  created_at timestamptz not null default now()
);
```

### 4.9 logic_nodes

```sql
create table logic_nodes (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  parent_id uuid references logic_nodes(id),
  title text not null,
  node_type text not null check (node_type in ('why','problem','cause','option','kpi')),
  rationale text,
  priority_score numeric,
  status text not null default 'open' check (status in ('open','merged','dropped')),
  confidence text check (confidence in ('low','med','high')),
  created_at timestamptz not null default now()
);
create index idx_logic_nodes_project on logic_nodes(project_id);
create index idx_logic_nodes_parent on logic_nodes(parent_id);
```

#### 4.9.1 logic_node_assumptions

```sql
create table logic_node_assumptions (
  node_id uuid references logic_nodes(id) on delete cascade,
  assumption_id uuid references assumptions(id) on delete cascade,
  primary key (node_id, assumption_id)
);
```

### 4.10 framework_inputs

```sql
create table framework_inputs (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null check (kind in ('PEST','3C','SWOT','5F')),
  key text not null,
  value text not null,
  normalized_value text,
  created_at timestamptz not null default now()
);
create index idx_framework_inputs_project_kind on framework_inputs(project_id, kind);
```

#### 4.10.1 framework_input_assumptions

```sql
create table framework_input_assumptions (
  framework_input_id uuid references framework_inputs(id) on delete cascade,
  assumption_id uuid references assumptions(id) on delete cascade,
  primary key (framework_input_id, assumption_id)
);
```

### 4.11 market_sizing

```sql
create table market_sizing (
  project_id uuid primary key references projects(id) on delete cascade,
  tam numeric,
  sam numeric,
  som_low numeric,
  som_med numeric,
  som_high numeric,
  assumptions jsonb,
  sensitivity jsonb,
  updated_at timestamptz not null default now()
);
```

### 4.12 kpis

```sql
create table kpis (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  kpi_type text not null check (kpi_type in ('KGI','KPI','leading')),
  unit text,
  formula text,
  parent_id uuid references kpis(id),
  created_at timestamptz not null default now()
);
create index idx_kpis_project on kpis(project_id);
```

#### 4.12.1 kpi_assumptions

```sql
create table kpi_assumptions (
  kpi_id uuid references kpis(id) on delete cascade,
  assumption_id uuid references assumptions(id) on delete cascade,
  primary key (kpi_id, assumption_id)
);
```

### 4.13 export_artifacts

```sql
create table export_artifacts (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  format text not null check (format in ('md','docx','svg','png')),
  path text not null,
  version text not null,
  content_hash text not null,
  sections jsonb,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
```

### 4.14 audit_logs（追記専用）

```sql
create table audit_logs (
  id bigserial primary key,
  project_id uuid references projects(id) on delete set null,
  actor_id uuid references users(id),
  action text not null,
  trace_id text not null,
  result text not null check (result in ('success','blocked','error')),
  model_id text,
  prompt_id text,
  input_hash text,
  output_hash text,
  tokens_in int,
  tokens_out int,
  latency_ms int,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_project on audit_logs(project_id);
```

### 4.15 questions

```sql
create table questions (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  text text not null,
  expects text not null check (expects in ('formula','choice','text')),
  choices jsonb,
  blocking boolean not null default false,
  status text not null default 'open' check (status in ('open','answered','skipped')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
```

### 4.16 term_dictionary

```sql
create table term_dictionary (
  id uuid primary key,
  domain text not null check (domain in ('gov','common','consulting')),
  raw text not null,
  normalized text not null,
  created_at timestamptz not null default now()
);
create unique index uq_term_norm on term_dictionary(domain, raw);
```

### 4.17 patches

```sql
create table patches (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null check (kind in ('duplicate_merge','leap_fix','contradiction_fix')),
  detail jsonb not null,
  applied_by uuid references users(id),
  created_at timestamptz not null default now()
);
```

------

## 5. 整合性ルール

- 公開出力の各段落は `assumption_id[]` または `evidence_id[]` を必須。欠落時はエクスポート不可。
- `project_success_criteria.sort_order` / `project_constraints.sort_order` / `project_stakeholders.sort_order` は表示順を保持し、同一 `project_id` 内での重複はアプリ層で禁止（将来ユニーク制約追加を想定）。
- `project_stakeholders.stakeholder_category` は定義済みの区分のみ許容し、業務要件の並び替え・集計を容易にする。
- `assumptions` と `evidence` の関連は `assumption_sources` 中間テーブルで管理。1つのAssumptionに複数のEvidenceを紐付け可能。作業中は出典なし（要出典状態）を許容するが、エクスポート時に `assumption_sources` が0件のAssumptionがあればビルドをブロック。
- `logic_nodes.title`、`framework_inputs.normalized_value`、`kpis.name` は用語辞書で正規化。
- `audit_logs.trace_id` および `audit_logs.result` は必須で、操作追跡とブロック理由の記録を保証する。
- 機微情報（P0）は入力時に拒否または即時マスキング。MVPでは添付アップロードは抑制。

------

## 6. 代表インデックスと検索

- `project_success_criteria(project_id, sort_order)` / `project_constraints(project_id, sort_order)` / `project_stakeholders(project_id, sort_order)` で Why 画面表示を安定化
- `framework_inputs(project_id, kind)` で画面ロード最適化
- `logic_nodes(parent_id)` でツリー展開を高速化
- `audit_logs(project_id, created_at desc)` で時系列トレース

------

## 7. API入出力スキーマ（抜粋）

### 7.1 ロジック生成（POST /api/projects/:id/logic/generate）

```json
{
  "why_summary": "string",
  "constraints": ["string"],
  "seed_nodes": []
}
```

応答

```json
{
  "nodes": [
    {
      "id": "uuid",
      "parent_id": null,
      "title": "維持費過大",
      "node_type": "problem",
      "rationale": "固定費が稼働に連動していない",
      "assumption_ids": ["uuid"],
      "confidence": "med"
    }
  ],
  "gaps": ["料金弾力性未評価"]
}
```

### 7.2 フレームワーク統合（POST /api/projects/:id/framework/normalize）

```json
{
  "PEST": {"P":"...","E":"...","S":"...","T":"..."},
  "3C": {"Customer":"...","Company":"...","Competitor":"..."},
  "SWOT": {"S":["..."],"W":["..."],"O":["..."],"T":["..."]},
  "5F": {"entry":"...","substitute":"...","buyer":"...","supplier":"...","rivalry":"..."}
}
```

応答

```json
{
  "summary_md": "markdown",
  "normalized_terms": [{"raw":"利用率","norm":"稼働率"}],
  "conflicts": [{"field":"PEST-S vs KPI","detail":"需要増とKPI縮小が矛盾"}]
}
```

### 7.3 試算（POST /api/projects/:id/market/sizing）

```json
{
  "population_tam": 2800,
  "visits_per_person_per_year": {"low":2,"mode":3,"high":5},
  "sam_population": 800,
  "reach_rate": {"low":0.1,"mode":0.2,"high":0.35},
  "conversion_rate": {"low":0.2,"mode":0.3,"high":0.45}
}
```

応答

```json
{
  "som": {"low":480,"med":1440,"high":3780},
  "sensitivity_rank": [{"param":"reach_rate","elasticity":0.67}]
}
```

------

## 8. マイグレーション方針（MVP）

- 連番マイグレーション: `001_init.sql`, `002_add_kpi.sql`
- 初期辞書（term_dictionary）は種データとして投入
- 監査ログは追加のみ。スキーマ変更時は互換カラムを残す

------

## 9. データ品質チェック（定期）

- 孤立ノード検出
- assumption/evidence欠落の段落抽出（要出典状態の残存チェック）
- 辞書未適用の生表現抽出

------

## 10. 変更履歴

- v0.1（2025-10-03）初稿再掲
