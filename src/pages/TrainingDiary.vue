<template>
	<div class="training-diary">
		<!-- Поиск -->
		<van-search
			v-model="sessions.historySearchQuery"
			placeholder="Поиск по названию, дню или комментариям..."
			@update:model-value="sessions.setHistorySearch"
		/>

		<!-- Статистика -->
		<van-cell-group inset>
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

		<!-- Список тренировок -->
		<van-list
			v-model:loading="sessions.isLoadingHistory"
			:finished="true"
			loading-text="Загрузка..."
		>
			<van-cell-group
				v-if="sessions.filteredTrainingHistory.length > 0"
				inset
				v-for="session in sessions.filteredTrainingHistory"
				:key="session.id"
				class="training-diary__session"
			>
				<van-cell
					:title="session.program_name"
					:label="formatSessionInfo(session)"
					:value="formatDate(session.completed_at)"
					is-link
					@click="openSessionDetails(session)"
				>
					<template #icon>
						<van-icon name="completed" color="var(--van-success-color)" />
					</template>
					<template #right-icon>
						<div class="session-stats">
							<van-tag type="primary">
								{{ session.exercises_count }} упр.
							</van-tag>
							<van-tag type="success"> {{ session.total_sets }} подх. </van-tag>
						</div>
					</template>
				</van-cell>

				<!-- Комментарии если есть -->
				<van-cell
					v-if="session.comments"
					:label="session.comments"
					title="Комментарии"
					icon="comment-o"
					class="session-comments"
				/>
			</van-cell-group>

			<van-empty v-else image="search" description="Нет тренировок" />
		</van-list>

		<!-- Детальный просмотр тренировки -->
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
					<!-- Основная информация -->
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

					<!-- Статистика -->
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

					<!-- Комментарии -->
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

					<!-- Детали упражнений (если нужно - загружаем отдельно) -->
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
	padding: var(--space-3);
	background: var(--color-bg);
	min-height: 100vh;

	:deep(.van-search) {
		padding: 0 0 var(--space-3) 0;
	}

	:deep(.van-cell-group) {
		margin-bottom: var(--space-3);
	}

	&__session {
		.session-stats {
			display: flex;
			flex-direction: column;
			gap: var(--space-1);
			align-items: flex-end;
		}

		.session-comments {
			:deep(.van-cell__label) {
				color: var(--color-text-secondary);
				font-style: italic;
				max-height: 40px;
				overflow: hidden;
				text-overflow: ellipsis;
				display: -webkit-box;
				-webkit-line-clamp: 2;
				-webkit-box-orient: vertical;
			}
		}
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
