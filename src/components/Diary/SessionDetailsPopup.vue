<template>
	<van-popup
		v-model:show="isVisible"
		position="bottom"
		round
		:style="{ height: '90%' }"
		class="session-details-popup"
		@closed="$emit('close')"
	>
		<div class="session-details" v-if="session">
			<!-- Header -->
			<div class="session-details__header">
				<button class="back-btn" @click="closePopup">
					<Icon icon="material-symbols:arrow-back" width="24" height="24" />
				</button>
				<h3 class="session-details__title">{{ session.program_name }}</h3>
				<button class="share-btn" @click="shareSession">
					<Icon icon="material-symbols:share-outline" width="24" height="24" />
				</button>
			</div>

			<!-- Content -->
			<div class="session-details__content scroll-container">
				<!-- Session Info Card -->
				<div class="session-info-card">
					<div class="session-info-header">
						<div class="session-date-time">
							<div class="session-date">{{ formatDate(session.completed_at) }}</div>
							<div class="session-time">{{ formatTime(session.completed_at) }}</div>
						</div>
						<div class="muscle-tags" v-if="session.muscle_groups">
							<van-tag type="primary" plain>{{ session.muscle_groups.primary }}</van-tag>
							<van-tag 
								v-for="muscle in session.muscle_groups.secondary"
								:key="muscle"
								type="success"
								plain
							>
								{{ muscle }}
							</van-tag>
						</div>
					</div>
					
					<div class="session-stats-grid">
						<div class="session-stat">
							<Icon icon="material-symbols:calendar-month" width="20" height="20" />
							<div class="session-stat__content">
								<div class="session-stat__value">{{ session.day_name }}</div>
								<div class="session-stat__label">День программы</div>
							</div>
						</div>
						<div class="session-stat">
							<Icon icon="material-symbols:schedule" width="20" height="20" />
							<div class="session-stat__content">
								<div class="session-stat__value">{{ session.duration_minutes || '—' }} мин</div>
								<div class="session-stat__label">Длительность</div>
							</div>
						</div>
						<div class="session-stat">
							<Icon icon="material-symbols:sports-gymnastics" width="20" height="20" />
							<div class="session-stat__content">
								<div class="session-stat__value">{{ session.exercises_count }}</div>
								<div class="session-stat__label">Упражнений</div>
							</div>
						</div>
						<div class="session-stat">
							<Icon icon="material-symbols:list-alt" width="20" height="20" />
							<div class="session-stat__content">
								<div class="session-stat__value">{{ session.total_sets }}</div>
								<div class="session-stat__label">Подходов</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Session Comments -->
				<div v-if="session.comments" class="session-comments-card">
					<h4 class="card-title">
						<Icon icon="material-symbols:comment" width="20" height="20" />
						Комментарии к тренировке
					</h4>
					<p class="session-comments__text">{{ session.comments }}</p>
				</div>

				<!-- Loading State -->
				<div v-if="isLoadingDetails" class="loading-card">
					<van-loading size="24px" />
					<span>Загружаем детали упражнений...</span>
				</div>

				<!-- Exercises List -->
				<div v-else-if="sessionExercises.length > 0" class="exercises-section">
					<h4 class="section-title">
						<Icon icon="material-symbols:fitness-center" width="20" height="20" />
						Упражнения и подходы
					</h4>
					
					<div class="exercises-list">
						<div 
							v-for="(exercise, index) in sessionExercises"
							:key="exercise.day_exercise_id"
							class="exercise-card"
						>
							<!-- Exercise Header -->
							<div class="exercise-header">
								<div class="exercise-number">{{ index + 1 }}</div>
								<div class="exercise-info">
									<h5 class="exercise-name">{{ exercise.exercise_name }}</h5>
									<div class="exercise-summary">
										{{ exercise.sets.length }}/{{ exercise.planned_sets }} подходов выполнено
									</div>
								</div>
								<div class="exercise-work-weight" v-if="exercise.work_weight">
									<span class="work-weight-label">Рабочий вес</span>
									<span class="work-weight-value">{{ exercise.work_weight }} кг</span>
								</div>
							</div>

							<!-- Sets List -->
							<div class="sets-list" v-if="exercise.sets.length > 0">
								<div class="sets-header">
									<span>№</span>
									<span>Повторения</span>
									<span>Вес</span>
									<span>RPE/RIR</span>
								</div>
								
								<div 
									v-for="set in exercise.sets"
									:key="set.id"
									class="set-item"
								>
									<div class="set-row">
										<span class="set-number">{{ set.set_number }}</span>
										<span class="set-reps">{{ set.reps_completed || '—' }}</span>
										<span class="set-weight">{{ set.weight_used ? `${set.weight_used} кг` : '—' }}</span>
										<span class="set-rpe">{{ formatRPERIRForDisplay(set.rpe_rir) || '—' }}</span>
									</div>
									
									<!-- Комментарий к подходу -->
									<div v-if="set.notes" class="set-comment">
										<van-icon name="comment-o" />
										<span class="set-comment-text">{{ set.notes }}</span>
									</div>
								</div>
							</div>

							<!-- Empty State -->
							<div v-else class="exercise-empty-state">
								<van-icon name="info-o" />
								<span>Данные о подходах не записаны</span>
							</div>
						</div>
					</div>
				</div>

				<!-- No Exercises State -->
				<div v-else-if="!isLoadingDetails" class="no-exercises-card">
					<van-icon name="info-o" />
					<div class="no-exercises-content">
						<h4>Нет данных об упражнениях</h4>
						<p>Возможно, эта тренировка была записана в старой версии приложения</p>
					</div>
				</div>
			</div>
		</div>
	</van-popup>
	
	<!-- Custom Share Sheet -->
	<van-popup
		v-model:show="showShareSheet"
		position="bottom"
		round
		class="share-popup"
	>
		<div class="share-container">
			<div class="share-header">
				<h3>Поделиться</h3>
			</div>
			
			<div class="share-options">
				<div class="share-row">
					<button class="share-option" @click="onShareSelect('telegram')">
						<Icon icon="ic:baseline-telegram" width="32" height="32" color="#0088cc" />
						<span>Telegram</span>
					</button>
					<button class="share-option" @click="onShareSelect('whatsapp')">
						<Icon icon="ic:baseline-whatsapp" width="32" height="32" color="#25D366" />
						<span>WhatsApp</span>
					</button>
					<button class="share-option" @click="onShareSelect('viber')">
						<Icon icon="simple-icons:viber" width="32" height="32" color="#665CAC" />
						<span>Viber</span>
					</button>
					<button class="share-option" @click="onShareSelect('messenger')">
						<Icon icon="ic:baseline-chat" width="32" height="32" color="#0084FF" />
						<span>Messenger</span>
					</button>
				</div>
				<div class="share-row">
					<button class="share-option" @click="onShareSelect('copy')">
						<Icon icon="ic:baseline-content-copy" width="32" height="32" color="#323233" />
						<span>Копировать</span>
					</button>
					<button class="share-option" @click="onShareSelect('more')">
						<Icon icon="ic:baseline-more-horiz" width="32" height="32" color="#969799" />
						<span>Ещё</span>
					</button>
					<button class="share-option" @click="onShareSelect('sms')">
						<Icon icon="ic:baseline-sms" width="32" height="32" color="#07C160" />
						<span>SMS</span>
					</button>
					<button class="share-option" @click="onShareSelect('email')">
						<Icon icon="ic:baseline-email" width="32" height="32" color="#FF6B35" />
						<span>Email</span>
					</button>
				</div>
			</div>
		</div>
	</van-popup>
	
	<!-- Text Editor Popup for Copy -->
	<van-popup
		v-model:show="showTextEditor"
		position="bottom"
		round
		:style="{ height: '60%' }"
		class="text-editor-popup"
	>
		<div class="text-editor-container">
			<div class="text-editor-header">
				<button class="text-editor-cancel" @click="cancelTextEdit">
					Отмена
				</button>
				<h3 class="text-editor-title">Редактировать текст</h3>
				<button class="text-editor-copy" @click="copyEditedText">
					Копировать
				</button>
			</div>
			<div class="text-editor-content">
				<van-field
					v-model="editableShareText"
					type="textarea"
					placeholder="Текст для экспорта..."
					:autosize="{ minHeight: 300 }"
					show-word-limit
					class="text-editor-field"
				/>
			</div>
		</div>
	</van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { parseRPERIR } from '@/utils/rpeRirParser';
import { type TrainingHistory, type SessionExerciseData, useSessionsStore } from '@/stores/sessions';
import { showToast, showNotify } from 'vant';
import { Icon } from '@iconify/vue';

// Props & Emits
interface Props {
	session: TrainingHistory | null;
	modelValue: boolean;
}

interface Emits {
	(e: 'update:modelValue', value: boolean): void;
	(e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Store
const sessionsStore = useSessionsStore();

// Reactive state
const sessionExercises = ref<SessionExerciseData[]>([]);
const isLoadingDetails = ref(false);
const showShareSheet = ref(false);
const showTextEditor = ref(false);
const editableShareText = ref('');

// Computed
const isVisible = computed({
	get: () => props.modelValue,
	set: (value: boolean) => emit('update:modelValue', value)
});

// Watch for session changes to load exercise details
watch(() => props.session, async (newSession) => {
	if (newSession) {
		await loadSessionExerciseDetails(newSession.id);
	} else {
		sessionExercises.value = [];
	}
}, { immediate: true });

// Methods
function closePopup() {
	isVisible.value = false;
}

async function loadSessionExerciseDetails(sessionId: number) {
	isLoadingDetails.value = true;
	try {
		const exercises = await sessionsStore.loadSessionExerciseDetails(sessionId);
		sessionExercises.value = exercises;
	} catch (error) {
		console.error('Failed to load session exercise details:', error);
		showToast('Ошибка загрузки деталей тренировки');
		sessionExercises.value = [];
	} finally {
		isLoadingDetails.value = false;
	}
}

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

function formatTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString('ru-RU', {
		hour: '2-digit',
		minute: '2-digit'
	});
}

function shareSession() {
	if (!props.session) return;
	showShareSheet.value = true;
}

function onShareSelect(platform: string) {
	if (!props.session) return;
	
	const shareText = generateDetailedShareText();
	
	switch (platform) {
		case 'telegram':
			shareToTelegram(shareText);
			showShareSheet.value = false;
			break;
		case 'whatsapp':
			shareToWhatsApp(shareText);
			showShareSheet.value = false;
			break;
		case 'viber':
			shareToViber(shareText);
			showShareSheet.value = false;
			break;
		case 'messenger':
			shareToMessenger(shareText);
			showShareSheet.value = false;
			break;
		case 'copy':
			// Копировать - показываем текстовый редактор
			editableShareText.value = shareText;
			showTextEditor.value = true;
			showShareSheet.value = false;
			break;
		case 'sms':
			shareToSMS(shareText);
			showShareSheet.value = false;
			break;
		case 'email':
			shareToEmail(shareText);
			showShareSheet.value = false;
			break;
		case 'more':
			shareNative(shareText);
			showShareSheet.value = false;
			break;
	}
}

function shareToTelegram(text: string) {
	const telegramUrl = `https://t.me/share/url?text=${encodeURIComponent(text)}`;
	window.open(telegramUrl, '_blank');
	
	showNotify({ 
		type: 'success', 
		message: 'Открыт Telegram для отправки' 
	});
}

function shareToWhatsApp(text: string) {
	const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
	window.open(whatsappUrl, '_blank');
	
	showNotify({ 
		type: 'success', 
		message: 'Открыт WhatsApp для отправки' 
	});
}

function shareToViber(text: string) {
	const viberUrl = `viber://forward?text=${encodeURIComponent(text)}`;
	window.open(viberUrl, '_blank');
	
	showNotify({ 
		type: 'success', 
		message: 'Открыт Viber для отправки' 
	});
}

function shareToMessenger(text: string) {
	const messengerUrl = `fb-messenger://share/?text=${encodeURIComponent(text)}`;
	window.open(messengerUrl, '_blank');
	
	showNotify({ 
		type: 'success', 
		message: 'Открыт Messenger для отправки' 
	});
}

function shareToSMS(text: string) {
	const smsUrl = `sms:?body=${encodeURIComponent(text)}`;
	window.open(smsUrl, '_blank');
	
	showNotify({ 
		type: 'success', 
		message: 'Открыт SMS для отправки' 
	});
}

function shareToEmail(text: string) {
	const emailUrl = `mailto:?subject=${encodeURIComponent('Тренировка из Training Planner')}&body=${encodeURIComponent(text)}`;
	window.open(emailUrl, '_blank');
	
	showNotify({ 
		type: 'success', 
		message: 'Открыт Email для отправки' 
	});
}

function shareNative(text: string) {
	if (navigator.share) {
		navigator.share({
			title: 'Тренировка из Training Planner',
			text: text
		});
	} else {
		// Fallback - копируем в буфер обмена
		copyToClipboard(text, 'Скопировано в буфер обмена');
	}
}

function cancelTextEdit() {
	showTextEditor.value = false;
	editableShareText.value = '';
}

function copyEditedText() {
	copyToClipboard(editableShareText.value, 'Текст скопирован в буфер обмена');
	showTextEditor.value = false;
	editableShareText.value = '';
}

function generateDetailedShareText(): string {
	if (!props.session) return '';
	
	// Создаем базовый текст с информацией о тренировке
	let text = `🏋️ Тренировка: ${props.session.program_name} - ${props.session.day_name}
📅 ${formatDate(props.session.completed_at)} в ${formatTime(props.session.completed_at)}`;

	// Добавляем информацию о мышцах если есть
	if (props.session.muscle_groups) {
		text += `\n💪 Мышцы: ${props.session.muscle_groups.primary}${props.session.muscle_groups.secondary.length > 0 ? ', ' + props.session.muscle_groups.secondary.join(', ') : ''}`;
	}
	
	text += `\n📊 ${props.session.exercises_count} упражнений, ${props.session.total_sets} подходов
⏱️ Длительность: ${props.session.duration_minutes || '—'} мин`;

	// Добавляем комментарий если есть
	if (props.session.comments) {
		text += `\n\n💬 ${props.session.comments}`;
	}
	
	// Добавляем детали упражнений если есть
	if (sessionExercises.value.length > 0) {
		text += '\n\n📋 УПРАЖНЕНИЯ:\n';
		
		sessionExercises.value.forEach((exercise, index) => {
			text += `\n${index + 1}. ${exercise.exercise_name}`;
			if (exercise.work_weight) {
				text += ` (${exercise.work_weight} кг)`;
			}
			text += `\n   ${exercise.sets.length}/${exercise.planned_sets} подходов:\n`;
			
			exercise.sets.forEach(set => {
				text += `   • ${set.set_number}: ${set.reps_completed || '—'} повт.`;
				if (set.weight_used) text += `, ${set.weight_used} кг`;
				const display = formatRPERIRForDisplay(set.rpe_rir);
				if (display) text += `, ${display}`;
				if (set.notes) text += ` (${set.notes})`;
				text += '\n';
			});
		});
	}
	
	// Добавляем брендинг
	text += '\n\n📱 Сделано с помощью Training Planner';
	
	return text;
}

// Local helper to format RPE/RIR consistently for display
function formatRPERIRForDisplay(rpeRirString: string | null): string {
	const { rpe, rir } = parseRPERIR(rpeRirString);
	if (rpe === null && rir === null) return '';
	if (rir === null && rpe !== null) return `RPE ${rpe}`;
	const rpePart = rpe !== null ? `RPE ${rpe}` : 'RPE ?';
	const rirPart = rir !== null ? `RIR ${rir}` : 'RIR ?';
	return `${rpePart} / ${rirPart}`;
}

function copyToClipboard(text: string, successMessage: string) {
	if (navigator.clipboard) {
		navigator.clipboard.writeText(text).then(() => {
			showNotify({ 
				type: 'success', 
				message: successMessage,
				duration: 2000
			});
		});
	} else {
		// Fallback для старых браузеров
		const textArea = document.createElement('textarea');
		textArea.value = text;
		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand('copy');
		document.body.removeChild(textArea);
		
		showNotify({ 
			type: 'success', 
			message: successMessage,
			duration: 2000
		});
	}
}
</script>

<style lang="scss" scoped>
.session-details-popup {
	:deep(.van-popup) {
		background: var(--color-bg);
	}
}

.session-details {
	height: 100%;
	display: flex;
	flex-direction: column;
	background: var(--color-bg);
}

.session-details__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-4);
	border-bottom: 1px solid var(--color-border);
	flex-shrink: 0;

	.back-btn, .share-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--color-bg-elevated);
		border: none;
		color: var(--color-text);
		cursor: pointer;
		transition: all 0.2s ease;

		:deep(svg) {
			color: var(--color-text);
		}

		&:hover {
			background: var(--color-bg-pressed);
		}
	}

	.session-details__title {
		flex: 1;
		text-align: center;
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		color: var(--color-text);
		margin: 0 var(--space-3);
	}
}

.session-details__content {
	flex: 1;
	padding: var(--space-4);
	overflow-y: auto;
}

.session-info-card {
	background: var(--color-bg-elevated);
	border-radius: var(--radius-lg);
	padding: var(--space-4);
	margin-bottom: var(--space-4);
	border: 1px solid var(--color-border);
}

.session-info-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	margin-bottom: var(--space-4);
	gap: var(--space-3);
}

.session-date-time {
	.session-date {
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		color: var(--color-text);
		margin-bottom: var(--space-1);
	}

	.session-time {
		font-size: var(--fs-sm);
		color: var(--color-text-secondary);
	}
}

.muscle-tags {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-1);
	align-items: center;
}

:deep(.muscle-tags .van-tag) {
	font-size: var(--fs-xxs);
	border-radius: var(--radius-s);
	padding: 2px 6px;
	border: 1px solid transparent;
	cursor: pointer;
	transition: all var(--dur-2) var(--ease-std);
	user-select: none;
	
	&:hover {
		transform: scale(1.05);
		box-shadow: var(--shadow-xs);
	}
	
	&:active {
		transform: scale(0.98);
	}
}

:deep(.muscle-tags .van-tag--primary) {
	background: var(--color-accent-subtle);
	color: var(--color-accent);
	border-color: var(--color-accent-subtle);
}

:deep(.muscle-tags .van-tag--success) {
	background: var(--color-success-subtle);
	color: var(--color-success);
	border-color: var(--color-success-subtle);
}

.session-stats-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--space-3);

	@media (min-width: 480px) {
		grid-template-columns: repeat(4, 1fr);
	}
}

.session-stat {
	display: flex;
	align-items: center;
	gap: var(--space-2);

	:deep(svg) {
		color: var(--color-accent);
		flex-shrink: 0;
	}

	&__content {
		min-width: 0;
	}

	&__value {
		font-weight: var(--fw-bold);
		color: var(--color-text);
		font-size: var(--fs-md);
		line-height: 1.2;
	}

	&__label {
		font-size: var(--fs-sm);
		color: var(--color-text-secondary);
		line-height: 1.2;
	}
}

.session-comments-card {
	background: var(--color-bg-elevated);
	border-radius: var(--radius-lg);
	padding: var(--space-4);
	margin-bottom: var(--space-4);
	border: 1px solid var(--color-border);

	.card-title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--color-text);
		margin: 0 0 var(--space-3) 0;

		.van-icon {
			color: var(--color-accent);
		}
	}

	&__text {
		color: var(--color-text-secondary);
		line-height: 1.5;
		margin: 0;
	}
}

.loading-card {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-3);
	padding: var(--space-6);
	background: var(--color-bg-elevated);
	border-radius: var(--radius-lg);
	border: 1px solid var(--color-border);
	color: var(--color-text-secondary);
	margin-bottom: var(--space-4);
}

.exercises-section {
	margin-bottom: var(--space-4);

	.section-title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		color: var(--color-text);
		margin: 0 0 var(--space-4) 0;

		.van-icon {
			color: var(--color-accent);
		}
	}
}

.exercises-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
}

.exercise-card {
	background: var(--color-bg-elevated);
	border-radius: var(--radius-lg);
	border: 1px solid var(--color-border);
	overflow: hidden;
}

.exercise-header {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-4);
	background: var(--color-bg-elevated);

	.exercise-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: var(--color-accent);
		color: white;
		border-radius: 50%;
		font-weight: var(--fw-bold);
		font-size: var(--fs-sm);
		flex-shrink: 0;
	}

	.exercise-info {
		flex: 1;
		min-width: 0;

		.exercise-name {
			font-size: var(--fs-md);
			font-weight: var(--fw-semibold);
			color: var(--color-text);
			margin: 0 0 var(--space-1) 0;
		}

		.exercise-summary {
			font-size: var(--fs-sm);
			color: var(--color-text-secondary);
		}
	}

	.exercise-work-weight {
		text-align: right;
		flex-shrink: 0;

		.work-weight-label {
			display: block;
			font-size: var(--fs-xs);
			color: var(--color-text-secondary);
			margin-bottom: 2px;
		}

		.work-weight-value {
			font-weight: var(--fw-bold);
			color: var(--color-accent);
			font-size: var(--fs-sm);
		}
	}
}

.sets-list {
	border-top: 1px solid var(--color-border);

	.sets-header {
		display: grid;
		grid-template-columns: 40px 1fr 1fr 1fr;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		background: var(--color-bg-subtle);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.set-item {
		border-bottom: 1px solid var(--color-border);
		
		&:last-child {
			border-bottom: none;
		}
	}

	.set-row {
		display: grid;
		grid-template-columns: 40px 1fr 1fr 1fr;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		font-size: var(--fs-sm);

		.set-number {
			font-weight: var(--fw-semibold);
			color: var(--color-accent);
		}

		.set-reps, .set-weight, .set-rpe {
			color: var(--color-text);
		}
	}

	.set-comment {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		padding: 0 var(--space-3) var(--space-3);
		background: var(--color-accent-subtle);
		font-size: var(--fs-xs);
		color: var(--color-text-secondary);
		margin-bottom: 0;

		.van-icon {
			color: var(--color-accent);
			font-size: 14px;
			margin-top: 2px; // выравнивание с текстом
			flex-shrink: 0;
		}

		.set-comment-text {
			flex: 1;
			line-height: 1.4;
		}
	}

	// Убираем старые стили
	.set-notes {
		display: none;
	}
}

.exercise-empty-state {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-2);
	padding: var(--space-6);
	color: var(--color-text-secondary);
	font-size: var(--fs-sm);
	border-top: 1px solid var(--color-border);

	.van-icon {
		color: var(--color-text-tertiary);
	}
}

.no-exercises-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	padding: var(--space-6);
	background: var(--color-bg-elevated);
	border-radius: var(--radius-lg);
	border: 1px solid var(--color-border);
	margin-bottom: var(--space-4);

	.van-icon {
		font-size: 48px;
		color: var(--color-text-tertiary);
		margin-bottom: var(--space-3);
	}

	.no-exercises-content {
		h4 {
			font-size: var(--fs-md);
			font-weight: var(--fw-semibold);
			color: var(--color-text);
			margin: 0 0 var(--space-2) 0;
		}

		p {
			font-size: var(--fs-sm);
			color: var(--color-text-secondary);
			margin: 0;
		}
	}
}

// Text Editor Popup Styles
.text-editor-popup {
	:deep(.van-popup) {
		background: var(--color-bg);
	}
}

.text-editor-container {
	height: 100%;
	display: flex;
	flex-direction: column;
	background: var(--color-bg);
}

.text-editor-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-4);
	border-bottom: 1px solid var(--color-border);
	flex-shrink: 0;

	.text-editor-cancel,
	.text-editor-copy {
		background: none;
		border: none;
		font-size: var(--fs-md);
		font-weight: var(--fw-medium);
		padding: var(--space-2) 0;
		cursor: pointer;
		transition: opacity 0.2s ease;

		&:hover {
			opacity: 0.7;
		}
	}

	.text-editor-cancel {
		color: var(--color-text-secondary);
	}

	.text-editor-copy {
		color: var(--color-accent);
	}

	.text-editor-title {
		flex: 1;
		text-align: center;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--color-text);
		margin: 0 var(--space-3);
	}
}

.text-editor-content {
	flex: 1;
	padding: var(--space-4);
	overflow: hidden;

	.text-editor-field {
		height: 50dvh;
		overflow: hidden; /* Предотвращаем двойной скролл */

		:deep(.van-field__control) {
			background: var(--color-bg-elevated);
			border: 1px solid var(--color-border);
			border-radius: var(--radius-md);
			padding: var(--space-3);
			font-size: var(--fs-md);
			line-height: 1.5;
			color: var(--color-text);
			resize: none;
			height: 48dvh !important;
            text-align: left;
			
			/* Включаем тач-скролл для мобильных устройств */
			overflow-y: auto;
			-webkit-overflow-scrolling: touch;
			touch-action: manipulation;
			overscroll-behavior: contain;
			
			/* Стилизация скроллбара */
			&::-webkit-scrollbar {
				width: 4px;
			}
			
			&::-webkit-scrollbar-track {
				background: transparent;
			}
			
			&::-webkit-scrollbar-thumb {
				background: var(--color-text-tertiary);
				border-radius: 2px;
				opacity: 0.5;
			}
			
			&::-webkit-scrollbar-thumb:hover {
				background: var(--color-text-secondary);
				opacity: 0.8;
			}

			&:focus {
				border-color: var(--color-accent);
				box-shadow: 0 0 0 2px var(--color-accent-subtle);
			}

			&::placeholder {
				color: var(--color-text-tertiary);
			}
		}
        :deep(.van-field__body){
            text-align: left;
        }
		:deep(.van-field__word-limit) {
			color: var(--color-text-secondary);
			font-size: var(--fs-xs);
			margin-top: var(--space-2);
		}
	}
}

// Share Popup Styles
.share-popup {
	:deep(.van-popup) {
		background: var(--color-bg-elevated);
		border-radius: var(--radius-xl) var(--radius-xl) 0 0;
	}
}

.share-container {
	padding: var(--space-4);
}

.share-header {
	text-align: center;
	margin-bottom: var(--space-6);
	
	h3 {
		margin: 0;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--color-text);
	}
}

.share-options {
	.share-row {
		display: flex;
		justify-content: space-around;
		margin-bottom: var(--space-4);
		
		&:last-child {
			margin-bottom: 0;
		}
	}
}

.share-option {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-2);
	padding: var(--space-3);
	background: transparent;
	border: none;
	border-radius: var(--radius-lg);
	cursor: pointer;
	transition: all 0.2s ease;
	min-width: 60px;
	
	span {
		font-size: var(--fs-xs);
		color: var(--color-text-secondary);
		font-weight: var(--fw-medium);
	}
	
	&:hover {
		background: var(--color-bg-subtle);
		transform: translateY(-2px);
	}
	
	&:active {
		transform: translateY(0);
		background: var(--color-bg-muted);
	}
}
</style>
