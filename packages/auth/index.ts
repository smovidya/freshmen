import { schema, tables } from "@vidyafreshmen/db";
import { FeatureFlags } from "@vidyafreshmen/flags";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { adminAc, defaultAc, userAc } from "better-auth/plugins/admin/access";
import { jwt } from "better-auth/plugins/jwt";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

// Staff has no better-auth admin permissions (can't manage users/sessions) -
// it's a check-in role, distinct from the "admin" panel role. Exported so the
// client's adminClient() can share the exact same role set.
export const authRoles = {
  admin: adminAc,
  user: userAc,
  staff: defaultAc.newRole({}),
};

export const createAuth = ({ env }: { env: any }) => {
  const db = drizzle(env.DB, {
    schema: schema,
  });

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
              const elevatedOuids = (env.ELEVATED_OUID_LIST || "")
                .split(",")
                .map((id: string) => id.trim())
                .filter(Boolean);

              return {
                data: {
                  ...user,
                  ouid: ouid,
                  role: elevatedOuids.includes(ouid) ? "admin" : user.role,
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
    plugins: [
      jwt(),
      admin({
        defaultRole: "user",
        roles: authRoles,
      }),
    ],
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
      cookiePrefix: "vidyafreshmen",
    },
  });
};
