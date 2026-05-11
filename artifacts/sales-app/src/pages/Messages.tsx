import { useEffect, useMemo, useRef, useState } from "react";
import {
  useListConversations,
  useCreateConversation,
  useListMessages,
  useSendMessage,
  useMarkConversationRead,
  useListUsers,
  useGetMe,
  getListConversationsQueryKey,
  getListMessagesQueryKey,
  type Conversation,
  type ConversationMemberSummary,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Send,
  Plus,
  Users,
  Search,
  ChevronLeft,
} from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { AvatarRing } from "@/components/AvatarRing";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const POLL_MS = 5_000;

function conversationLabel(
  c: Conversation,
  meId: number | undefined,
): { title: string; members: ConversationMemberSummary[] } {
  const others = c.members.filter((m) => m.userId !== meId);
  if (c.type === "dm") {
    const o = others[0];
    return { title: o?.name ?? "Direct message", members: others };
  }
  if (c.name) return { title: c.name, members: others };
  const names = others.slice(0, 3).map((m) => m.name.split(" ")[0]);
  const more = others.length > 3 ? ` +${others.length - 3}` : "";
  return { title: names.join(", ") + more, members: others };
}

export default function MessagesPage() {
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const { data: conversations, isLoading: convosLoading } = useListConversations({
    query: {
      queryKey: getListConversationsQueryKey(),
      refetchInterval: POLL_MS,
    },
  });
  const { data: users } = useListUsers();
  const createConvo = useCreateConversation();
  const send = useSendMessage();
  const markRead = useMarkConversationRead();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [newDialog, setNewDialog] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [pickedIds, setPickedIds] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-select first conversation when list arrives
  useEffect(() => {
    if (selectedId == null && conversations && conversations.length > 0) {
      setSelectedId(conversations[0]!.id);
    }
  }, [conversations, selectedId]);

  const { data: messages } = useListMessages(selectedId ?? 0, {
    query: {
      queryKey: getListMessagesQueryKey(selectedId ?? 0),
      enabled: selectedId != null,
      refetchInterval: selectedId != null ? POLL_MS : false,
    },
  });

  // Mark read whenever messages load for the selected convo
  useEffect(() => {
    if (selectedId == null) return;
    markRead.mutate(
      { conversationId: selectedId },
      {
        onSuccess: () =>
          qc.invalidateQueries({ queryKey: getListConversationsQueryKey() }),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, messages?.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages?.length, send.isPending]);

  const selectedConvo = useMemo(
    () => conversations?.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const totalUnread = useMemo(
    () =>
      (conversations ?? []).reduce(
        (sum, c) => sum + (c.id === selectedId ? 0 : c.unreadCount),
        0,
      ),
    [conversations, selectedId],
  );

  const eligibleUsers = useMemo(
    () =>
      (users ?? [])
        .filter((u) => u.id !== me?.id)
        .filter((u) =>
          u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.email.toLowerCase().includes(userSearch.toLowerCase()),
        ),
    [users, me?.id, userSearch],
  );

  const handleSend = async () => {
    if (!selectedId || !draft.trim() || send.isPending) return;
    await send.mutateAsync({
      conversationId: selectedId,
      data: { content: draft.trim() },
    });
    setDraft("");
    qc.invalidateQueries({ queryKey: getListMessagesQueryKey(selectedId) });
    qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
  };

  const handleStartConversation = async (type: "dm" | "group") => {
    if (pickedIds.length === 0) return;
    if (type === "dm" && pickedIds.length !== 1) return;
    const c = await createConvo.mutateAsync({
      data: {
        type,
        memberIds: pickedIds,
        name: type === "group" ? (groupName.trim() || null) : null,
      },
    });
    setNewDialog(false);
    setPickedIds([]);
    setGroupName("");
    setUserSearch("");
    setSelectedId(c.id);
    qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
  };

  const newConvoType: "dm" | "group" = pickedIds.length > 1 ? "group" : "dm";

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <BrandHeader
        title="Messages"
        subtitle={
          totalUnread > 0
            ? `${totalUnread} unread`
            : "Private chats and team rooms with your crew."
        }
        icon={<MessageSquare className="h-6 w-6" strokeWidth={1.5} />}
        actions={
          <Button
            size="sm"
            onClick={() => setNewDialog(true)}
            className="rounded-lg bg-[#2EA3F2] text-slate-950 hover:bg-[#48b3f6]"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> New chat
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="grid h-[68vh] min-h-[480px] grid-cols-1 md:grid-cols-[300px_1fr]">
          {/* Sidebar — hidden on mobile when a chat is open */}
          <aside
            className={cn(
              "flex flex-col border-r border-border bg-background/40",
              selectedId != null && "hidden md:flex",
            )}
          >
            <div className="border-b border-border p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Conversations
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {convosLoading && (
                <div className="p-4 text-sm text-muted-foreground">Loading…</div>
              )}
              {!convosLoading && (conversations?.length ?? 0) === 0 && (
                <div className="p-4 text-sm text-muted-foreground">
                  No conversations yet. Tap "New chat" to start one.
                </div>
              )}
              {conversations?.map((c) => {
                const { title, members } = conversationLabel(c, me?.id);
                const active = c.id === selectedId;
                const avatar = members[0];
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-border/60 p-3 text-left transition-colors",
                      active
                        ? "bg-[#2EA3F2]/10"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <div className="relative">
                      {c.type === "group" ? (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#2EA3F2]/30 to-[#2C8214]/30 text-[#2EA3F2]">
                          <Users className="h-4 w-4" />
                        </div>
                      ) : (
                        <AvatarRing
                          src={avatar?.avatarUrl ?? null}
                          name={avatar?.name ?? "?"}
                          accentColor={avatar?.accentColor ?? null}
                          size={36}
                        />
                      )}
                      {c.unreadCount > 0 && !active && (
                        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#2EA3F2] px-1 text-[10px] font-bold text-slate-950">
                          {c.unreadCount > 9 ? "9+" : c.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {title}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(c.lastMessageAt), {
                            addSuffix: false,
                          })}
                        </span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.lastMessagePreview ?? (c.type === "group" ? "Group chat" : "Direct message")}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Conversation pane */}
          <section
            className={cn(
              "flex flex-col bg-background/20",
              selectedId == null && "hidden md:flex",
            )}
          >
            {selectedConvo ? (
              <>
                <header className="flex items-center gap-2 border-b border-border bg-card/50 p-3 backdrop-blur">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setSelectedId(null)}
                    aria-label="Back"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {selectedConvo.type === "group" ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#2EA3F2]/30 to-[#2C8214]/30 text-[#2EA3F2]">
                      <Users className="h-4 w-4" />
                    </div>
                  ) : (
                    <AvatarRing
                      src={selectedConvo.members[0]?.avatarUrl ?? null}
                      name={selectedConvo.members[0]?.name ?? "?"}
                      accentColor={selectedConvo.members[0]?.accentColor ?? null}
                      size={36}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-sm text-foreground">
                      {conversationLabel(selectedConvo, me?.id).title}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {selectedConvo.type === "group"
                        ? `${selectedConvo.members.length} members`
                        : "Direct message"}
                    </div>
                  </div>
                </header>

                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                  {(messages ?? []).map((m, i, arr) => {
                    const mine = m.authorId === me?.id;
                    const prev = arr[i - 1];
                    const showAuthor =
                      !mine &&
                      (!prev || prev.authorId !== m.authorId) &&
                      selectedConvo.type === "group";
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "flex flex-col",
                          mine ? "items-end" : "items-start",
                        )}
                      >
                        {showAuthor && (
                          <div className="mb-0.5 ml-1 text-[11px] font-semibold text-muted-foreground">
                            {m.authorName}
                          </div>
                        )}
                        <div
                          className={cn(
                            "max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
                            mine
                              ? "rounded-br-md bg-[#2EA3F2] text-slate-950"
                              : "rounded-bl-md bg-card border border-border text-foreground",
                          )}
                        >
                          {m.content}
                        </div>
                        <div
                          className={cn(
                            "mt-0.5 px-1 text-[10px] text-muted-foreground",
                            mine ? "text-right" : "text-left",
                          )}
                        >
                          {formatDistanceToNow(new Date(m.createdAt), {
                            addSuffix: true,
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {(messages?.length ?? 0) === 0 && (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No messages yet — say hi.
                    </div>
                  )}
                </div>

                <form
                  className="border-t border-border bg-card/50 p-3 backdrop-blur"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                >
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type a message…"
                      rows={1}
                      className="min-h-[44px] resize-none rounded-xl"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-xl bg-[#2EA3F2] hover:bg-[#1d8fd8]"
                      disabled={!draft.trim() || send.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                <div>
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 text-[#2EA3F2]" />
                  <p>Pick a conversation, or start a new one.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </Card>

      {/* New chat dialog */}
      <Dialog
        open={newDialog}
        onOpenChange={(o) => {
          setNewDialog(o);
          if (!o) {
            setPickedIds([]);
            setGroupName("");
            setUserSearch("");
          }
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {newConvoType === "group" ? "Start a group chat" : "Start a chat"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {newConvoType === "group" && (
              <div>
                <Label>Group name (optional)</Label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Pest Crew, SWFL Closers, …"
                  className="rounded-xl"
                />
              </div>
            )}
            <div>
              <Label>Add people</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search reps…"
                  className="rounded-xl pl-9"
                />
              </div>
              {pickedIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pickedIds.map((id) => {
                    const u = users?.find((x) => x.id === id);
                    if (!u) return null;
                    return (
                      <Badge
                        key={id}
                        className="cursor-pointer rounded-full bg-[#2EA3F2]/15 px-2 py-0.5 text-[#2EA3F2] hover:bg-[#2EA3F2]/25"
                        onClick={() =>
                          setPickedIds((s) => s.filter((x) => x !== id))
                        }
                      >
                        {u.name} ×
                      </Badge>
                    );
                  })}
                </div>
              )}
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border">
                {eligibleUsers.map((u) => {
                  const picked = pickedIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() =>
                        setPickedIds((s) =>
                          picked ? s.filter((x) => x !== u.id) : [...s, u.id],
                        )
                      }
                      className={cn(
                        "flex w-full items-center gap-2 border-b border-border/60 p-2 text-left text-sm last:border-b-0 hover:bg-muted/40",
                        picked && "bg-[#2EA3F2]/10",
                      )}
                    >
                      <AvatarRing
                        src={u.avatarUrl ?? null}
                        name={u.name}
                        accentColor={u.accentColor}
                        size={28}
                      />
                      <span className="flex-1 truncate font-medium">{u.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {u.email}
                      </span>
                    </button>
                  );
                })}
                {eligibleUsers.length === 0 && (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    No matches.
                  </div>
                )}
              </div>
            </div>
            <Button
              className="w-full rounded-xl bg-[#2EA3F2] hover:bg-[#1d8fd8]"
              disabled={pickedIds.length === 0 || createConvo.isPending}
              onClick={() => handleStartConversation(newConvoType)}
            >
              {newConvoType === "group"
                ? `Start group with ${pickedIds.length}`
                : pickedIds.length
                  ? "Start chat"
                  : "Pick someone"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
