import { env } from '$env/dynamic/public';
import type { ApiRouter } from '@vidyafreshmen/server';
import { hc } from 'hono/client';

interface Options {
	fetch?: typeof fetch;
}

export const apiClient = ({ fetch = globalThis.fetch }: Options = {}) =>
	hc<ApiRouter>(env.PUBLIC_API_URL || '/api', {
		fetch: (input: RequestInfo | URL, init?: RequestInit) =>
			fetch(input as Parameters<typeof fetch>[0], { ...init, credentials: 'include' })
	});

export class ApiError extends Error {}

type ZodFailure = { success: false; error: unknown };
type ApiFailure = { error: string };
type Json<P> = P extends Promise<{ json(): Promise<infer T> }> ? T : never;

// Every route responds with either the successful payload, a `{ error: string }`
// business error, or (when the body fails a zValidator schema) a zod safe-parse
// failure. This unwraps that union so call sites keep the old trpc ergonomics:
// await the call, get the value back directly, or catch a real Error with
// `.message` set. `P` is inferred straight from whatever the hono client call
// resolves to, so it never has to unify against a fixed parameter shape.
export async function call<P extends Promise<{ json(): Promise<unknown> }>>(
	promise: P
): Promise<Exclude<Json<P>, ApiFailure | ZodFailure>> {
	const body = await (await promise).json();
	if (body && typeof body === 'object') {
		if ('error' in body) {
			throw new ApiError(String((body as ApiFailure).error));
		}
		if ('success' in body && (body as ZodFailure).success === false) {
			throw new ApiError('Invalid request');
		}
	}
	return body as Exclude<Json<P>, ApiFailure | ZodFailure>;
}
