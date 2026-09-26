import { redirect } from "next/navigation";

// Switches is home: it lists every Bridge's switches (docs/specs/page-structure.md).
export default function Home() {
  redirect("/switches");
}
