import Header from "../../widgets/header/Header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <Header />
      <main className="p-6">{children}</main>
    </div>
  );
}
