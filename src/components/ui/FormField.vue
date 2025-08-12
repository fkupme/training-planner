<script setup lang="ts">
</script>

<template>
	<van-cell-group inset>
		<van-field>
			<template #label>
				<slot name="label" />
			</template>
			<slot />
		</van-field>
	</van-cell-group>
</template>
