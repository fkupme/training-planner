<template>
	<div class="diary-history">
		<!-- Search Section -->
		<div class="search-section">
			<SmartSearch
				v-model="searchQuery"
				placeholder="Поиск по программе, дню, мышцам, комментариям..."
				:suggestions="searchSuggestions"
				:loading="sessions.isLoadingHistory"
				@search="handleSearch"
				@select-suggestion="handleSuggestionSelect"
			/>
			
			<!-- Filter Controls -->
			<div class="search-controls" v-if="hasActiveFilters || showFilters">
				<button
					@click="showFilters = !showFilters"
					:class="['filters-toggle', { active: showFilters }]"
				>
					<van-icon name="filter-o" />
					Фильтры
					<van-icon name="arrow-down" :class="{ rotated: showFilters }" />
				</button>
				
				<div v-if="searchQuery || hasActiveFilters" class="search-stats">
					{{ filteredSessions.length }} из {{ sessions.trainingHistory.length }}
				</div>
			</div>
			
			<!-- Search Filters -->
			<div class="search-filters" v-if="showFilters">
				<div class="filter-row">
					<div class="filter-group">
						<label class="filter-label">Период</label>
						<div class="filter-chips">
							<button
								v-for="period in periodFilters"
								:key="period.value"
								:class="['filter-chip', { active: selectedPeriod === period.value }]"
								@click="togglePeriodFilter(period.value)"
							>
								{{ period.label }}
							</button>
						</div>
					</div>
				</div>
				
				<div class="filter-row">
					<div class="filter-group">
						<label class="filter-label">Программы</label>
						<div class="filter-chips">
							<button
								v-for="program in availablePrograms"
								:key="program"
								:class="['filter-chip', { active: selectedPrograms.includes(program) }]"
								@click="toggleProgramFilter(program)"
							>
								{{ program }}
							</button>
						</div>
					</div>
				</div>
				
				<div class="filter-actions">
					<button @click="clearSearch" class="clear-filters-btn">
						<van-icon name="delete-o" />
						Очистить фильтры
					</button>
				</div>
			</div>
		</div>

		<!-- History Timeline -->
		<div class="sessions-timeline scroll-container">
			<div class="timeline-container">
				<transition-group name="fade-list" tag="div" class="timeline-list">
					<div
						v-for="session in filteredSessions"
						:key="session.id"
						class="timeline-item"
						@click="openSessionDetails(session)"
					>
						<!-- Timeline Node -->
						<div class="timeline-node">
							<div class="timeline-dot"></div>
							<div class="timeline-line" ></div>
						</div>
						
						<!-- Timeline Content -->
						<div class="timeline-content">
							<!-- Date & Muscles Header -->
							<div class="timeline-header">
								<div class="timeline-date">
									{{ formatDate(session.completed_at) }}
								</div>
								<div class="muscle-tags">
									<van-tag
										v-if="session.muscle_groups?.primary"
										type="primary"
										plain
										@click.stop="searchByMuscles(session.muscle_groups.primary, session.muscle_groups?.secondary || [])"
									>
										{{ session.muscle_groups.primary }}
									</van-tag>
									<van-tag
										v-for="muscle in (session.muscle_groups?.secondary || [])"
										:key="muscle"
										type="success"
										plain
										@click.stop="searchByMuscles(session.muscle_groups?.primary || '', [muscle])"
									>
										{{ muscle }}
									</van-tag>
								</div>
							</div>
							
							<!-- Session Card -->
							<div class="session-card">
								<div class="session-card__header">
									<div class="session-card__main">
										<div class="session-card__program">
											{{ session.program_name }}
										</div>
										<div class="session-card__meta">
											{{ formatSessionInfo(session) }}
										</div>
									</div>
									<div class="session-card__side">
										<div class="session-card__tags">
											<div class="session-tag session-tag--primary">
												{{ session.exercises_count }} упр.
											</div>
											<div class="session-tag session-tag--success">
												{{ session.total_sets }} подх.
											</div>
										</div>
									</div>
								</div>
								<div v-if="session.comments" class="session-card__comments">
									<van-icon name="comment-o" />
									<span>{{ session.comments }}</span>
								</div>
							</div>
						</div>
					</div>
				</transition-group>

				<div
					v-if="!filteredSessions.length && !sessions.isLoadingHistory"
					class="empty-state"
				>
					<van-icon name="search" />
					<p>Нет тренировок</p>
					<span>Завершенные тренировки будут отображаться здесь</span>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSessionsStore, type TrainingHistory } from '@/stores/sessions';
import SmartSearch from '@/components/ui/SmartSearch.vue';

// Используем тип из SmartSearch компонента
interface SearchSuggestion {
	id: string;
	text: string;
	type: 'muscle' | 'equipment' | 'category' | 'recent';
	icon?: string;
}

const props = defineProps<{
	sessions: ReturnType<typeof useSessionsStore>;
	searchQuery: string;
	showFilters: boolean;
	selectedPeriod: string | null;
	selectedPrograms: string[];
	filteredSessions: TrainingHistory[];
	availablePrograms: string[];
	hasActiveFilters: boolean;
	periodFilters: Array<{ label: string; value: string }>;
	searchSuggestions: SearchSuggestion[];
}>();

const emit = defineEmits<{
	(e: 'update:search-query', value: string): void;
	(e: 'update:show-filters', value: boolean): void;
	(e: 'update:selected-period', value: string | null): void;
	(e: 'update:selected-programs', value: string[]): void;
	(e: 'open-session-details', session: TrainingHistory): void;
	(e: 'handle-search', query: string): void;
	(e: 'handle-suggestion-select', suggestion: SearchSuggestion): void;
	(e: 'toggle-period-filter', period: string): void;
	(e: 'toggle-program-filter', program: string): void;
	(e: 'clear-search'): void;
	(e: 'search-by-muscles', primary: string, secondary: string[]): void;
}>();

// Local computed properties for v-model binding
const searchQuery = computed({
	get: () => props.searchQuery,
	set: (value: string) => emit('update:search-query', value)
});

const showFilters = computed({
	get: () => props.showFilters,
	set: (value: boolean) => emit('update:show-filters', value)
});

const selectedPeriod = computed({
	get: () => props.selectedPeriod,
	set: (value: string | null) => emit('update:selected-period', value)
});

const selectedPrograms = computed({
	get: () => props.selectedPrograms,
	set: (value: string[]) => emit('update:selected-programs', value)
});

// Event handlers
function handleSearch(query: string) {
	emit('handle-search', query);
}

function handleSuggestionSelect(suggestion: SearchSuggestion) {
	emit('handle-suggestion-select', suggestion);
}

function togglePeriodFilter(period: string) {
	emit('toggle-period-filter', period);
}

function toggleProgramFilter(program: string) {
	emit('toggle-program-filter', program);
}

function clearSearch() {
	emit('clear-search');
}

function openSessionDetails(session: TrainingHistory) {
	emit('open-session-details', session);
}

function searchByMuscles(primary: string, secondary: string[]) {
	emit('search-by-muscles', primary, secondary);
}

// Utility functions
function formatDate(dateStr: string | number) {
	const date = new Date(dateStr);
	return date.toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

function formatSessionInfo(session: TrainingHistory) {
	const date = new Date(session.completed_at);
	const time = date.toLocaleTimeString('ru-RU', {
		hour: '2-digit',
		minute: '2-digit'
	});
	return `${session.day_name || 'День'} • ${time}`;
}
</script>

<style lang="scss" scoped>
.diary-history {
	padding: 0 var(--space-4);
	height: 100%;
	overflow-y: auto;
}

.search-section {
	margin-bottom: var(--space-4);
}

// Search Controls
.search-controls {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: var(--space-3);
	gap: var(--space-3);
}

.filters-toggle {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-l);
	padding: var(--space-2) var(--space-3);
	color: var(--color-text);
	font-size: var(--fs-sm);
	font-weight: var(--fw-medium);
	cursor: pointer;
	transition: all var(--dur-2) var(--ease-std);

	&:hover {
		background: var(--color-accent-soft);
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	&.active {
		background: var(--color-accent);
		color: var(--color-accent-contrast);
		border-color: var(--color-accent);
	}

	.van-icon:last-child {
		transition: transform var(--dur-2) var(--ease-std);

		&.rotated {
			transform: rotate(180deg);
		}
	}
}

.search-stats {
	font-size: var(--fs-xs);
	color: var(--color-text-muted);
	font-weight: var(--fw-medium);
	padding: var(--space-2) var(--space-3);
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-pill);
}

// Search Filters
.search-filters {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-l);
	padding: var(--space-4);
	margin-top: var(--space-3);
}

.filter-row {
	margin-bottom: var(--space-4);

	&:last-child {
		margin-bottom: 0;
	}
}

.filter-group {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.filter-label {
	font-size: var(--fs-sm);
	font-weight: var(--fw-semibold);
	color: var(--color-text);
}

.filter-chips {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
}

.filter-chip {
	background: var(--color-bg);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-pill);
	padding: var(--space-2) var(--space-3);
	font-size: var(--fs-xs);
	font-weight: var(--fw-medium);
	color: var(--color-text);
	cursor: pointer;
	transition: all var(--dur-2) var(--ease-std);

	&:hover {
		background: var(--color-accent-soft);
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	&.active {
		background: var(--color-accent);
		color: var(--color-accent-contrast);
		border-color: var(--color-accent);
	}
}

.filter-actions {
	display: flex;
	justify-content: flex-end;
	margin-top: var(--space-4);
	padding-top: var(--space-4);
	border-top: 1px solid var(--color-border);
}

.clear-filters-btn {
	background: transparent;
	border: 1px solid var(--color-border);
	border-radius: var(--radius-l);
	padding: var(--space-2) var(--space-3);
	font-size: var(--fs-sm);
	color: var(--color-text-muted);
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: var(--space-2);
	transition: all var(--dur-2) var(--ease-std);

	&:hover {
		background: var(--color-danger);
		color: var(--color-surface);
		border-color: var(--color-danger);
	}
}

// Timeline Styles
.sessions-timeline {
	height: calc(100vh - 300px);
	overflow-y: auto;
	margin: 0 calc(-1 * var(--space-4));
	padding: 0 var(--space-4) 0 var(--space-1);
}

.timeline-container {
	position: relative;
}

.timeline-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
	padding-bottom: var(--space-6);
}

.timeline-item {
	display: flex;
	gap: var(--space-4);
	cursor: pointer;
	transition: all var(--dur-2) var(--ease-std);

	&:hover {
		transform: translateX(4px);
	}
}

.timeline-node {
	position: relative;
	flex-shrink: 0;
	width: 24px;
	display: flex;
	justify-content: center;
	align-items: flex-start;
	padding-top: var(--space-3);
}

.timeline-dot {
	width: 12px;
	height: 12px;
	background: var(--color-accent);
	border-radius: 50%;
	border: 2px solid var(--color-surface);
	box-shadow: 0 0 0 2px var(--color-accent);
}

.timeline-line {
	position: absolute;
	top: 20px;
	left: 50%;
	transform: translateX(-50%);
	width: 2px;
	height: calc(100% + var(--space-4));
	background: var(--color-border);
}

.timeline-content {
	flex: 1;
	min-width: 0;
}

.timeline-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-3);
	margin-bottom: var(--space-3);
}

.timeline-date {
	font-size: var(--fs-sm);
	font-weight: var(--fw-semibold);
	color: var(--color-text);
}

.muscle-tags {
	display: flex;
	gap: var(--space-2);
	flex-wrap: wrap;

	:deep(.van-tag) {
		cursor: pointer;
		transition: all var(--dur-2) var(--ease-std);

		&:hover {
			transform: scale(1.05);
			box-shadow: var(--shadow-xs);
		}
		
		&:active {
			transform: scale(0.95);
		}
	}
	
	:deep(.van-tag--primary) {
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		color: var(--color-accent);
		border-color: var(--color-accent);
		
		&:hover {
			background: color-mix(in srgb, var(--color-accent) 25%, transparent);
		}
	}
	
	:deep(.van-tag--success) {
		background: color-mix(in srgb, var(--color-success) 15%, transparent);
		color: var(--color-success);
		border-color: var(--color-success);
		
		&:hover {
			background: color-mix(in srgb, var(--color-success) 25%, transparent);
		}
	}
}

// Session Card
.session-card {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-l);
	padding: var(--space-4);
	transition: all var(--dur-2) var(--ease-std);

	&:hover {
		border-color: var(--color-accent);
		box-shadow: var(--shadow-md);
	}

	&__header {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-3);
	}

	&__main {
		min-width: 0;
		flex: 1;
	}

	&__program {
		font-weight: var(--fw-semibold);
		font-size: var(--fs-md);
		color: var(--color-text);
		line-height: var(--lh-heading);
		margin-bottom: var(--space-1);
	}

	&__meta {
		font-size: var(--fs-xs);
		color: var(--color-text-muted);
		font-weight: var(--fw-regular);
	}

	&__side {
		display: flex;
		align-items: flex-start;
	}

	&__tags {
		display: flex;
		gap: var(--space-2);
	}

	&__comments {
		font-size: var(--fs-sm);
		color: var(--color-text-muted);
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		line-height: var(--lh-body);
		padding-top: var(--space-2);
		border-top: 1px solid var(--color-border);

		.van-icon {
			margin-top: 2px;
			opacity: 0.7;
		}
	}
}

.session-tag {
	font-size: var(--fs-xxs);
	font-weight: var(--fw-bold);
	padding: var(--space-1) var(--space-2);
	border-radius: var(--radius-s);
	line-height: 1;
	text-transform: uppercase;
	letter-spacing: 0.25px;

	&--primary {
		background: var(--color-accent-soft);
		color: var(--color-accent);
	}

	&--success {
		background: color-mix(in srgb, var(--color-success) 15%, transparent);
		color: var(--color-success);
	}
}

// Empty state
.empty-state {
	text-align: center;
	padding: var(--space-8) var(--space-4);
	color: var(--color-text-muted);

	.van-icon {
		font-size: 48px;
		margin-bottom: var(--space-3);
		opacity: 0.5;
	}

	p {
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		margin: 0 0 var(--space-2);
		color: var(--color-text);
	}

	span {
		font-size: var(--fs-sm);
	}
}

// Анимации
.fade-list-enter-active,
.fade-list-leave-active {
	transition: all var(--dur-3) var(--ease-std);
}

.fade-list-enter-from,
.fade-list-leave-to {
	opacity: 0;
	transform: translateY(var(--space-2));
}
</style>
