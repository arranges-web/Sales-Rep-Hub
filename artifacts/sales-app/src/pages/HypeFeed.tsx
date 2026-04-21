import { useState } from "react";
import {
  useListFeedPosts,
  useCreateFeedPost,
  useToggleHighFive,
  useDeleteFeedPost,
  useListComments,
  useCreateComment,
  useDeleteComment,
  getListFeedPostsQueryKey,
  getListCommentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Hand, MessageCircle, Trash2, Send, Bot, MessageSquareHeart } from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { JTSkeletonCard } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { formatDistanceToNow } from "date-fns";
import { useGetMe } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { PhotoUpload, photoServingUrl } from "@/components/PhotoUpload";

export default function HypeFeedPage() {
  const qc = useQueryClient();
  const { data: posts } = useListFeedPosts();
  const { data: me } = useGetMe();
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const create = useCreateFeedPost();
  const remove = useDeleteFeedPost();
  const hf = useToggleHighFive();

  const submit = async () => {
    if (!content.trim()) return;
    await create.mutateAsync({ data: { content, imageUrl: imageUrl || null } });
    setContent("");
    setImageUrl(null);
    qc.invalidateQueries({ queryKey: getListFeedPostsQueryKey() });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="Hype Feed"
        subtitle="Wins, high-fives, and team energy."
        icon={<MessageSquareHeart className="h-6 w-6" />}
      />

      <Card className="p-4">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share a win, a question, or a shoutout…"
          className="min-h-[80px] rounded-xl"
        />
        <div className="mt-3">
          <PhotoUpload value={imageUrl} onChange={setImageUrl} />
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            onClick={submit}
            disabled={!content.trim() || create.isPending}
            className="rounded-xl bg-[#2EA3F2] hover:bg-[#1d8fd8]"
          >
            <Send className="mr-2 h-4 w-4" /> Post
          </Button>
        </div>
      </Card>

      <div className="space-y-4 jt-fade-in-stagger">
        {posts == null &&
          Array.from({ length: 3 }).map((_, i) => (
            <JTSkeletonCard key={`s${i}`} rows={3} />
          ))}
        {(posts ?? []).map((p) => (
          <Card key={p.id} className="overflow-hidden jt-fade-in">
            <div className="flex items-start gap-3 p-4">
              <div
                className="rounded-full p-[2px] shrink-0"
                style={{
                  background: p.isBot
                    ? "#FFBF00"
                    : p.authorAccentColor || "#2C8214",
                }}
              >
                <Avatar className="h-10 w-10 ring-2 ring-white">
                  <AvatarImage src={p.authorAvatarUrl ? photoServingUrl(p.authorAvatarUrl) ?? p.authorAvatarUrl : undefined} />
                  <AvatarFallback
                    className={p.isBot ? "bg-[#FFBF00] text-slate-900" : "text-white"}
                    style={
                      p.isBot
                        ? undefined
                        : { background: p.authorAccentColor || "#2C8214" }
                    }
                  >
                    {p.isBot ? <Bot className="h-5 w-5" /> : p.authorName.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{p.authorName}</span>
                  {!p.isBot && p.authorLevel != null && (
                    <span className="rounded-full bg-[#2EA3F2]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#2EA3F2]">
                      L{p.authorLevel}
                    </span>
                  )}
                  {p.isBot && (
                    <Badge className="bg-[#FFBF00] text-slate-900">BOT</Badge>
                  )}
                  {p.authorHometown && (
                    <span className="text-xs text-muted-foreground">
                      · {p.authorHometown}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{p.content}</p>
                {p.imageUrl && (
                  <img
                    src={photoServingUrl(p.imageUrl) ?? undefined}
                    alt=""
                    className="mt-3 max-h-80 w-full rounded-xl object-cover"
                  />
                )}
              </div>
              {(me?.role === "admin" || me?.id === p.authorId) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await remove.mutateAsync({ postId: p.id });
                    qc.invalidateQueries({ queryKey: getListFeedPostsQueryKey() });
                  }}
                  className="rounded-full"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1 border-t border-border px-2 py-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn("rounded-xl gap-2", p.hasHighFived && "text-[#2EA3F2]")}
                onClick={async () => {
                  await hf.mutateAsync({ postId: p.id });
                  qc.invalidateQueries({ queryKey: getListFeedPostsQueryKey() });
                }}
              >
                <Hand className={cn("h-4 w-4", p.hasHighFived && "fill-current")} />
                {p.highFiveCount} High Five{p.highFiveCount === 1 ? "" : "s"}
              </Button>
              <CommentToggle postId={p.id} count={p.commentCount} />
            </div>
          </Card>
        ))}
        {posts && posts.length === 0 && (
          <EmptyState
            title="The feed is quiet…"
            description="Close a deal or post a shoutout to kick off the hype."
            icon={<MessageSquareHeart className="h-7 w-7" />}
          />
        )}
      </div>
    </div>
  );
}

function CommentToggle({ postId, count }: { postId: number; count: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="rounded-xl gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <MessageCircle className="h-4 w-4" /> {count} Comment{count === 1 ? "" : "s"}
      </Button>
      {open && <CommentsList postId={postId} />}
    </>
  );
}

function CommentsList({ postId }: { postId: number }) {
  const qc = useQueryClient();
  const { data: comments } = useListComments(postId);
  const { data: me } = useGetMe();
  const [text, setText] = useState("");
  const create = useCreateComment();
  const del = useDeleteComment();

  return (
    <div className="basis-full border-t border-border bg-muted/30 p-3 space-y-3">
      {(comments ?? []).map((c) => (
        <div key={c.id} className="flex items-start gap-2">
          <div
            className="rounded-full p-[1.5px] shrink-0"
            style={{ background: c.authorAccentColor || "#2EA3F2" }}
          >
            <Avatar className="h-7 w-7 ring-2 ring-white">
              <AvatarImage src={c.authorAvatarUrl ? photoServingUrl(c.authorAvatarUrl) ?? c.authorAvatarUrl : undefined} />
              <AvatarFallback
                className="text-white text-xs"
                style={{ background: c.authorAccentColor || "#2EA3F2" }}
              >
                {c.authorName.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 rounded-xl bg-background px-3 py-1.5">
            <div className="text-xs font-semibold">{c.authorName}</div>
            <div className="text-sm">{c.content}</div>
          </div>
          {(me?.role === "admin" || me?.id === c.authorId) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={async () => {
                await del.mutateAsync({ postId, commentId: c.id });
                qc.invalidateQueries({ queryKey: getListCommentsQueryKey(postId) });
                qc.invalidateQueries({ queryKey: getListFeedPostsQueryKey() });
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2EA3F2]/30"
          onKeyDown={async (e) => {
            if (e.key === "Enter" && text.trim()) {
              await create.mutateAsync({ postId, data: { content: text } });
              setText("");
              qc.invalidateQueries({ queryKey: getListCommentsQueryKey(postId) });
              qc.invalidateQueries({ queryKey: getListFeedPostsQueryKey() });
            }
          }}
        />
        <Button
          size="sm"
          className="rounded-xl bg-[#2EA3F2]"
          disabled={!text.trim()}
          onClick={async () => {
            await create.mutateAsync({ postId, data: { content: text } });
            setText("");
            qc.invalidateQueries({ queryKey: getListCommentsQueryKey(postId) });
            qc.invalidateQueries({ queryKey: getListFeedPostsQueryKey() });
          }}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
