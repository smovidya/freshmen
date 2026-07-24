import z from "zod/v4";

export const TICKETED_GAME_TYPES = ["puzzle", "precision", "wheel", "quiz"] as const;
export const GAME_TYPES = [...TICKETED_GAME_TYPES, "mystery_box"] as const;

export const puzzleSubmitSchema = z.object({
  playToken: z.string().uuid(),
  x: z.number(),
  y: z.number(),
});

export const precisionSubmitSchema = z.object({
  playToken: z.string().uuid(),
});

export const wheelPlaySchema = z.object({});

export const quizSubmitSchema = z.object({
  playToken: z.string().uuid(),
  answers: z
    .array(
      z.object({
        questionId: z.string(),
        choiceIndex: z.number().int().min(0).max(3),
      }),
    )
    .length(3),
});

export const mysteryBoxOpenSchema = z.object({});
