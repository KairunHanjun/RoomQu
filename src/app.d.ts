declare global {
	namespace App {
		interface Locals {
			demoUser: import('$lib/server/demo/store').DemoUser | null;
			user: import('$lib/server/auth').SessionValidationResult['user'];
			session: import('$lib/server/auth').SessionValidationResult['session'];
		}
	}
}
export {};
