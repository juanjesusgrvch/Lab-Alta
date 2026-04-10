import { AppAccess } from "@/components/auth/app-access";
import { getTurnstileSiteKey } from "@/lib/server/turnstile-config";

// Renderizado
export const dynamic = "force-dynamic";

export default function HomePage() {
  return <AppAccess turnstileSiteKey={getTurnstileSiteKey()} />;
}
