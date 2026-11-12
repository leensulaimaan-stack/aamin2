import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET } from "./constants";

export type Me = {
  id: string;
  email?: string | undefined;
  profile: {
    id: string;
    full_name: string;
    team_id: string | null;
    is_active: boolean;
    email: string | null;
    teams?: { name: string } | null;
  } | null;
  roles: string[];
  isAdmin: boolean;
  isManager: boolean;
  /** manager or admin */
  isStaff: boolean;
  isMember: boolean;
  teamId: string | null;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, team_id, is_active, email, teams!profiles_team_id_fkey(name)")
          .eq("id", u.user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      const r = (roles ?? []).map((x) => x.role as string);
      const isAdmin = r.includes("admin");
      const isManager = r.includes("manager");
      return {
        id: u.user.id,
        email: u.user.email,
        profile: profile as Me["profile"],
        roles: r,
        isAdmin,
        isManager,
        isStaff: isAdmin || isManager,
        isMember: r.length > 0 && !!profile?.is_active,
        teamId: profile?.team_id ?? null,
      };
    },
    staleTime: 60_000,
  });
}

export async function signedPhotoUrls(paths: string[]) {
  const clean = paths.filter(Boolean);
  if (!clean.length) return [];
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(clean, 3600);
  return (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
}

export async function compressImage(file: File, max = 1600, quality = 0.8): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", quality));
  } catch {
    return file;
  }
}

/** Upload photos to the private bucket under <uid>/<folder>/… and return their paths. */
export async function uploadPhotos(uid: string, folder: string, files: File[]): Promise<string[]> {
  const out: string[] = [];
  for (const f of files) {
    const blob = f.type.startsWith("image/") ? await compressImage(f) : f;
    const ext = f.type.startsWith("image/") ? "jpg" : (f.name.split(".").pop() ?? "bin");
    const path = `${uid}/${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, blob, { contentType: f.type.startsWith("image/") ? "image/jpeg" : f.type });
    if (error) throw new Error("تعذّر رفع الملف، تحقق من الاتصال وحاول مرة أخرى.");
    out.push(path);
  }
  return out;
}

/** Turn a Postgres/Supabase error into a readable Arabic message. */
export function errMsg(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/row-level security|permission denied|غير مصرح/i.test(m))
    return "لا تملك صلاحية تنفيذ هذا الإجراء.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "لا يوجد اتصال بالإنترنت. حاول مرة أخرى.";
  return m;
}
