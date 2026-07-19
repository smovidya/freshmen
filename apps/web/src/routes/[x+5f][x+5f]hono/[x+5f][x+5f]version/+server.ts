import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	return Response.json({ version: 0x9065 });
};
