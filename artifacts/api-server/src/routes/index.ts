import { Router } from "express";
import healthRouter from "./health.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();

router.use(healthRouter);

export default router;
