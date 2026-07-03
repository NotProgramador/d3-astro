// Cierre de loop: recompensa provisional al completar una familia.
// Idempotente: un mismo (profile_id, reward_id) siempre produce el mismo
// claim_code gracias al UNIQUE (reward_id, profile_id).

import type { SupabaseClient } from "./db.ts";
import { generateClaimCode } from "./ids.ts";

export interface ProfileClaim {
  family_id: string;
  family_name: string | null;
  reward_name: string;
  reward_description: string | null;
  reward_type: string | null;
  claim_code: string;
  status: string;
  created_at: string;
  is_first_time?: boolean;
}

/**
 * Devuelve todas las claims del perfil (join con rewards + families).
 * Sólo lectura. No crea nada.
 */
export async function getProfileClaims(
  db: SupabaseClient,
  profileId: string,
): Promise<ProfileClaim[]> {
  const { data, error } = await db
    .from("reward_claims")
    .select("claim_code, status, created_at, rewards ( family_id, name, description, reward_type )")
    .eq("profile_id", profileId);
  if (error || !data) return [];

  // Enriquecer con family name (opcional, no crítico)
  const familyIds = Array.from(new Set(
    data.map((r: any) => r.rewards?.family_id).filter(Boolean),
  ));
  let nameByFamily: Record<string, string | null> = {};
  if (familyIds.length > 0) {
    const { data: fams } = await db
      .from("node_families").select("id, name").in("id", familyIds);
    for (const f of fams ?? []) nameByFamily[f.id] = f.name ?? null;
  }

  return data.map((r: any) => ({
    family_id: r.rewards?.family_id ?? "",
    family_name: nameByFamily[r.rewards?.family_id] ?? null,
    reward_name: r.rewards?.name ?? "",
    reward_description: r.rewards?.description ?? null,
    reward_type: r.rewards?.reward_type ?? null,
    claim_code: r.claim_code,
    status: r.status,
    created_at: r.created_at,
  }));
}

/**
 * Si el perfil ya completó la familia y existe una reward activa para
 * esa familia, garantiza que exista una reward_claim única y la devuelve.
 * Devuelve null cuando: familia no completada, o no hay reward activa.
 */
export async function ensureClaimForCompletedFamily(
  db: SupabaseClient,
  profileId: string,
  familyId: string,
  familyName: string | null,
  isFamilyCompleted: boolean,
): Promise<ProfileClaim | null> {
  if (!isFamilyCompleted) return null;

  const { data: reward } = await db
    .from("rewards")
    .select("id, name, description, reward_type, is_active")
    .eq("family_id", familyId)
    .eq("is_active", true)
    .maybeSingle();
  if (!reward) return null;

  // Idempotencia: primero busca el claim existente.
  const { data: existing } = await db
    .from("reward_claims")
    .select("claim_code, status, created_at")
    .eq("reward_id", reward.id)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existing) {
    return {
      family_id: familyId,
      family_name: familyName,
      reward_name: reward.name,
      reward_description: reward.description ?? null,
      reward_type: reward.reward_type ?? null,
      claim_code: existing.claim_code,
      status: existing.status,
      created_at: existing.created_at,
      is_first_time: false,
    };
  }

  // Crear el claim. Reintenta en caso de colisión de claim_code (unique).
  for (let attempt = 0; attempt < 5; attempt++) {
    const claimCode = generateClaimCode(familyId);
    const { data: inserted, error } = await db
      .from("reward_claims")
      .insert({
        reward_id: reward.id,
        profile_id: profileId,
        claim_code: claimCode,
      })
      .select("claim_code, status, created_at")
      .single();

    if (!error && inserted) {
      // Contador de claimed_count best-effort (no crítico).
      const { data: rewardRow } = await db
        .from("rewards").select("claimed_count").eq("id", reward.id).maybeSingle();
      await db.from("rewards")
        .update({ claimed_count: (rewardRow?.claimed_count ?? 0) + 1 })
        .eq("id", reward.id);

      return {
        family_id: familyId,
        family_name: familyName,
        reward_name: reward.name,
        reward_description: reward.description ?? null,
        reward_type: reward.reward_type ?? null,
        claim_code: inserted.claim_code,
        status: inserted.status,
        created_at: inserted.created_at,
        is_first_time: true,
      };
    }

    // Si otro request llegó primero (unique en reward_id+profile_id), releemos.
    const errMsg = String((error as any)?.message ?? "");
    const errCode = String((error as any)?.code ?? "");
    if (errCode === "23505") {
      // Puede ser conflicto por (reward_id, profile_id) o por claim_code.
      const { data: raced } = await db
        .from("reward_claims")
        .select("claim_code, status, created_at")
        .eq("reward_id", reward.id)
        .eq("profile_id", profileId)
        .maybeSingle();
      if (raced) {
        return {
          family_id: familyId,
          family_name: familyName,
          reward_name: reward.name,
          reward_description: reward.description ?? null,
          reward_type: reward.reward_type ?? null,
          claim_code: raced.claim_code,
          status: raced.status,
          created_at: raced.created_at,
          is_first_time: false,
        };
      }
      // Si no era ese conflicto, fue colisión de claim_code → reintenta.
      continue;
    }
    console.error("ensureClaimForCompletedFamily insert error", errMsg);
    return null;
  }
  return null;
}
