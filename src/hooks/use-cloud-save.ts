import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import type { Json } from "@/integrations/supabase/types";

export type CloudStatus = "off" | "syncing" | "saved" | "error";

/** 구글 계정에 리그 저장을 동기화한다. 로그인 시 클라우드 저장이 있으면 불러오고, 없으면 현재 기기 저장을 올린다. */
export function useCloudSave<T>(data: T | null, loaded: boolean, onRemote: (d: T) => void) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<CloudStatus>("off");
  const [synced, setSynced] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;
  const remoteRef = useRef(onRemote);
  remoteRef.current = onRemote;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: s }) => setUser(s.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "INITIAL_SESSION") return;
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 로그인 직후 1회 동기화
  useEffect(() => {
    setSynced(false);
    if (!user || !loaded) { setStatus("off"); return; }
    let cancelled = false;
    setStatus("syncing");
    (async () => {
      const { data: row, error } = await supabase.from("league_saves").select("data").eq("user_id", user.id).maybeSingle();
      if (cancelled) return;
      if (error) { setStatus("error"); return; }
      if (row?.data) remoteRef.current(row.data as unknown as T);
      else if (dataRef.current) {
        const { error: e2 } = await supabase.from("league_saves").upsert({ user_id: user.id, data: dataRef.current as unknown as Json, updated_at: new Date().toISOString() });
        if (cancelled) return;
        if (e2) { setStatus("error"); return; }
      }
      setStatus("saved");
      setSynced(true);
    })();
    return () => { cancelled = true; };
  }, [user, loaded]);

  // 변경 시 자동 저장 (1.2초 지연)
  useEffect(() => {
    if (!user || !synced) return;
    setStatus("syncing");
    const t = setTimeout(async () => {
      const q = data
        ? supabase.from("league_saves").upsert({ user_id: user.id, data: data as unknown as Json, updated_at: new Date().toISOString() })
        : supabase.from("league_saves").delete().eq("user_id", user.id);
      const { error } = await q;
      setStatus(error ? "error" : "saved");
    }, 1200);
    return () => clearTimeout(t);
  }, [data, user, synced]);

  const signIn = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setStatus("error");
  };
  const signOut = async () => { await supabase.auth.signOut(); };
  return { user, status, signIn, signOut };
}
