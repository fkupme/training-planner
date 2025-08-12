<script lang="ts">
// @ts-ignore - Vue SFC default export is provided by shim
import KeyboardPopup from "@/components/ui/KeyboardPopup.vue";
import { useAuthStore } from "@/stores/auth";
import { useUserProfileStore } from "@/stores/userProfile";
import { showToast } from "vant";
import { computed, defineComponent, onMounted, ref } from "vue";

export default defineComponent({
	name: "OnboardingPopup",
	components: { KeyboardPopup },
	props: {
		show: { type: Boolean, required: true },
	},
	emits: ["update:show"],
	setup(props, { emit }) {
		const auth = useAuthStore();
		const profileStore = useUserProfileStore();

		const show = computed({
			get: () => props.show,
			set: (v: boolean) => emit("update:show", v),
		});

		const age = ref<string>("");
		const height_cm = ref<string>("");
		const weight_kg = ref<string>("");
		const training_experience_months = ref<string>("");
		const pharma_flag = ref<boolean>(false);
		const pharma_notes = ref<string>("");
		const one_rm_squat = ref<string>("");
		const one_rm_bench = ref<string>("");
		const one_rm_deadlift = ref<string>("");

		const canSave = computed(() => true);

		onMounted(async () => {
			await auth.initFromSession();
			if (!auth.currentUser) return;
			await profileStore.load(auth.currentUser.id);
			const p = profileStore.profile;
			if (p) {
				age.value = p.age != null ? String(p.age) : "";
				height_cm.value = p.height_cm != null ? String(p.height_cm) : "";
				weight_kg.value = p.weight_kg != null ? String(p.weight_kg) : "";
				training_experience_months.value =
					p.training_experience_months != null
						? String(p.training_experience_months)
						: "";
				pharma_flag.value = !!p.pharma_flag;
				pharma_notes.value = p.pharma_notes ?? "";
				one_rm_squat.value =
					p.one_rm_squat != null ? String(p.one_rm_squat) : "";
				one_rm_bench.value =
					p.one_rm_bench != null ? String(p.one_rm_bench) : "";
				one_rm_deadlift.value =
					p.one_rm_deadlift != null ? String(p.one_rm_deadlift) : "";
			}
		});

		async function saveAndClose() {
			if (!auth.currentUser) return;
			const num = (v: string) => (v.trim() === "" ? null : Number(v));
			await profileStore.save({
				user_id: auth.currentUser.id,
				age: num(age.value),
				height_cm: num(height_cm.value),
				weight_kg: num(weight_kg.value),
				training_experience_months: num(training_experience_months.value),
				pharma_flag: pharma_flag.value,
				pharma_notes: pharma_notes.value || null,
				one_rm_squat: num(one_rm_squat.value),
				one_rm_bench: num(one_rm_bench.value),
				one_rm_deadlift: num(one_rm_deadlift.value),
			});
			showToast("Данные сохранены");
			show.value = false;
		}

		return {
			show,
			age,
			height_cm,
			weight_kg,
			training_experience_months,
			pharma_flag,
			pharma_notes,
			one_rm_squat,
			one_rm_bench,
			one_rm_deadlift,
			canSave,
			saveAndClose,
		};
	},
});
</script>

<template>
	<KeyboardPopup v-model:show="show" height="90%">
		<van-nav-bar title="Персонализация" />
		<div class="onboarding__content">
			<van-cell-group inset class="onboarding__cell-group">
				<van-field
					v-model="age"
					type="number"
					label="Возраст"
					placeholder="лет"
				/>
				<van-field
					v-model="height_cm"
					type="number"
					label="Рост"
					placeholder="см"
				/>
				<van-field
					v-model="weight_kg"
					type="number"
					label="Вес"
					placeholder="кг"
				/>
				<van-field
					v-model="training_experience_months"
					type="number"
					label="Стаж"
					placeholder="мес"
				/>
				<van-field label="Фармакология">
					<template #input>
						<van-switch v-model="pharma_flag" size="20" />
					</template>
				</van-field>
				<van-field
					v-model="pharma_notes"
					type="textarea"
					rows="2"
					label="Описание"
					placeholder="опционально"
				/>
				<van-divider>1ПМ (опционально)</van-divider>
				<van-field
					v-model="one_rm_squat"
					type="number"
					label="Присед 1ПМ"
					placeholder="кг"
				/>
				<van-field
					v-model="one_rm_bench"
					type="number"
					label="Жим 1ПМ"
					placeholder="кг"
				/>
				<van-field
					v-model="one_rm_deadlift"
					type="number"
					label="Тяга 1ПМ"
					placeholder="кг"
				/>
			</van-cell-group>
		</div>
		<van-action-bar>
			<van-action-bar-button
				class="onboarding__action-bar-button onboarding__action-bar-button--skip"
				type="default"
				@click="show = false"
				>Пропустить</van-action-bar-button
			>
			<van-action-bar-button
				type="primary"
				class="onboarding__action-bar-button onboarding__action-bar-button--save"
				block
				round
				:disabled="!canSave"
				@click="saveAndClose"
				>Сохранить</van-action-bar-button
			>
		</van-action-bar>
	</KeyboardPopup>
</template>

<style lang="scss" scoped>
.van-action-bar {
	background: var(--color-bg);
}
.onboarding__cell-group {
	--van-cell-group-border-color: var(--van-border-color-1);
}
.van-field {
	--van-field-label-color: var(--color-text-muted);
	--van-field-input-placeholder-color: var(--color-text);
	--van-field-input-text-color: var(--color-text);
}
.onboarding__content {
	background: var(--color-bg);
	padding: 52px 12px 110px 12px;
}
.onboarding__action-bar-button {
	&--skip {
		background: var(--color-bg);
		color: var(--color-text-muted);
		border: 1px solid var(--color-surface);
	}
}
</style>
