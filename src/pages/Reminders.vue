<script setup lang="ts">
import {
	isPermissionGranted,
	requestPermission,
	sendNotification,
} from "@tauri-apps/plugin-notification";
import { onMounted } from "vue";

onMounted(async () => {
	let granted = await isPermissionGranted();
	if (!granted) {
		const permission = await requestPermission();
		granted = permission === "granted";
	}
	if (granted) {
		// Тестовое уведомление при открытии страницы
		sendNotification({ title: "Напоминания", body: "Уведомления включены" });
	}
});
</script>

<template>
	<van-nav-bar title="Напоминания" />
	<div style="padding: 12px">
		<van-cell-group inset>
			<van-cell title="Тренировки" value="настроить" is-link />
			<van-cell title="Добавки/Препараты" value="настроить" is-link />
		</van-cell-group>
		<van-empty
			description="Здесь будут расписания и интервалы (в т.ч. 2.5 дня)"
		></van-empty>
	</div>
</template>
