import { useCallback } from "react";
import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";
import {
  playBadgeSfx,
  playDealSfx,
  playLevelUpSfx,
} from "@/lib/sound";

const JT_COLORS = ["#2EA3F2", "#2C8214", "#FFBF00", "#ffffff"];

interface DealCelebration {
  pointsAwarded: number;
  customerName?: string;
}

interface BadgeCelebration {
  label: string;
  description?: string;
}

interface LevelUpCelebration {
  levelAfter: number;
}

export function useCelebrate() {
  const { toast } = useToast();

  const dealClosed = useCallback(
    (opts: DealCelebration) => {
      playDealSfx();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: JT_COLORS,
        scalar: 0.9,
      });
      toast({
        title: `+${opts.pointsAwarded.toLocaleString()} points!`,
        description: opts.customerName
          ? `Great close on ${opts.customerName}.`
          : "Another deal in the books.",
      });
    },
    [toast],
  );

  const badgeEarned = useCallback(
    (opts: BadgeCelebration) => {
      playBadgeSfx();
      confetti({
        particleCount: 40,
        spread: 50,
        startVelocity: 30,
        origin: { y: 0.5 },
        colors: ["#FFBF00", "#2EA3F2", "#ffffff"],
        scalar: 0.8,
      });
      toast({
        title: `Badge unlocked — ${opts.label}`,
        description: opts.description,
      });
    },
    [toast],
  );

  const levelUp = useCallback(
    (opts: LevelUpCelebration) => {
      playLevelUpSfx();
      // Big fireworks: two simultaneous bursts from the corners.
      const burst = (xOrigin: number) => {
        confetti({
          particleCount: 120,
          spread: 90,
          startVelocity: 45,
          origin: { x: xOrigin, y: 0.7 },
          colors: JT_COLORS,
          scalar: 1.1,
        });
      };
      burst(0.2);
      burst(0.8);
      setTimeout(() => burst(0.5), 250);
      toast({
        title: `Level ${opts.levelAfter} unlocked.`,
        description: "You leveled up. Keep the streak going.",
      });
    },
    [toast],
  );

  const redemptionApproved = useCallback(
    (rewardName: string) => {
      playBadgeSfx();
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.5 },
        colors: JT_COLORS,
      });
      toast({
        title: `${rewardName} approved.`,
        description: "Check with admin to claim your reward.",
      });
    },
    [toast],
  );

  return { dealClosed, badgeEarned, levelUp, redemptionApproved };
}
