import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · CareerOS AI" }] }),
  component: Settings,
});

function Settings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setEmail(u.user?.email ?? "");
      if (u.user) {
        const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
        setProfile(data ?? { id: u.user.id, full_name: "", headline: "", target_role: "" });
      }
    })();
  }, []);

  async function saveProfile() {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name, headline: profile.headline, target_role: profile.target_role,
    }).eq("id", profile.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  }

  async function updatePassword() {
    if (pw.length < 6) return toast.error("Password too short");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) toast.error(error.message); else { toast.success("Password updated"); setPw(""); }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!profile) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader title="Settings" description="Manage your profile, security, and account." />
      <div className="grid lg:grid-cols-2 gap-4 max-w-4xl">
        <Card>
          <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5"><Label>Email</Label><Input value={email} disabled /></div>
            <div className="space-y-1.5"><Label>Full name</Label><Input value={profile.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Headline</Label><Input value={profile.headline ?? ""} onChange={(e) => setProfile({ ...profile, headline: e.target.value })} placeholder="Senior Frontend Engineer · React/TS" /></div>
            <div className="space-y-1.5"><Label>Target role</Label><Input value={profile.target_role ?? ""} onChange={(e) => setProfile({ ...profile, target_role: e.target.value })} /></div>
            <Button onClick={saveProfile} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : "Save profile"}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Security</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5"><Label>New password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
            <Button variant="outline" onClick={updatePassword}>Update password</Button>
            <div className="pt-4 border-t border-border" />
            <div>
              <h4 className="text-sm font-semibold">Sign out</h4>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">Sign out of this device.</p>
              <Button variant="outline" onClick={signOut}>Sign out</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
