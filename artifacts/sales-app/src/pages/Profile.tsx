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
import { Save, Palette, UserCircle, Target } from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { cn } from "@/lib/utils";

const PALETTE = [
  "#2EA3F2", "#2C8214", "#FFBF00",
  "#E11D48", "#7C3AED", "#0EA5E9",
  "#059669", "#F97316", "#475569",
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
    toast({ title: "Profile saved" });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="My Profile"
        subtitle="Make this account yours — your team sees these touches everywhere."
        icon={<UserCircle className="h-6 w-6" strokeWidth={1.5} />}
        accent={form.accentColor}
      />

      {/* Live preview card — flat dark with thin accent */}
      <Card
        className="relative overflow-hidden border-border bg-card p-5"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${form.accentColor}, transparent)`,
          }}
        />
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
          style={{ background: form.accentColor }} />
        <div className="relative flex items-center gap-4">
          <AvatarRing
            src={form.avatarUrl ?? me?.avatarUrl}
            name={form.name || "R"}
            accentColor={form.accentColor}
            size={64}
          />
          <div className="min-w-0">
            <div className="text-xl font-bold text-foreground">
              {form.name || "Your name"}
            </div>
            <div className="text-sm text-muted-foreground">
              {form.hometown || "Add your hometown"}
            </div>
            {form.hawaiiGoal && (
              <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-foreground/80">
                <Target className="h-3.5 w-3.5 text-[#FFBF00]" strokeWidth={1.75} />
                {form.hawaiiGoal}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-5 border-border bg-card p-5">
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
            className="mt-1 rounded-lg"
            placeholder="Jordan Rep"
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
                  "h-9 w-9 rounded-md border-2 transition-transform",
                  form.accentColor === c
                    ? "scale-105 border-foreground/80"
                    : "border-border hover:scale-105 hover:border-foreground/30",
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
              className="mt-1 rounded-lg"
            />
          </div>
          <div>
            <Label>Favorite service line</Label>
            <select
              value={form.favoriteService}
              onChange={(e) => setForm({ ...form, favoriteService: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2EA3F2]/30"
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
          <Label>Big-trip goal</Label>
          <Input
            value={form.hawaiiGoal}
            onChange={(e) => setForm({ ...form, hawaiiGoal: e.target.value })}
            placeholder="Surfing the North Shore in December"
            maxLength={140}
            className="mt-1 rounded-lg"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            What you're chasing for the top-tier trip prize.
          </p>
        </div>

        <div>
          <Label>Bio</Label>
          <Textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Born and raised in SWFL. Climber turned closer."
            maxLength={280}
            className="mt-1 min-h-[88px] rounded-lg"
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={save}
            disabled={update.isPending}
            className="rounded-lg bg-[#2EA3F2] text-slate-950 hover:bg-[#48b3f6]"
          >
            <Save className="mr-2 h-4 w-4" />
            {update.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
