import { loadIntegrated } from '$lib/server/integrated/snapshot';
import { integratedAction } from '$lib/server/integrated/actions';
export const load = loadIntegrated;
export const actions = { integrated: integratedAction };
