"use client";

import { useEffect } from "react";
import { initSync } from "@/lib/sync";

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initSync();
  }, []);

  return <>{children}</>;
}
