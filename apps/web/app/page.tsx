// apps/web/app/page.tsx
export default function HomePage() {
  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#0f172a",
      color: "white",
      fontFamily: "system-ui, sans-serif"
    }}>
      <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>
       FSTail Platform
      </h1>
      <p>Frontend cargando correctamente</p>
      <p style={{ marginTop: "20px" }}>
        <a href="/login" style={{ color: "#60a5fa" }}>Ir al Login</a>
      </p>
    </div>
  );
}