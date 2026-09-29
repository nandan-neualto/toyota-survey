import { z } from "zod";
import { languageCodes } from "./languages";
export const highlights = ["History & heritage", "Products & technology", "Manufacturing & innovation", "Interactive displays", "Overall presentation", "Other"] as const;
export const ratingLabels = ["Very poor", "Poor", "Average", "Good", "Excellent"];
export const feedbackSchema = z.object({
  id: z.string().uuid(), kioskId: z.string().min(1).max(80), kioskName: z.string().min(1).max(60),
  surveyVersion: z.literal(1), language: z.enum(languageCodes), createdAt: z.string().datetime(),
  overall: z.number().int().min(1).max(5), presentation: z.number().int().min(1).max(5).nullable(),
  informative: z.number().int().min(1).max(4).nullable(), highlights: z.array(z.enum(highlights)).max(6),
  other: z.string().max(120), recommendation: z.enum(["yes", "maybe", "no"]).nullable(), comment: z.string().max(500),
}).strict();
export type Feedback = z.infer<typeof feedbackSchema>;
export type Answers = Pick<Feedback, "overall" | "presentation" | "informative" | "highlights" | "other" | "recommendation" | "comment">;
export const emptyAnswers: Answers = { overall: 0, presentation: null, informative: null, highlights: [], other: "", recommendation: null, comment: "" };
