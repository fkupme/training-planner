<script setup lang="ts">
// @ts-ignore - Vue SFC default export is provided by shim
import KeyboardPopup from "@/components/ui/KeyboardPopup.vue";
import { EQUIPMENT_OPTIONS, useExercisesStore } from "@/stores/exercises";
import { showDialog, showToast } from "vant";
import { computed, defineEmits, defineProps, ref, watch } from "vue";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{
	(e: "update:show", v: boolean): void;
	(e: "select", id: number): void;
	(e: "select-multiple", ids: number[]): void;
	(e: "open-create"): void;
	(e: "open-edit", id: number): void;
}>();

const modelShow = computed({
	get: () => props.show,
	set: (v: boolean) => emit("update:show", v),
});

const q = ref("");
const ex = useExercisesStore();
const selectedIds = ref<number[]>([]);

async function runSearch() {
	await ex.searchByName(q.value.trim());
}

function pmName(id: number | null) {
	if (!id) return "";
	const m = ex.muscles.find((m) => m.id === id);
	return m?.name || "";
}

function secondaryNamesArray(item: any) {
	const s = item.secondaryNames as string | undefined;
	if (!s) return [] as string[];
	return s.split(",").filter(Boolean);
}

function equipmentLabel(val?: string | null) {
	if (!val) return "";
	return EQUIPMENT_OPTIONS.find((o) => o.value === val)?.label || val;
}

watch(modelShow, async (v) => {
	if (v) {
		q.value = "";
		selectedIds.value = [];
		await ex.loadMuscles();
		await runSearch();
	}
});
watch(q, async () => {
	await runSearch();
});

function toggleSelect(id: number) {
	const i = selectedIds.value.indexOf(id);
	if (i >= 0) selectedIds.value.splice(i, 1);
	else selectedIds.value.push(id);
}

function addSelected() {
	if (selectedIds.value.length === 0) return;
	emit("select-multiple", selectedIds.value.slice());
	modelShow.value = false;
}

function openCreate() {
	modelShow.value = false;
	emit("open-create");
}

async function removeExercise(id: number, name: string) {
	await showDialog({
		title: "Удалить упражнение?",
		message: name,
		showCancelButton: true,
	});
	await ex.deleteExercise?.(id);
	showToast("Удалено");
	await runSearch();
}
</script>

<template>
	<KeyboardPopup title="Выбор упражнения" v-model:show="modelShow" height="90%">
		<div class="picker">
			<van-search
				bordered
				class="picker__search"
				v-model="q"
				placeholder="Название упражнения"
			/>
			<van-list :finished="true">
				<template v-if="ex.list.length > 0">
					<div
						v-for="item in ex.list"
						:key="item.id"
						class="picker-card"
						@click="toggleSelect(item.id)"
					>
						<div class="picker-card__thumb">
							<van-image
								:src="item.media_path || ''"
								width="100%"
								height="100%"
								fit="cover"
							>
								<template #error>
									<div class="picker-card__avatar-fallback">GIF</div>
								</template>
							</van-image>
						</div>
						<div class="picker-card__body">
							<div class="picker-card__header">
								<van-checkbox
									:model-value="selectedIds.includes(item.id)"
									@click.stop="toggleSelect(item.id)"
								/>
								<div class="picker-card__title">{{ item.name }}</div>
								<div class="picker-card__actions">
									<van-icon
										name="edit"
										class="picker-card__icon picker-card__icon--edit"
										@click.stop="emit('open-edit', item.id)"
									/>
									<van-icon
										name="delete-o"
										class="picker-card__icon picker-card__icon--delete"
										@click.stop="removeExercise(item.id, item.name)"
									/>
								</div>
							</div>
							<div class="picker-card__tags">
								<van-tag plain type="primary">{{
									pmName(item.primary_muscle_id)
								}}</van-tag>
								<van-tag
									v-for="sec in secondaryNamesArray(item).slice(0, 3)"
									:key="sec"
									plain
									type="success"
									>{{ sec }}</van-tag
								>
								<van-tag v-if="item.equipment" plain type="warning">{{
									equipmentLabel(item.equipment)
								}}</van-tag>
							</div>
							<van-text-ellipsis
								:content="item.description || 'Описание отсутствует'"
								expand-text="..."
								collapse-text="свернуть"
							/>
						</div>
					</div>
				</template>
				<template v-else>
					<van-empty description="Ничего не найдено" />
				</template>
				<!-- Кнопка создания всегда последняя -->
				<van-cell
					class="picker__create"
					:title="'Создать упражнение'"
					is-link
					@click="openCreate"
				/>
			</van-list>
			<div class="picker__footer">
				<van-button
					type="primary"
					class="picker__add-btn"
					:disabled="selectedIds.length === 0"
					@click="addSelected"
					>Добавить выбранные</van-button
				>
			</div>
		</div>
	</KeyboardPopup>
</template>

<style lang="scss" scoped>
.picker {
	background: var(--color-bg);
	padding: 52px var(--space-3) 82px var(--space-3);

	&__search {
		background-color: var(--color-bg);
	}
	&__create :deep(.van-cell__title) {
		color: var(--van-blue);
		font-weight: var(--fw-semibold);
	}
	&__footer {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		padding: var(--space-3) var(--space-3) calc(var(--space-3) + 10px)
			var(--space-3);
		background-color: var(--color-bg);
	}
	&__add-btn {
		margin-top: var(--space-2);
		background-color: var(--color-accent);
		color: var(--color-accent-contrast);
		width: 100%;
	}
}

.picker-card {
	display: grid;
	grid-template-columns: 33% 1fr;
	gap: 10px;
	padding: 8px 6px;
	border-bottom: 1px solid var(--van-border-color);

	&__thumb {
		width: 100%;
		aspect-ratio: 1;
		border-radius: var(--radius-m);
		overflow: hidden;
		background: var(--color-surface);
		border: 1px solid var(--van-border-color);
	}
	&__avatar-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-muted);
	}
	&__body {
		// container for header, tags, description
	}
	&__header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-2);
	}
	&__actions {
		display: inline-flex;
		gap: var(--space-2);
	}
	&__title {
		font-weight: var(--fw-semibold);
	}
	&__icon--edit {
		color: var(--van-blue);
	}
	&__icon--delete {
		color: var(--van-red);
	}
	&__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 6px 0;
	}
	&__tags :deep(.van-tag) {
		font-size: 11px;
	}
}
</style>
