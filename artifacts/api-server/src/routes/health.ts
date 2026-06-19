import { Router } from "express";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();

router.get("/healthz", (_req: any, res: any) => {
  res.json({ status: "ok" });
});

export default router;
