import type { SupabaseClient } from "./db.ts";

export interface FamilyProgress {
  family_id: string;
  discovered: number;
  total: number;
  completed: boolean;
}

export interface ProfileProgress {
  discovered_count: number;
  families: FamilyProgress[];
}

/**
 * Calcula el progreso público de un perfil sin exponer datos internos.
 * Sólo devuelve conteos y estado por familia.
 */
export async function computeProgress(
  db: SupabaseClient,
  profileId: string,
): Promise<ProfileProgress> {
  const { data: discoveries } = await db
    .from("discoveries")
    .select("family_id, placement_id")
    .eq("profile_id", profileId);

  const { data: families } = await db
    .from("node_families")
    .select("id");

  const { data: placements } = await db
    .from("node_placements")
    .select("id, family_id")
    .in("status", ["active", "paused", "missing", "replaced"]);

  const totalByFamily = new Map<string, number>();
  for (const p of placements ?? []) {
    totalByFamily.set(p.family_id, (totalByFamily.get(p.family_id) ?? 0) + 1);
  }

  const discoveredByFamily = new Map<string, number>();
  for (const d of discoveries ?? []) {
    discoveredByFamily.set(d.family_id, (discoveredByFamily.get(d.family_id) ?? 0) + 1);
  }

  const familyProgress: FamilyProgress[] = (families ?? []).map((f) => {
    const total = totalByFamily.get(f.id) ?? 0;
    const discovered = discoveredByFamily.get(f.id) ?? 0;
    return {
      family_id: f.id,
      discovered,
      total,
      completed: total > 0 && discovered >= total,
    };
  });

  return {
    discovered_count: discoveries?.length ?? 0,
    families: familyProgress,
  };
}
