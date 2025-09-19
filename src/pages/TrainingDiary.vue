<template>
	<div class="training-diary">
		<!-- Hero Header Section with Integrated Tabs -->
		<div class="training-diary__hero">
			<div class="training-diary__hero-content">
				<div class="training-diary__hero-main">
					<h1 class="training-diary__title">Дневник тренировок</h1>
					<p class="training-diary__subtitle" v-if="sessions.trainingHistory.length">
						{{ sessions.trainingHistory.length }} {{ pluralizeTr(sessions.trainingHistory.length) }}
					</p>
				</div>
			</div>
			
			<!-- Integrated Tab Buttons -->
			<div class="training-diary__tab-buttons" v-if="sessions.trainingHistory.length > 0">
				<button 
					@click="activeTab = 'history'" 
					:class="['training-diary__tab-btn', { 'training-diary__tab-btn--active': activeTab === 'history' }]"
				>
					История
				</button>
				<button 
					@click="activeTab = 'stats'" 
					:class="['training-diary__tab-btn', { 'training-diary__tab-btn--active': activeTab === 'stats' }]"
				>
					Статистика
				</button>
			</div>
		</div>

		<!-- Main Content -->
		<div class="training-diary__content">
			<template v-if="sessions.trainingHistory.length === 0">
				<div class="training-diary__empty">
					<div class="training-diary__empty-icon">
						<van-icon name="completed" size="64" />
					</div>
					<h2 class="training-diary__empty-title">Дневник пуст</h2>
					<p class="training-diary__empty-description">
						Здесь будут отображаться завершенные тренировки
					</p>
				</div>
			</template>

			<template v-else>
				<!-- Tab Content -->
				<div class="training-diary__tab-content" v-if="activeTab === 'history'">
					<DiaryTabHistory
						:sessions="sessions"
						:search-query="searchQuery"
						:show-filters="showFilters"
						:selected-period="selectedPeriod"
						:selected-programs="selectedPrograms"
						:filtered-sessions="filteredSessions"
						:available-programs="availablePrograms"
						:has-active-filters="hasActiveFilters"
						:period-filters="periodFilters"
						:search-suggestions="searchSuggestions"
						@update:search-query="searchQuery = $event"
						@update:show-filters="showFilters = $event"
						@update:selected-period="selectedPeriod = $event"
						@update:selected-programs="selectedPrograms = $event"
						@open-session-details="openSessionDetails"
						@handle-search="handleSearch"
						@handle-suggestion-select="handleSuggestionSelect"
						@toggle-period-filter="togglePeriodFilter"
						@toggle-program-filter="toggleProgramFilter"
						@clear-search="clearSearch"
						@search-by-muscles="searchByMuscles"
					/>
				</div>
				<div class="training-diary__tab-content" v-if="activeTab === 'stats'">
					<DiaryTabStats
						@open-record-details="openRecordDetails"
					/>
				</div>
			</template>
		</div>
	</div>

	<!-- Session Details Popup -->
	<SessionDetailsPopup
		v-model="showSessionDetails"
		:session="selectedSession"
		@close="closeSessionDetails"
	/>
</template>

<script setup lang="ts">
import { useSessionsStore, type TrainingHistory } from '@/stores/sessions';
import SessionDetailsPopup from '@/components/Diary/SessionDetailsPopup.vue';
import DiaryTabHistory from '@/components/Diary/DiaryTabHistory.vue';
import DiaryTabStats from '@/components/Diary/DiaryTabStats.vue';
import { computed, onMounted, ref } from 'vue';

// Используем тип из SmartSearch компонента
interface SearchSuggestion {
	id: string;
	text: string;
	type: 'muscle' | 'equipment' | 'category' | 'recent';
	icon?: string;
}

interface Record {
	type: string;
	title: string;
	value: string;
	date: string;
	icon: string;
	details?: any;
}

const sessions = useSessionsStore();

const showSessionDetails = ref(false);
const selectedSession = ref<TrainingHistory | null>(null);

// Tab state
const activeTab = ref<'history' | 'stats'>('history');

// Smart Search State
const searchQuery = ref('');
const showFilters = ref(false);
const selectedPeriod = ref<string | null>(null);
const selectedPrograms = ref<string[]>([]);

// Search Configuration
const periodFilters = [
	{ label: 'Сегодня', value: 'today' },
	{ label: 'Неделя', value: 'week' },
	{ label: 'Месяц', value: 'month' },
	{ label: '3 месяца', value: '3months' },
	{ label: 'Год', value: 'year' },
];

// Computed Properties
const availablePrograms = computed(() => {
	const programs = new Set<string>();
	sessions.trainingHistory.forEach(session => {
		if (session.program_name) {
			programs.add(session.program_name);
		}
	});
	return Array.from(programs).sort();
});

const searchSuggestions = computed(() => {
	const suggestions: SearchSuggestion[] = [];
	
	// Recent searches
	if (searchQuery.value.length > 0) {
		const query = searchQuery.value.toLowerCase();
		const searchTerms = query.split(/\s+/).filter(term => term.length > 0);
		const lastTerm = searchTerms[searchTerms.length - 1] || '';
		
		// Program suggestions как category
		availablePrograms.value
			.filter(p => p.toLowerCase().includes(lastTerm))
			.slice(0, 2)
			.forEach(program => {
				suggestions.push({
					id: `program-${program}`,
					text: program,
					type: 'category',
					icon: '🏋️'
				});
			});
		
		// Day suggestions как recent
		const uniqueDays = [...new Set(sessions.trainingHistory.map(s => s.day_name).filter(Boolean))];
		uniqueDays
			.filter(day => day!.toLowerCase().includes(lastTerm))
			.slice(0, 2)
			.forEach(day => {
				suggestions.push({
					id: `day-${day}`,
					text: day!,
					type: 'recent',
					icon: '📅'
				});
			});
			
		// Muscle suggestions как muscle - учитываем уже введенные мышцы
		const allMuscles = new Set<string>();
		sessions.trainingHistory.forEach(session => {
			if (session.muscle_groups?.primary) {
				allMuscles.add(session.muscle_groups.primary);
			}
			session.muscle_groups?.secondary?.forEach(m => allMuscles.add(m));
		});
		
		// Исключаем уже введенные мышцы из предложений
		const existingMuscles = searchTerms.slice(0, -1).map(term => term.toLowerCase());
		
		Array.from(allMuscles)
			.filter(muscle => 
				muscle.toLowerCase().includes(lastTerm) &&
				!existingMuscles.includes(muscle.toLowerCase())
			)
			.slice(0, 3)
			.forEach(muscle => {
				suggestions.push({
					id: `muscle-${muscle}`,
					text: muscle,
					type: 'muscle',
					icon: '💪'
				});
			});
	}
	
	return suggestions;
});

const filteredSessions = computed(() => {
	let filtered = sessions.trainingHistory;

	// Text search
	if (searchQuery.value) {
		const query = searchQuery.value.toLowerCase().trim();
		const searchTerms = query.split(/\s+/).filter(term => term.length > 0);
		
		filtered = filtered.filter(session => {
			const searchableText = [
				session.program_name,
				session.day_name,
				session.comments,
				session.muscle_groups?.primary,
				...(session.muscle_groups?.secondary || [])
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();

			return searchTerms.every(term => searchableText.includes(term));
		});
	}

	// Period filter
	if (selectedPeriod.value) {
		const now = new Date();
		let startDate: Date;

		switch (selectedPeriod.value) {
			case 'today':
				startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
				break;
			case 'week':
				startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
				break;
			case 'month':
				startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
				break;
			case '3months':
				startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
				break;
			case 'year':
				startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
				break;
			default:
				startDate = new Date(0);
		}

		filtered = filtered.filter(session => {
			const sessionDate = new Date(session.completed_at);
			return sessionDate >= startDate;
		});
	}

	// Program filter
	if (selectedPrograms.value.length > 0) {
		filtered = filtered.filter(session =>
			selectedPrograms.value.includes(session.program_name || '')
		);
	}

	return filtered.sort(
		(a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
	);
});

const hasActiveFilters = computed(() => {
	return !!(
		searchQuery.value ||
		selectedPeriod.value ||
		selectedPrograms.value.length > 0
	);
});

// Event handlers
function handleSearch(_query: string) {
	// Search is handled reactively through computed
}

function handleSuggestionSelect(suggestion: SearchSuggestion) {
	if (suggestion.type === 'muscle') {
		// Добавляем мышцу к поисковому запросу
		const currentTerms = searchQuery.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
		const newTerms = [...currentTerms.slice(0, -1), suggestion.text];
		searchQuery.value = newTerms.join(' ');
	} else if (suggestion.type === 'category') {
		// Заменяем весь запрос на программу
		searchQuery.value = suggestion.text;
	} else {
		// Для остальных типов просто заменяем
		searchQuery.value = suggestion.text;
	}
}

function searchByMuscles(primary: string, secondary: string[]) {
	// Объединяем основную и вторичные мышцы
	const muscles = [primary, ...secondary].filter(Boolean);
	searchQuery.value = muscles.join(' ');
}

function clearSearch() {
	searchQuery.value = '';
	selectedPeriod.value = null;
	selectedPrograms.value = [];
	showFilters.value = false;
}

function togglePeriodFilter(period: string) {
	if (selectedPeriod.value === period) {
		selectedPeriod.value = null;
	} else {
		selectedPeriod.value = period;
	}
}

function toggleProgramFilter(program: string) {
	const index = selectedPrograms.value.indexOf(program);
	if (index > -1) {
		selectedPrograms.value.splice(index, 1);
	} else {
		selectedPrograms.value.push(program);
	}
}

function openSessionDetails(session: TrainingHistory) {
	selectedSession.value = session;
	showSessionDetails.value = true;
}

function closeSessionDetails() {
	showSessionDetails.value = false;
	selectedSession.value = null;
}

function openRecordDetails(record: Record) {
	void record; // reserved for future
	// В будущем можно добавить модалку с детальной информацией о рекорде
}

// Utility functions
function pluralizeTr(count: number): string {
	const cases = ['тренировка', 'тренировки', 'тренировок'];
	const num = Math.abs(count) % 100;
	const n = num % 10;
	if (num > 10 && num < 20) return cases[2];
	if (n > 1 && n < 5) return cases[1];
	if (n === 1) return cases[0];
	return cases[2];
}

onMounted(async () => {
	
	await sessions.loadTrainingHistory();
});
</script>

<style lang="scss" scoped>
// Training Diary Layout - Modern Adaptive Design like Planner
.training-diary {
	min-height: 100vh;
	background: var(--color-bg);
	display: flex;
	flex-direction: column;
	position: relative;

	// Hero Section - Premium Header Design with Integrated Tabs
	&__hero {
		background: var(--grad-1);
		padding: var(--space-4) var(--space-4) 0;
		padding-top: calc(var(--space-4) + var(--safe-top, 0px));
		box-shadow: var(--shadow-lg);
		position: relative;
		z-index: 2;
		border-radius: 0 0 var(--radius-xl) var(--radius-xl);
		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: var(--surface-glass);
			backdrop-filter: blur(20px);
			z-index: -1;
			border-radius: 0 0 var(--radius-xl) var(--radius-xl);
		}

		&-content {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: var(--space-3);
			max-width: 100%;
			margin-bottom: var(--space-4);
		}

		&-main {
			flex: 1;
			min-width: 0;
		}
	}

	&__title {
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-title);
		color: var(--color-accent-contrast);
		margin: 0 0 var(--space-1);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	&__subtitle {
		font-size: var(--fs-sm);
		color: var(--color-accent-contrast);
		opacity: 0.8;
		margin: 0;
		font-weight: var(--fw-regular);
	}

	// Integrated Tab Buttons
	&__tab-buttons {
		display: flex;
		background: var(--surface-glass);
		border-radius: 0 0 var(--radius-xl) var(--radius-xl);
		margin: 0 calc(-1 * var(--space-4));
	}

	&__tab-btn {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--color-accent-contrast);
		opacity: 0.7;
		font-weight: var(--fw-semibold);
		font-size: var(--fs-sm);
		padding: var(--space-3) var(--space-4);
		border-radius: 0 0 0 var(--radius-l);
		transition: all var(--dur-2) var(--ease-std);
		cursor: pointer;
		position: relative;
		overflow: hidden;
		&:nth-child(2){
			border-radius: 0 0 var(--radius-l) 0;
		}
		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(255, 255, 255, 0.1);
			opacity: 0;
			transition: opacity var(--dur-2) var(--ease-std);
		}

		&:active::before {
			opacity: 1;
		}

		&:active {
			transform: scale(0.98);
		}

		&--active {
			background: var(--color-accent-contrast);
			color: var(--color-accent);
			opacity: 1;
			box-shadow: var(--shadow-sm);

			&::before {
				display: none;
			}
		}
	}

	// Main Content Area - Minimized Padding
	&__content {
		flex: 1;
		position: relative;
		z-index: 1;
		background: var(--color-bg);
		padding-top: var(--space-4);
		min-height: 60vh;
	}

	// Empty State - Engaging Onboarding
	&__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: var(--space-6) var(--space-4);
		min-height: 50vh;
		animation: fadeInUp 0.6s var(--ease-std);

		&-icon {
			margin-bottom: var(--space-4);
			color: var(--color-accent);
			opacity: 0.6;
		}

		&-title {
			font-size: var(--fs-xl);
			font-weight: var(--fw-bold);
			color: var(--color-text);
			margin: 0 0 var(--space-3);
			line-height: var(--lh-title);
		}

		&-description {
			font-size: var(--fs-md);
			color: var(--color-text-muted);
			line-height: var(--lh-body);
			margin: 0 0 var(--space-5);
			max-width: 280px;
		}
	}

	// Direct Tab Content - No Extra Container
	&__tab-content {
		padding: 0 var(--space-4) var(--space-4);
		min-height: 400px;
		height: calc(100vh - 200px); // Фиксированная высота для скролла
		overflow: hidden; // Контролируем скролл внутри компонентов
		&:first-child{
			padding: 0;
		}
	}
}

// Animations
@keyframes fadeInUp {
	from {
		opacity: 0;
		transform: translateY(20px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

// Reduced motion support
@media (prefers-reduced-motion: reduce) {
	.training-diary {
		&__tab-btn {
			transition: none;
		}

		&__empty {
			animation: none;
		}
	}

	@keyframes fadeInUp {
		from, to {
			opacity: 1;
			transform: translateY(0);
		}
	}
}

// Dark theme specific adjustments
@media (prefers-color-scheme: dark) {
	.training-diary {
		&__hero::before {
			background: rgba(0, 0, 0, 0.1);
		}
	}
}

// Safe area and IME support
.training-diary {
	padding-bottom: calc(var(--safe-bottom) + var(--ime-bottom));
}
</style>
