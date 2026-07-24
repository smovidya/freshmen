import type { LayoutLoad } from './$types';
import { apiClient, call } from '$lib/api';

// export const ssr = false;
// export const prerender = true;

export const load: LayoutLoad = async ({ fetch, depends, data }) => {
	try {
		const [whoami] = await Promise.all([call(apiClient({ fetch }).user.whoami.$get())]);
		return {
			whoami,
			isNonProduction: data.isNonProduction
		};
	} catch (error) {
		console.error('API Client Error:', error);
		return {
			whoami: null,
			isNonProduction: data.isNonProduction
		};
	}
};
