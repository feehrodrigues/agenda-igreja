import { notFound } from "next/navigation";
import PreviewCliente from "./preview-cliente";

// Prévia local do programa, com dados fictícios: existe só em desenvolvimento.
export const dynamic = "force-dynamic";

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PreviewCliente />;
}
