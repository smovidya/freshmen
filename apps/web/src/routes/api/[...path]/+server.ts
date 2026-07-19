import { apiApp } from '$lib/server/api';
import type { RequestHandler } from './$types';

const handle: RequestHandler = ({ request, platform }) => {
	if (!platform) {
		return new Response('Cloudflare platform bindings are unavailable', { status: 500 });
	}

	return apiApp.fetch(request, platform.env, platform.ctx);
};

export {
	handle as DELETE,
	handle as GET,
	handle as HEAD,
	handle as OPTIONS,
	handle as PATCH,
	handle as POST,
	handle as PUT
};
