import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';

const Planner = () => import('@/pages/Planner.vue');
const Reminders = () => import('@/pages/Reminders.vue');
const Results = () => import('@/pages/Results.vue');
const Supplements = () => import('@/pages/Supplements.vue');
const Timer = () => import('@/pages/Timer.vue');
const Session = () => import('@/pages/Session.vue');
const Settings = () => import('@/pages/Settings.vue');
const TrainingDiary = () => import('@/pages/TrainingDiary.vue');

const AuthLogin = () => import('@/pages/AuthLogin.vue');
const AuthRegister = () => import('@/pages/AuthRegister.vue');

export const routes: RouteRecordRaw[] = [
	{ path: '/', redirect: '/planner' },
	{ path: '/login', component: AuthLogin, meta: { public: true } },
	{ path: '/register', component: AuthRegister, meta: { public: true } },
	{ path: '/planner', component: Planner },
	{ path: '/reminders', component: Reminders },
	{ path: '/results', component: Results },
	{ path: '/supplements', component: Supplements },
	{ path: '/timer', component: Timer },
	{ path: '/session', component: Session },
	{ path: '/settings', component: Settings },
	{ path: '/diary', component: TrainingDiary },
];

export function createAppRouter() {
	const router = createRouter({
		history: createWebHashHistory(),
		routes,
	});

	// Глобальный guard для защиты роутов
	router.beforeEach(async (to, _from, next) => {
		const { useAuthStore } = await import('@/stores/auth');
		const auth = useAuthStore();
		if (!auth.currentUser) {
			await auth.initFromSession();
		}
		const isPublic = to.meta?.public === true;
		if (!auth.currentUser && !isPublic) {
			next({ path: '/login', query: { redirect: to.fullPath } });
		} else {
			next();
		}
	});

	return router;
}

export async function setupGuards(router: ReturnType<typeof createAppRouter>) {
	const { useAuthStore } = await import('@/stores/auth');
	router.beforeEach(async to => {
		const auth = useAuthStore();
		const isPublic = to.meta?.public === true;
		if (!auth.currentUser) {
			await auth.initFromSession();
		}
		if (!auth.currentUser && !isPublic) {
			return { path: '/login', query: { redirect: to.fullPath } };
		}
		return true;
	});
}
