import type { User } from "@planforge/contracts";

function App() {
  const sampleUser: User = {
    id: "1",
    email: "test@example.com",
    name: "Test User",
    createdAt: new Date(),
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>🚀 PlanForge Frontend</h1>
      <p>Monorepo セットアップが完了しました！</p>

      <h2>サンプルユーザー:</h2>
      <pre
        style={{
          background: "#f4f4f4",
          padding: "1rem",
          borderRadius: "4px",
          overflow: "auto",
        }}
      >
        {JSON.stringify(sampleUser, null, 2)}
      </pre>

      <p style={{ marginTop: "2rem", color: "#666" }}>
        ✅ このデータ型は @planforge/contracts パッケージから共有されています
      </p>
    </div>
  );
}
export default App; // ← この行を追加
