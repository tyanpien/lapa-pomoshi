import Link from "next/link";

export default function ProfileRequestsPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: "42rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Мои запросы</h1>
      <p style={{ marginBottom: "1.5rem", color: "#555" }}>
        Список запросов о помощи появится здесь после подключения к API.
      </p>
      <Link href="/profile" style={{ color: "var(--link-color, #2563eb)" }}>
        ← Вернуться в профиль
      </Link>
    </main>
  );
}
