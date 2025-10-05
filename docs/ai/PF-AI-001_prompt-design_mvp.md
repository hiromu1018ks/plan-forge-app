# AIプロンプト設計書 — PlanForge LG（MVP）

- 文書番号: PF-AI-001
- 版数: v0.1
- 作成日: 2025-10-03
- 関連: PF-REQ-001, PF-NFR-001, PF-UC-001, PF-API-001, PF-DM-001, PF-UI-001

------

## 1. 目的

各AI機能のプロンプト仕様を定義。入力スキーマ、出力スキーマ、ガードレール、温度・再試行、検証フローを固定し、再現性と監査性を担保する。

------

## 2. 共通ポリシー

### 2.1 原則

- 出力は**必ずJSON**（指定時）。自然文は`summary_md`等の値に収める。
- 未確定は`null`または`confidence:"low"`で明示。断定語は禁止。
- 事実主張は`assumption_ids[]`と`evidence_ids[]`を付与。出典未確定の場合は`evidence_ids: []`（要出典状態）。
- 日本語で簡潔に。1項目1文。箇条書きは配列で表現。

### 2.2 パラメータ既定

| 用途                   | temperature | top_p | max_tokens | frequency_penalty | presence_penalty |
| ---------------------- | ----------- | ----- | ---------- | ----------------- | ---------------- |
| 生成（ロジック・要旨） | 0.2         | 0.9   | 3k         | 0                 | 0                |
| 検査（MECE/矛盾）      | 0.0         | 0.9   | 2k         | 0                 | 0                |
| 質問生成               | 0.3         | 0.9   | 1.5k       | 0                 | 0                |
| 叙述（章立て）         | 0.25        | 0.95  | 6k         | 0                 | 0                |

### 2.3 再試行・自己検証

- JSON Schema検証NG時は**最大1回**自己修復プロンプトで再試行。
- それでもNGなら`422 SCHEMA_MISMATCH`でAPIレイヤに返却し、監査に原文退避。

### 2.4 JSON Schema（共通型）

```json
{
  "$defs": {
    "Confidence": { "enum": ["low","med","high"] },
    "AssumptionIds": { "type":"array","items":{"type":"string"}, "default":[] }
  }
}
```

------

## 3. Logic-Coach：ロジックツリー生成

### 3.1 目的

Whyと制約から、第1階層3〜5本の分解と主要子ノードを生成。各ノードに rationale / evidence_needed / confidence を付与。

### 3.2 入力（モデルに渡す）

```json
{
  "why_summary": "string",
  "constraints": ["string"],
  "seed_nodes": []
}
```

### 3.3 出力スキーマ

```json
{
  "type":"object",
  "properties":{
    "nodes":{
      "type":"array",
      "items":{
        "type":"object",
        "required":["id","parent_id","title","node_type","confidence"],
        "properties":{
          "id":{"type":"string"},
          "parent_id":{"type":["string","null"]},
          "title":{"type":"string"},
          "node_type":{"enum":["why","problem","cause","option","kpi"]},
          "rationale":{"type":["string","null"]},
          "assumption_ids":{"$ref":"#/$defs/AssumptionIds"},
          "evidence_needed":{"type":"array","items":{"type":"string"}, "default":[]},
          "confidence":{"$ref":"#/$defs/Confidence"}
        }
      }
    },
    "gaps":{"type":"array","items":{"type":"string"}}
  },
  "required":["nodes","gaps"]
}
```

### 3.4 システムプロンプト（抜粋）

- 目的: WhyからMECEな第1階層3〜5本を提案し、各子に因果根拠と必要データを付す。
- 制約: 断定禁止。推測は`confidence:"low"`。同義語は一般語に正規化（辞書別途適用）。
- 形式: **JSONのみ**。自然文や前置きは禁止。

### 3.5 ユーザープロンプト雛形

```
# Why
{{why_summary}}

# Constraints
- {{constraints|join("\n- ")}}

# Seed Nodes
{{json seed_nodes}}
```

------

## 4. Logic-Coach：ロジック検査（MECE/重複/飛躍/矛盾）

### 4.1 入力

```json
{ "nodes": [ { "id":"...", "title":"...", "parent_id":"...", "node_type":"..." } ] }
```

### 4.2 出力スキーマ

```json
{
  "type":"object",
  "properties":{
    "duplicates":{"type":"array","items":{"type":"object","required":["keep","merge","reason"]}},
    "leaps":{"type":"array","items":{"type":"object","required":["node_id","reason","suggestion"]}},
    "contradictions":{"type":"array","items":{"type":"object","required":["a","b","fix_hint"]}},
    "patch":{"type":"object"}  // 可逆差分
  },
  "required":["duplicates","leaps","contradictions","patch"]
}
```

### 4.3 システムプロンプト要点

- MECE観点チェック、同義語統合の指摘、因果の飛躍の指摘、フレームワークやKPIとの整合。
- 出力はJSONのみ。各指摘は**修正ヒント**を含める。

------

## 5. Framework-Fuser：要点統合（PEST/3C/SWOT/5F）

### 5.1 入力

```json
{
  "PEST": {"P":"...","E":"...","S":"...","T":"..."},
  "3C": {"Customer":"...","Company":"...","Competitor":"..."},
  "SWOT": {"S":["..."],"W":["..."],"O":["..."],"T":["..."]},
  "5F": {"entry":"...","substitute":"...","buyer":"...","supplier":"...","rivalry":"..."}
}
```

### 5.2 出力スキーマ

```json
{
  "type":"object",
  "properties":{
    "summary_md":{"type":"string"},
    "normalized_terms":{"type":"array","items":{"type":"object","required":["raw","norm"]}},
    "conflicts":{"type":"array","items":{"type":"object","required":["field","detail"]}}
  },
  "required":["summary_md","normalized_terms","conflicts"]
}
```

### 5.3 システムプロンプト要点

- 各要素を**1文**に正規化。重複は統合。
- 矛盾（例: マクロ需要増 vs KPI縮小）を抽出。
- 出力はMarkdown文字列と正規化マップ、矛盾ログ。

------

## 6. Scenario-Lab：市場規模試算・感度説明

### 6.1 入力

```json
{
  "population_tam": 0,
  "sam_population": 0,
  "visits_per_person_per_year": {"low":0,"mode":0,"high":0},
  "reach_rate": {"low":0,"mode":0,"high":0},
  "conversion_rate": {"low":0,"mode":0,"high":0}
}
```

### 6.2 出力スキーマ

```json
{
  "type":"object",
  "properties":{
    "som":{"type":"object","properties":{"low":{"type":"number"},"med":{"type":"number"},"high":{"type":"number"}}},
    "sensitivity_rank":{"type":"array","items":{"type":"object","required":["param","elasticity"]}},
    "assumptions_link":{"$ref":"#/$defs/AssumptionIds"}
  },
  "required":["som","sensitivity_rank","assumptions_link"]
}
```

### 6.3 システムプロンプト要点

- `SOM = SAM × reach × conversion × visits` を説明可能に。
- 三角分布の3点評価を採用。式と前提リンクを返す。
- 断定禁止。レンジ外入力時は理由付きエラーを返す（APIで400に変換）。

------

## 7. Interviewer-Bot：追撃質問生成

### 7.1 入力

```json
{
  "why": {
    "background":"string",
    "desired_future":"string",
    "success_criteria":["string"],
    "constraints":["string"],
    "stakeholders":["string"]
  }
}
```

### 7.2 出力スキーマ

```json
{
  "type":"object",
  "properties":{
    "questions":{
      "type":"array",
      "items":{
        "type":"object",
        "required":["id","text","expects","blocking"],
        "properties":{
          "id":{"type":"string"},
          "text":{"type":"string"},
          "expects":{"enum":["formula","choice","text"]},
          "choices":{"type":["array","null"],"items":{"type":"string"}},
          "blocking":{"type":"boolean"}
        }
      }
    }
  },
  "required":["questions"]
}
```

### 7.3 生成ルール

- SMARTの欠落、制約とKGIの矛盾、ステークホルダー別の価値仮説、定量根拠の有無を確認。
- Yes/Noで終わらない問いを優先。最大5件。

------

## 8. Narrative Synth：章立て叙述の生成（プレビュー用）

### 8.1 入力

```json
{
  "outline": ["1 ミッション","2 顧客課題","3 アプローチ", "..."],
  "logic_nodes": [{ "id":"...", "title":"...", "confidence":"med" }],
  "framework_summary_md": "string",
  "market_sizing": { "som":{"low":0,"med":0,"high":0} },
  "assumptions": [{ "id":"...", "text":"...", "confidence":"low","evidence_ids":[] }]
}
```

### 8.2 出力スキーマ

```json
{
  "type":"object",
  "properties":{
    "sections":{"type":"array","items":{"type":"object","required":["id","title","body_md","assumption_ids"],"properties":{
      "id":{"type":"string"},
      "title":{"type":"string"},
      "body_md":{"type":"string"},
      "assumption_ids":{"$ref":"#/$defs/AssumptionIds"}
    }}}  
  },
  "required":["sections"]
}
```

### 8.3 スタイル規範

- 短文・能動文。定量は式と前提を併記。
- 未確定は `[未確定]` を本文に付記。
- 脚注は`[^id]`形式で生成（IDはEvidenceに対応）。

------

## 9. 監査ログ出力の必須メタ

各呼び出しでモデルに付す`meta`（システム側で付与）:

```json
{
  "meta": {
    "prompt_id": "logic_generate_v1",
    "project_id": "uuid",
    "actor_id": "uuid",
    "schema_version": "1.0.0"
  }
}
```

------

## 10. 安全・品質ガードレール

### 10.1 禁止事項

- 固有名詞の事実断定（出典なし）。
- 過去データの推定を事実のように記述。
- 比率計算で1超/0未満を許容。

### 10.2 自己チェック（モデル内）

- 生成前に「未充足の前提」「矛盾の疑い」を`gaps[]`へ必ず出力。
- JSON以外の文字列を出さない。

### 10.3 スキーマ検証後の自己修復プロンプト（要点）

- 直前応答を貼り、差分で修正指示。
- 追加で自然文を一切出さないよう明示。

------

## 11. サンプル（テスト用最小入力）

### 11.1 ロジック生成（合格例）

```json
{
  "why_summary":"維持費の削減と地域ニーズ充足",
  "constraints":["改修最小限","人員2名"]
}
```

期待: `nodes[].node_type in {"problem","cause"}`, 第1階層3〜5本、`confidence`が付く。

### 11.2 フレームワーク統合（合格例）

```json
{
  "PEST":{"P":"子育て交付金継続","E":"可処分所得0.9","S":"交流需要","T":"SaaS"},
  "3C":{"Customer":"徒歩圏2800人/子育て450世帯","Company":"施設保有","Competitor":"小規模"},
  "SWOT":{"S":["立地"],"W":["改修制約"],"O":["交付金"],"T":["人口減少"]},
  "5F":{"entry":"低中","substitute":"中","buyer":"中","supplier":"中","rivalry":"低中"}
}
```

期待: `summary_md`が1ページ、`normalized_terms`に「利用率→稼働率」。

------

## 12. 変更履歴

- v0.1（2025-10-03）初稿