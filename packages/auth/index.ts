import { schema, tables } from "@vidyafreshmen/db";
import { FeatureFlags } from "@vidyafreshmen/flags";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins/jwt";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export const createAuth = ({ env }: { env: any }) => {
  const db = drizzle(env.DB, {
    schema: schema,
  });

  const isDev = env.WORKER_ENV !== "production";

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
    }),
    logger: {
      level: "info",
    },
    appName: "Science Freshmen Fest 69",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
    databaseHooks: {
      user: {
        create: {
          async before(user, context) {
            if (user.email.endsWith("@student.chula.ac.th")) {
              const ouid = user.email.split("@")[0];

              // Limited to science freshmen only
              if (!ouid?.endsWith("23")) {
                console.error(
                  `[auth] Error: science-students-only ouid:${ouid} ${JSON.stringify(user)}`,
                );
                throw context?.error("FORBIDDEN", {
                  code: "science-students-only",
                  message: "การลงทะเบียนนี้สำหรับนิสิตคณะวิทยาศาสตร์เท่านั้น",
                });
              }

              // if (ouid.startsWith('69')) {
              // 	console.error(`[auth] Error: freshmen-only ouid:${ouid} ${JSON.stringify(user)}`)
              // 	throw context?.error("FORBIDDEN", {
              // 		code: 'freshmen-only',
              // 		message: 'การลงทะเบียนนี้สำหรับนิสิตชั้นปีที่ 1 เท่านั้น หากคุณเป็นนิสิตชั้นปีที่ 1 โปรดติดต่อ https://www.instagram.com/smovidya_official/',
              // 	});
              // }

              return {
                data: {
                  ...user,
                  ouid: ouid,
                },
              };
            }

            console.error(
              `[auth] Error: invalid-email ${JSON.stringify(user)}`,
            );
            throw context?.error("FORBIDDEN", {
              code: "invalid-email",
              message:
                "ระบบนี้สามารถเข้าสู่ระบบได้เฉพาะนิสิตเท่านั้น (@student.chula.ac.th)",
            });
          },
        },
      },
    },
    emailAndPassword: {
      enabled: false,
      signUp: {
        enabled: true,
        fields: ["email", "password"],
      },
      signIn: {
        enabled: true,
        fields: ["email", "password"],
      },
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID as string,
        clientSecret: env.GOOGLE_CLIENT_SECRET as string,
        hd: "student.chula.ac.th",
      },
    },
    user: {
      additionalFields: {
        ouid: {
          type: "string",
          label: "OUID",
          unique: true,
          input: false,
        },
        group: {
          type: "string",
          label: "Group",
          unique: false,
          input: false,
        },
      },
    },
    plugins: [jwt()],
    rateLimit: {
      storage: "database",
    },
    onAPIError: {
      errorURL: `/auth/error`, // wtf why dont this work
    },
    trustedOrigins(request) {
      return [
        env.FRONTEND_URL || "http://localhost:5173",
        env.PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
      ];
    },
    advanced: {
      ...(!isDev
        ? {
            crossSubDomainCookies: {
              enabled: true,
              domain: "freshmen.vidyachula.org",
            },
          }
        : {}),
      cookiePrefix: "vidyafreshmen",
      // defaultCookieAttributes: {
      // 	sameSite: "none",
      // 	secure: true,
      // 	// partitioned: true // New browser standards will mandate this for foreign cookies
      // }
    },
  });
};

export const auth = createAuth({
  env,
});
