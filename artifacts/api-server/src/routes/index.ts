import { Router, type IRouter } from "express";
import healthRouter from "./health";
import kukuRouter from "./kuku";

const router: IRouter = Router();

router.use(healthRouter);
router.use(kukuRouter);

export default router;
