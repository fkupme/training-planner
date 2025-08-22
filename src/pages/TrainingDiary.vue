<template>
	<div class="training-diary">
		<div class="training-diary__inner">
			<!-- Header / Search -->
			<section class="training-diary__section training-diary__section--search">
				<h1 class="training-diary__title">Дневник тренировок</h1>
				<van-search
					v-model="sessions.historySearchQuery"
					shape="round"
					background="transparent"
					placeholder="Поиск по названию, дню или комментариям..."
					@update:model-value="sessions.setHistorySearch"
				/>
			</section>

			<!-- Stats -->
			<section class="training-diary__section">
				<h2 class="section-title">Статистика</h2>
				<van-cell-group inset class="stats-cards">
					<van-cell
						title="Всего тренировок"
						:value="sessions.trainingHistory.length.toString()"
						icon="completed"
					/>
					<van-cell
						title="За последний месяц"
						:value="recentTrainingsCount.toString()"
						icon="calendar-o"
					/>
				</van-cell-group>
			</section>

			<!-- History -->
			<section class="training-diary__section">
				<div class="section-title with-count">
					<h2>История</h2>
					<span v-if="sessions.filteredTrainingHistory.length" class="chip">{{
						sessions.filteredTrainingHistory.length
					}}</span>
				</div>

				<van-list
					v-model:loading="sessions.isLoadingHistory"
					:finished="true"
					loading-text="Загрузка..."
					class="sessions-list"
				>
					<transition-group name="fade-list" tag="div">
						<div
							v-for="session in sessions.filteredTrainingHistory"
							:key="session.id"
							class="session-card"
							@click="openSessionDetails(session)"
						>
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
									<div class="session-card__date">
										{{ formatDate(session.completed_at) }}
									</div>
									<div class="session-card__tags">
										<van-tag round type="primary"
											>{{ session.exercises_count }} упр.</van-tag
										>
										<van-tag round type="success"
											>{{ session.total_sets }} подх.</van-tag
										>
									</div>
								</div>
							</div>
							<div v-if="session.comments" class="session-card__comments">
								<van-icon name="comment-o" />
								<span>{{ session.comments }}</span>
							</div>
						</div>
					</transition-group>

					<van-empty
						v-if="
							!sessions.filteredTrainingHistory.length &&
							!sessions.isLoadingHistory
						"
						image="search"
						description="Нет тренировок"
					/>
				</van-list>
			</section>
		</div>

		<!-- Popup details -->
		<van-popup
			v-model:show="showSessionDetails"
			position="bottom"
			round
			:style="{ height: '80%' }"
		>
			<div class="session-details" v-if="selectedSession">
				<van-nav-bar
					:title="selectedSession.program_name"
					left-text="Закрыть"
					@click-left="showSessionDetails = false"
				>
					<template #right>
						<van-icon name="share-o" @click="shareSession" />
					</template>
				</van-nav-bar>

				<div class="session-details__content">
					<van-cell-group inset>
						<van-cell
							title="День тренировки"
							:value="selectedSession.day_name"
							icon="calendar-o"
						/>
						<van-cell
							title="Дата завершения"
							:value="formatFullDate(selectedSession.completed_at)"
							icon="clock-o"
						/>
						<van-cell
							v-if="selectedSession.duration_minutes"
							title="Длительность"
							:value="`${selectedSession.duration_minutes} мин`"
							icon="timer"
						/>
					</van-cell-group>

					<van-cell-group inset title="Статистика">
						<van-cell
							title="Упражнений"
							:value="selectedSession.exercises_count.toString()"
							icon="service"
						/>
						<van-cell
							title="Подходов"
							:value="selectedSession.total_sets.toString()"
							icon="records"
						/>
					</van-cell-group>

					<van-cell-group
						inset
						title="Комментарии"
						v-if="selectedSession.comments"
					>
						<van-cell>
							<p class="session-comments__text">
								{{ selectedSession.comments }}
							</p>
						</van-cell>
					</van-cell-group>

					<van-cell-group inset title="Упражнения">
						<van-cell
							title="Подробности упражнений"
							label="Для просмотра деталей каждого упражнения перейдите в полную версию"
							is-link
							@click="viewFullSession"
						/>
					</van-cell-group>
				</div>
			</div>
		</van-popup>
	</div>
</template>

<script setup lang="ts">
import { useSessionsStore, type TrainingHistory } from '@/stores/sessions';
import { showToast } from 'vant';
import { computed, onMounted, ref } from 'vue';

const sessions = useSessionsStore();

const showSessionDetails = ref(false);
const selectedSession = ref<TrainingHistory | null>(null);

const recentTrainingsCount = computed(() => {
	const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
	return sessions.trainingHistory.filter(s => s.completed_at > oneMonthAgo)
		.length;
});

onMounted(async () => {
	if (sessions.trainingHistory.length === 0) {
		await sessions.loadTrainingHistory();
	}
});

function formatDate(timestamp: number): string {
	const date = new Date(timestamp);
	const now = new Date();
	const diffDays = Math.floor(
		(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
	);

	if (diffDays === 0) return 'Сегодня';
	if (diffDays === 1) return 'Вчера';
	if (diffDays < 7) return `${diffDays} дн. назад`;

	return date.toLocaleDateString('ru-RU', {
		day: '2-digit',
		month: '2-digit',
		year: '2-digit',
	});
}

function formatFullDate(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleDateString('ru-RU', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function formatSessionInfo(session: TrainingHistory): string {
	const parts = [];
	parts.push(session.day_name);
	if (session.duration_minutes) {
		parts.push(`${session.duration_minutes} мин`);
	}
	return parts.join(' • ');
}

function openSessionDetails(session: TrainingHistory) {
	selectedSession.value = session;
	showSessionDetails.value = true;
}

function shareSession() {
	if (!selectedSession.value) return;

	const text = `🏋️ Тренировка: ${selectedSession.value.program_name}
📅 ${selectedSession.value.day_name}
⏱️ ${selectedSession.value.duration_minutes} мин
🎯 ${selectedSession.value.exercises_count} упражнений, ${
		selectedSession.value.total_sets
	} подходов

${selectedSession.value.comments || ''}`;

	if (navigator.share) {
		navigator.share({
			title: 'Тренировка',
			text: text,
		});
	} else {
		navigator.clipboard.writeText(text);
		showToast('Скопировано в буфер обмена');
	}
}

function viewFullSession() {
	if (!selectedSession.value) return;
	showToast('Детальный просмотр будет реализован в следующей версии');
	// TODO: Можно загрузить полные данные сессии и показать все упражнения с подходами
}
</script>

<style lang="scss" scoped>
.training-diary {
	--card-bg: var(--color-surface, rgba(255, 255, 255, 0.04));
	padding: var(--space-4) var(--space-3) var(--space-6);
	background: var(--color-bg);
	min-height: 100vh;
	display: flex;
	justify-content: center;

	&__inner {
		width: 100%;
		max-width: 820px;
	}

	&__title {
		margin: 0 0 var(--space-2);
		font-size: 1.55rem;
		font-weight: 600;
		text-align: center;
	}

	&__section {
		margin-bottom: clamp(1.5rem, 2.5vh, 2.25rem);

		&--search {
			margin-bottom: var(--space-4);
		}
	}

	.section-title {
		font-size: 0.95rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-secondary);
		margin: 0 0 var(--space-2);
		display: flex;
		align-items: center;
		gap: 0.5rem;

		h2 {
			all: unset;
		}

		&.with-count h2 {
			cursor: default;
		}
	}

	.chip {
		background: var(--van-primary-color);
		color: #fff;
		font-size: 0.7rem;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		line-height: 1;
		font-weight: 600;
	}

	:deep(.van-search) {
		padding: 0;
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
		border-radius: 40px;
		box-shadow: 0 2px 4px -2px rgba(0, 0, 0, 0.35),
			0 0 0 1px rgba(255, 255, 255, 0.02) inset;
	}

	.stats-cards {
		:deep(.van-cell) {
			background: transparent;
			&:not(:last-child)::after {
				left: 16px;
				right: 16px;
			}
		}
		background: linear-gradient(
			145deg,
			var(--card-bg) 0%,
			rgba(255, 255, 255, 0.02) 100%
		);
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
		border-radius: 18px;
		box-shadow: 0 4px 14px -6px rgba(0, 0, 0, 0.4),
			0 1px 0 0 rgba(255, 255, 255, 0.05) inset;
	}

	.sessions-list {
		margin-top: 0.25rem;
	}

	.session-card {
		position: relative;
		background: var(--card-bg);
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.07));
		padding: 1rem 0.95rem 0.85rem;
		border-radius: 18px;
		margin-bottom: 0.9rem;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		transition: border-color 0.25s, background 0.25s, transform 0.25s;
		backdrop-filter: blur(6px);

		&:hover {
			border-color: var(--van-primary-color);
		}
		&:active {
			transform: scale(0.985);
		}

		&__header {
			display: flex;
			justify-content: space-between;
			gap: 0.75rem;
		}
		&__main {
			min-width: 0;
		}
		&__program {
			font-weight: 600;
			font-size: 0.95rem;
			line-height: 1.25;
		}
		&__meta {
			font-size: 0.7rem;
			opacity: 0.7;
			margin-top: 0.15rem;
		}
		&__side {
			text-align: right;
			display: flex;
			flex-direction: column;
			align-items: flex-end;
			gap: 0.35rem;
		}
		&__date {
			font-size: 0.65rem;
			letter-spacing: 0.05em;
			text-transform: uppercase;
			opacity: 0.65;
		}
		&__tags {
			display: flex;
			gap: 0.4rem;
			flex-wrap: wrap;
			justify-content: flex-end;
		}
		&__comments {
			font-size: 0.7rem;
			display: flex;
			align-items: flex-start;
			gap: 0.35rem;
			opacity: 0.85;
			line-height: 1.2;
		}
	}

	.fade-list-enter-active,
	.fade-list-leave-active {
		transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.fade-list-enter-from,
	.fade-list-leave-to {
		opacity: 0;
		transform: translateY(6px);
	}
}

.session-details {
	height: 100%;
	background: var(--color-bg);

	&__content {
		padding: var(--space-3);
		padding-top: 0;
		height: calc(100% - 46px);
		overflow-y: auto;

		:deep(.van-cell-group) {
			margin-bottom: var(--space-3);
		}

		.session-comments__text {
			margin: 0;
			line-height: 1.5;
			color: var(--color-text);
		}
	}
}
</style>
