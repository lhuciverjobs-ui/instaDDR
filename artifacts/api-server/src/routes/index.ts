import { Router, type IRouter } from "express";
import authRouter, { requireAuth } from "./auth";
import healthRouter from "./health";
import kukuRouter from "./kuku";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireAuth);
router.use(kukuRouter);

export default router;
