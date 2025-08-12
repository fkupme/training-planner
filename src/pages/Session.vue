<script setup lang="ts">
import { ref } from "vue";

const restSeconds = ref(90);
const running = ref(false);
let timer: number | null = null;

function toggle() {
	if (running.value) {
		running.value = false;
		if (timer) clearInterval(timer);
		timer = null;
	} else {
		running.value = true;
		timer = setInterval(() => {
			if (restSeconds.value > 0) restSeconds.value -= 1;
			else toggle();
		}, 1000) as unknown as number;
	}
}

function reset() {
	restSeconds.value = 90;
}
</script>

<template>
	<van-nav-bar title="Сессия" />
	<div style="padding: 12px">
		<van-cell-group inset>
			<van-cell
				title="Таймер отдыха"
				:label="`${Math.floor(restSeconds / 60)}:${String(
					restSeconds % 60
				).padStart(2, '0')}`"
			/>
			<van-space style="margin-top: 8px">
				<van-button type="primary" @click="toggle">{{
					running ? "Стоп" : "Старт"
				}}</van-button>
				<van-button type="default" @click="reset">Сброс</van-button>
			</van-space>
		</van-cell-group>
		<van-empty
			description="Ввод подходов появится позже"
			style="margin-top: 12px"
		/>
	</div>
</template>
