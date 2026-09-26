import { permanentRedirect } from "next/navigation";

export default function InstallPage() {
  permanentRedirect("/setup");
}
