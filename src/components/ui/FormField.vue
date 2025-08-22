<script setup lang="ts">
import { ThemedCellGroup, ThemedField } from './index';
</script>

<template>
	<ThemedCellGroup inset>
		<ThemedField>
			<template #label>
				<slot name="label" />
			</template>
			<slot />
		</ThemedField>
	</ThemedCellGroup>
</template>
