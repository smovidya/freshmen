import { and, eq, inArray, sql } from "drizzle-orm";
import { tables, type Db } from "@vidyafreshmen/db";
import { creditPoints } from "../points.service";
import { consumeTicket } from "./tickets";

const QUESTIONS_PER_PLAY = 3;

export async function start(userId: string, db: Db) {
  const ticketId = await consumeTicket(userId, "quiz", db);

  const questions = await db
    .select({
      id: tables.quizQuestions.id,
      questionText: tables.quizQuestions.questionText,
      choices: tables.quizQuestions.choices,
    })
    .from(tables.quizQuestions)
    .where(eq(tables.quizQuestions.isActive, true))
    .orderBy(sql`RANDOM()`)
    .limit(QUESTIONS_PER_PLAY);

  if (questions.length < QUESTIONS_PER_PLAY) {
    throw new Error("คำถามไม่เพียงพอ กรุณาติดต่อเจ้าหน้าที่");
  }

  const playToken = crypto.randomUUID();

  await db.insert(tables.minigamePlays).values({
    userId,
    gameType: "quiz",
    ticketId,
    playToken,
    serverState: JSON.stringify({ questionIds: questions.map((q) => q.id) }),
  });

  return {
    playToken,
    questions: questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      choices: JSON.parse(q.choices) as string[],
    })),
  };
}

export async function submit(
  input: {
    userId: string;
    ouid: string;
    playToken: string;
    answers: { questionId: string; choiceIndex: number }[];
  },
  db: Db,
) {
  const [play] = await db
    .update(tables.minigamePlays)
    .set({ status: "submitted", submittedAt: new Date() })
    .where(
      and(
        eq(tables.minigamePlays.playToken, input.playToken),
        eq(tables.minigamePlays.userId, input.userId),
        eq(tables.minigamePlays.status, "started"),
      ),
    )
    .returning({ id: tables.minigamePlays.id, serverState: tables.minigamePlays.serverState });

  if (!play) throw new Error("การเล่นนี้ไม่ถูกต้องหรือถูกส่งไปแล้ว");

  const { questionIds } = JSON.parse(play.serverState!) as { questionIds: string[] };
  const answersByQuestion = new Map(input.answers.map((a) => [a.questionId, a.choiceIndex]));

  const questions = await db
    .select({
      id: tables.quizQuestions.id,
      correctChoiceIndex: tables.quizQuestions.correctChoiceIndex,
      points: tables.quizQuestions.points,
    })
    .from(tables.quizQuestions)
    .where(inArray(tables.quizQuestions.id, questionIds));

  let points = 0;
  let correctCount = 0;
  for (const question of questions) {
    const submittedChoice = answersByQuestion.get(question.id);
    if (submittedChoice === question.correctChoiceIndex) {
      points += question.points;
      correctCount += 1;
    }
  }

  await db
    .update(tables.minigamePlays)
    .set({ resultPayload: JSON.stringify({ correctCount }), pointsAwarded: points })
    .where(eq(tables.minigamePlays.id, play.id));

  await creditPoints(db, {
    userId: input.userId,
    ouid: input.ouid,
    amount: points,
    source: "minigame:quiz",
    refId: play.id,
  });

  return { correctCount, points };
}
