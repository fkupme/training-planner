<script setup lang="ts">
import { computed, defineEmits, defineProps, ref } from 'vue';

interface SearchSuggestion {
	id: string;
	text: string;
	type: 'muscle' | 'equipment' | 'category' | 'recent';
	icon?: string;
}

interface Props {
	modelValue: string;
	placeholder?: string;
	suggestions?: SearchSuggestion[];
	showSuggestions?: boolean;
	loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	placeholder: 'Поиск...',
	showSuggestions: true,
	loading: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', value: string): void;
	(e: 'search', query: string): void;
	(e: 'select-suggestion', suggestion: SearchSuggestion): void;
	(e: 'focus'): void;
	(e: 'blur'): void;
}>();

const inputRef = ref<HTMLInputElement>();
const isFocused = ref(false);
const isComposing = ref(false);

const localValue = computed({
	get: () => props.modelValue,
	set: (value: string) => emit('update:modelValue', value),
});

const showDropdown = computed(() => 
	isFocused.value && 
	props.showSuggestions && 
	props.suggestions?.length &&
	localValue.value.length >= 0
);

function onFocus() {
	isFocused.value = true;
	emit('focus');
}

function onBlur() {
	// Небольшая задержка чтобы клик по suggestion успел сработать
	setTimeout(() => {
		isFocused.value = false;
		emit('blur');
	}, 150);
}

function onInput(e: Event) {
	if (!isComposing.value) {
		const value = (e.target as HTMLInputElement).value;
		localValue.value = value;
		emit('search', value);
	}
}

function onCompositionStart() {
	isComposing.value = true;
}

function onCompositionEnd(e: CompositionEvent) {
	isComposing.value = false;
	const value = (e.target as HTMLInputElement).value;
	localValue.value = value;
	emit('search', value);
}

function selectSuggestion(suggestion: SearchSuggestion) {
	localValue.value = suggestion.text;
	emit('select-suggestion', suggestion);
	emit('search', suggestion.text);
	inputRef.value?.blur();
}

function clear() {
	localValue.value = '';
	emit('search', '');
	inputRef.value?.focus();
}

function getIconForType(type: string): string {
	switch (type) {
		case 'muscle': return '💪';
		case 'equipment': return '🏋️';
		case 'category': return '📁';
		case 'recent': return '🕐';
		default: return '🔍';
	}
}
</script>

<template>
	<div class="smart-search">
		<div class="smart-search__input-wrapper">
			<van-icon name="search" class="smart-search__icon" />
			<input
				ref="inputRef"
				:value="localValue"
				:placeholder="placeholder"
				class="smart-search__input"
				@input="onInput"
				@focus="onFocus"
				@blur="onBlur"
				@compositionstart="onCompositionStart"
				@compositionend="onCompositionEnd"
			/>
			<van-loading
				v-if="loading"
				type="spinner"
				size="16px"
				class="smart-search__loading"
			/>
			<van-icon
				v-else-if="localValue"
				name="clear"
				class="smart-search__clear"
				@click="clear"
			/>
		</div>
		
		<transition name="dropdown">
			<div v-if="showDropdown" class="smart-search__dropdown">
				<div
					v-for="suggestion in suggestions"
					:key="suggestion.id"
					class="smart-search__suggestion"
					@click="selectSuggestion(suggestion)"
				>
					<span class="smart-search__suggestion-icon">
						{{ suggestion.icon || getIconForType(suggestion.type) }}
					</span>
					<span class="smart-search__suggestion-text">{{ suggestion.text }}</span>
					<span class="smart-search__suggestion-type">{{ suggestion.type }}</span>
				</div>
			</div>
		</transition>
	</div>
</template>

<style lang="scss" scoped>
.smart-search {
	position: relative;
	width: 100%;

	&__input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-l);
		box-shadow: var(--shadow-xs);
		transition: all var(--dur-2) var(--ease-std);
		
		&:focus-within {
			border-color: var(--color-accent);
			box-shadow: var(--shadow-sm), 0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent);
		}
	}

	&__icon {
		position: absolute;
		left: var(--space-3);
		color: var(--color-text-muted);
		font-size: 18px;
		z-index: 1;
	}

	&__input {
		flex: 1;
		padding: var(--space-3) var(--space-5) var(--space-3) calc(var(--space-3) + 24px);
		border: none;
		outline: none;
		background: transparent;
		font-size: var(--fs-md);
		color: var(--color-text);
		
		&::placeholder {
			color: var(--color-text-muted);
		}
	}

	&__loading,
	&__clear {
		position: absolute;
		right: var(--space-3);
		color: var(--color-text-muted);
		cursor: pointer;
		z-index: 1;
		
		&:hover {
			color: var(--color-text);
		}
	}

	&__dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-m);
		box-shadow: var(--shadow-md);
		z-index: 1000;
		max-height: 200px;
		overflow-y: auto;
	}

	&__suggestion {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		cursor: pointer;
		transition: background-color var(--dur-1) var(--ease-std);
		
		&:hover {
			background: var(--color-elevated);
		}
		
		&:not(:last-child) {
			border-bottom: 1px solid var(--color-border);
		}
	}

	&__suggestion-icon {
		font-size: 16px;
		width: 20px;
		text-align: center;
	}

	&__suggestion-text {
		flex: 1;
		font-size: var(--fs-sm);
		color: var(--color-text);
	}

	&__suggestion-type {
		font-size: var(--fs-xs);
		color: var(--color-text-muted);
		text-transform: capitalize;
	}
}

.dropdown-enter-active,
.dropdown-leave-active {
	transition: all var(--dur-2) var(--ease-std);
}

.dropdown-enter-from,
.dropdown-leave-to {
	opacity: 0;
	transform: translateY(-8px);
}
</style>
