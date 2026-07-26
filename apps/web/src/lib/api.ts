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

export class ApiError extends Error {
	// Set when the server's `{ error, code }` body carries a machine-checkable
	// code (currently only 'turnstile_required' - see turnstile-gate.ts) -
	// lets call sites branch on this instead of matching the Thai message.
	code?: string;
}

type ZodFailure = { success: false; error: unknown };
type ApiFailure = { error: string; code?: string };
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
			const failure = body as ApiFailure;
			const error = new ApiError(String(failure.error));
			error.code = failure.code;
			throw error;
		}
		if ('success' in body && (body as ZodFailure).success === false) {
			throw new ApiError('Invalid request');
		}
	}
	return body as Exclude<Json<P>, ApiFailure | ZodFailure>;
}

// Wraps a Turnstile-gated call: tries without a token first (the common case
// once the server's "recently verified" window - turnstile-gate.ts - is
// warm, so most calls never see a challenge at all), and only asks the
// widget to actually solve one if the server comes back with
// code:'turnstile_required'. `makeRequest` must accept the token as an
// optional param and forward it as a `turnstileToken` query param - every
// requireTurnstile-gated route accepts that regardless of its own body shape.
export async function callWithTurnstile<P extends Promise<{ json(): Promise<unknown> }>>(
	makeRequest: (turnstileToken?: string) => P,
	takeToken: () => Promise<string | null>
): Promise<Exclude<Json<P>, ApiFailure | ZodFailure>> {
	try {
		return await call(makeRequest(undefined));
	} catch (error) {
		if (error instanceof ApiError && error.code === 'turnstile_required') {
			const token = await takeToken();
			return await call(makeRequest(token ?? undefined));
		}
		throw error;
	}
}
