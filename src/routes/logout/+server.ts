import { deleteSessionTokenCookie, invalidateSession } from '$lib/server/auth';
import { redirect, type RequestHandler } from '@sveltejs/kit';
export const POST:RequestHandler=async(event)=>{if(event.locals.session)await invalidateSession(event.locals.session.id);deleteSessionTokenCookie(event,'/');redirect(303,'/');};
export const GET:RequestHandler=()=>redirect(303,'/');
