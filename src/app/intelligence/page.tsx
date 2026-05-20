import { redirect } from "next/navigation";

import { IntelligenceClient } from "@/components/IntelligenceClient";
import { isAuthenticated } from "@/lib/auth";

export default async function IntelligencePage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  return <IntelligenceClient />;
}
