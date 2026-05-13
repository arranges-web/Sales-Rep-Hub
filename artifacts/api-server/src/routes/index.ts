import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import dealsRouter from "./deals";
import leaderboardRouter from "./leaderboard";
import feedRouter from "./feed";
import pinsRouter from "./pins";
import territoriesRouter from "./territories";
import rewardsRouter from "./rewards";
import badgesRouter from "./badges";
import adminRouter from "./admin";
import storageRouter from "./storage";
import coachRouter from "./coach";
import campaignsRouter from "./campaigns";
import messagesRouter from "./messages";

const router: IRouter = Router();

router.use(storageRouter);
router.use(healthRouter);
router.use(usersRouter);
router.use(dealsRouter);
router.use(leaderboardRouter);
router.use(feedRouter);
router.use(pinsRouter);
router.use(territoriesRouter);
router.use(rewardsRouter);
router.use(badgesRouter);
router.use(adminRouter);
router.use(coachRouter);
router.use(campaignsRouter);
router.use(messagesRouter);

export default router;
