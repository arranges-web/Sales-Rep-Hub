import { useEffect, useState } from "react";
import {
  useGetMe,
  useUpdateMyProfile,
  getGetMeQueryKey,
  getGetLeaderboardQueryKey,
  getListFeedPostsQueryKey,
  getListPinsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PhotoUpload } from "@/components/PhotoUpload";
import { AvatarRing } from "@/components/AvatarRing";
import { useToast } from "@/hooks/use-toast";
import { Save, Palette, UserCircle } from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { cn } from "@/lib/utils";

const PALETTE = [
  "#2EA3F2", // JT blue
  "#2C8214", // JT green
  "#FFBF00", // JT gold
  "#E11D48", // rose
  "#7C3AED", // violet
  "#0EA5E9", // sky
  "#059669", // emerald
  "#F97316", // orange
  "#0F172A", // slate
];

const SERVICE_OPTIONS = [
  "Large Tree Removal",
  "Trimming & Pruning",
  "Stump Grinding",
  "Storm Cleanup",
  "Palm Care",
  "Other",
];

export default function ProfilePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const update = useUpdateMyProfile();

  const [form, setForm] = useState({
    name: "",
    avatarUrl: null as string | null,
    accentColor: "#2EA3F2",
    hometown: "",
    bio: "",
    hawaiiGoal: "",
    favoriteService: "",
  });

  useEffect(() => {
    if (!me) return;
    setForm({
      name: me.name ?? "",
      avatarUrl: me.avatarUrl ?? null,
      accentColor: me.accentColor ?? "#2EA3F2",
      hometown: me.hometown ?? "",
      bio: me.bio ?? "",
      hawaiiGoal: me.hawaiiGoal ?? "",
      favoriteService: me.favoriteService ?? "",
    });
  }, [me]);

  const save = async () => {
    await update.mutateAsync({
      data: {
        name: form.name.trim() || me?.name || "Rep",
        avatarUrl: form.avatarUrl,
        accentColor: form.accentColor,
        hometown: form.hometown || null,
        bio: form.bio || null,
        hawaiiGoal: form.hawaiiGoal || null,
        favoriteService: form.favoriteService || null,
      },
    });
    qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    qc.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
    qc.invalidateQueries({ queryKey: getListFeedPostsQueryKey() });
    qc.invalidateQueries({ queryKey: getListPinsQueryKey() });
    qc.invalidateQueries({
      predicate: (q) => {
        const k = q.queryKey?.[0];
        return typeof k === "string" && k.startsWith("/api/feed/") && k.endsWith("/comments");
      },
    });
    toast({ title: "Profile saved", description: "Your touches are live across the app." });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="My Profile"
        subtitle="Make this account yours — your team will see these touches everywhere."
        icon={<UserCircle className="h-6 w-6" />}
      />

      <Card
        className="overflow-hidden border-0 p-6 text-white shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${form.accentColor}, #2C8214)`,
        }}
      >
        <div className="flex items-center gap-4">
          <AvatarRing
            src={form.avatarUrl ?? me?.avatarUrl}
            name={form.name || "R"}
            accentColor="#ffffff"
            size={72}
          />
          <div className="min-w-0">
            <div className="text-xl font-extrabold">{form.name || "Your name"}</div>
            <div className="text-sm opacity-90">{form.hometown || "Add your hometown"}</div>
            {form.hawaiiGoal && (
              <div className="mt-1 text-sm">🌺 {form.hawaiiGoal}</div>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-5 p-5">
        <div>
          <Label>Avatar photo</Label>
          <div className="mt-2">
            <PhotoUpload
              value={form.avatarUrl}
              onChange={(p) => setForm({ ...form, avatarUrl: p })}
              capture={false}
            />
          </div>
        </div>

        <div>
          <Label>Display name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 rounded-xl"
            placeholder="Jane Rep"
          />
        </div>

        <div>
          <Label className="flex items-center gap-2">
            <Palette className="h-4 w-4" /> Accent color
          </Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Pick color ${c}`}
                onClick={() => setForm({ ...form, accentColor: c })}
                className={cn(
                  "h-9 w-9 rounded-full border-2 transition-transform",
                  form.accentColor === c
                    ? "scale-110 border-slate-900 shadow-md"
                    : "border-white shadow-sm hover:scale-105",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Hometown</Label>
            <Input
              value={form.hometown}
              onChange={(e) => setForm({ ...form, hometown: e.target.value })}
              placeholder="Fort Myers, FL"
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <Label>Favorite service line</Label>
            <select
              value={form.favoriteService}
              onChange={(e) => setForm({ ...form, favoriteService: e.target.value })}
              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2EA3F2]/30"
            >
              <option value="">—</option>
              {SERVICE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label>Hawaii goal</Label>
          <Input
            value={form.hawaiiGoal}
            onChange={(e) => setForm({ ...form, hawaiiGoal: e.target.value })}
            placeholder="Surfing Waikiki with the family in December"
            maxLength={140}
            className="mt-1 rounded-xl"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Why you're chasing Points to Paradise.
          </p>
        </div>

        <div>
          <Label>Bio</Label>
          <Textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Born and raised in SWFL. Climber turned closer."
            maxLength={280}
            className="mt-1 min-h-[88px] rounded-xl"
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={save}
            disabled={update.isPending}
            className="rounded-xl bg-[#2EA3F2] hover:bg-[#1d8fd8]"
          >
            <Save className="mr-2 h-4 w-4" />
            {update.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
