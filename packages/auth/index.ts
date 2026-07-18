import { schema, tables } from '@vidyafreshmen/db';
import { FeatureFlags } from '@vidyafreshmen/flags';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { jwt } from 'better-auth/plugins/jwt';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';

export const createAuth = ({
	env,
}: {
	env: any;
}) => {
	const db = drizzle(env.DB, {
		schema: schema
	});

	const isDev = env.WORKER_ENV !== 'production';
	const flags = new FeatureFlags({
		overrides: {
			"game-allow-non-freshmen": isDev, // Allow non-f
		}
	})

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: 'sqlite'
		}),
		logger: {
			level: 'info',
		},
		appName: 'Science Freshmen Fest 68',
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.PUBLIC_BETTER_AUTH_URL || 'http://localhost:8787',
		databaseHooks: {
			user: {
				create: {
					async before(user, context) {
						if (user.email.endsWith('@student.chula.ac.th')) {
							const ouid = user.email.split('@')[0];

							// Limited to science freshmen only
							if (!ouid?.endsWith('23')) {
								console.error(`[auth] Error: science-students-only ouid:${ouid} ${JSON.stringify(user)}`)
								throw context?.error("FORBIDDEN", {
									code: 'science-students-only',
									message: 'การลงทะเบียนนี้สำหรับนิสิตคณะวิทยาศาสตร์เท่านั้น',
								})
							}

							// if (ouid.startsWith('68')) {
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
								}
							};
						}

						console.error(`[auth] Error: invalid-email ${JSON.stringify(user)}`)
						throw context?.error("FORBIDDEN", {
							code: 'invalid-email',
							message: 'ระบบนี้สามารถเข้าสู่ระบบได้เฉพาะนิสิตเท่านั้น (@student.chula.ac.th)',
						})
					}
				}
			},
			session: {
				create: {
					async before(session, context) {
						const user = await db.select().from(tables.user).where(eq(tables.user.id, session.userId))
						if (!user[0]?.group && user[0]?.ouid?.startsWith('68')) {
							// user didn't have group assigned, get from team
							const student = await db.select().from(tables.students).where(eq(tables.students.email, user[0]?.email || ""));
							if (student[0]?.teamId || student[0]?.teamOwnedId) {
								const currentStudentGroup = await db.select().from(tables.teams).where(eq(tables.teams.id, student[0]?.teamId || student[0]?.teamOwnedId))
								await db.update(tables.user).set({
									group: currentStudentGroup[0]?.result
								}).where(eq(tables.user.id, session.userId));
							}
						}

						return {
							data: {
								...session,
							}
						}
					},
				}
			}
		},
		emailAndPassword: {
			enabled: isDev,
			signUp: {
				enabled: true,
				fields: ['email', 'password']
			},
			signIn: {
				enabled: true,
				fields: ['email', 'password']
			}
		},
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID as string,
				clientSecret: env.GOOGLE_CLIENT_SECRET as string,
				prompt: "select_account",
			}
		},
		user: {
			additionalFields: {
				ouid: {
					type: 'string',
					label: 'OUID',
					unique: true,
					input: false,
				},
				group: {
					type: 'string',
					label: 'Group',
					unique: false,
					input: false,
				}
			}
		},
		plugins: [
			jwt()
		],
		rateLimit: {
			storage: "database",
		},
		onAPIError: {
			errorURL: `/auth/error`, // wtf why dont this work 
		},
		trustedOrigins(request) {
			return [
				env.FRONTEND_URL || 'http://localhost:5173',
				env.PUBLIC_BETTER_AUTH_URL || 'http://localhost:8787',
			];
		},
		advanced: {
			crossSubDomainCookies: {
				enabled: env.WORKER_ENV === 'production',
				domain: "vidyafreshmen.vidyachula.org"
			},
			cookiePrefix: "vidyafreshmen",
			// defaultCookieAttributes: {
			// 	sameSite: "none",
			// 	secure: true,
			// 	// partitioned: true // New browser standards will mandate this for foreign cookies
			// }
		}
	});
};

export const auth = createAuth({
	env
});
