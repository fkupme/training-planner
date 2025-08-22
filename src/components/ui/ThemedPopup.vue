<script lang="ts">
import { defineComponent, type PropType } from 'vue';

type PopupPosition = 'center' | 'top' | 'bottom' | 'left' | 'right';
type PopupCloseIconPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export default defineComponent({
	name: 'ThemedPopup',
	inheritAttrs: false,
	props: {
		show: { type: Boolean, default: false },
		zIndex: { type: [String, Number], default: 2000 },
		overlay: { type: Boolean, default: true },
		position: { type: String as PropType<PopupPosition>, default: 'center' },
		overlayClass: { type: String, default: '' },
		overlayStyle: { type: Object, default: () => ({}) },
		duration: { type: [String, Number], default: 300 },
		round: { type: Boolean, default: false },
		lockScroll: { type: Boolean, default: true },
		lazyRender: { type: Boolean, default: true },
		closeOnClickOverlay: { type: Boolean, default: true },
		closeOnPopstate: { type: Boolean, default: true },
		closeable: { type: Boolean, default: false },
		closeIcon: { type: String, default: 'cross' },
		closeIconPosition: { type: String as PropType<PopupCloseIconPosition>, default: 'top-right' },
		beforeClose: { type: Function as PropType<(...args: any[]) => boolean | void | Promise<boolean> | undefined>, default: undefined },
		iconPrefix: { type: String, default: 'van-icon' },
		transition: { type: String, default: '' },
		transitionAppear: { type: Boolean, default: false },
		teleport: { type: [String, Object], default: 'body' },
		safeAreaInsetBottom: { type: Boolean, default: false },
		safeAreaInsetTop: { type: Boolean, default: false },
	},
	emits: ['update:show', 'clickOverlay', 'clickCloseIcon', 'open', 'close', 'opened', 'closed'],
	setup(_, { emit, attrs }) {
		const onUpdate = (value: boolean) => emit('update:show', value);
		const onClickOverlay = (event: Event) => emit('clickOverlay', event);
		const onClickCloseIcon = (event: Event) => emit('clickCloseIcon', event);
		const onOpen = () => emit('open');
		const onClose = () => emit('close');
		const onOpened = () => emit('opened');
		const onClosed = () => emit('closed');
		
		return {
			onUpdate,
			onClickOverlay,
			onClickCloseIcon,
			onOpen,
			onClose,
			onOpened,
			onClosed,
			attrs,
		};
	},
});
</script>

<template>
	<van-popup
		:show="show"
		:z-index="zIndex"
		:overlay="overlay"
		:position="position"
		:overlay-class="overlayClass"
		:overlay-style="overlayStyle"
		:duration="duration"
		:round="round"
		:lock-scroll="lockScroll"
		:lazy-render="lazyRender"
		:close-on-click-overlay="closeOnClickOverlay"
		:close-on-popstate="closeOnPopstate"
		:closeable="closeable"
		:close-icon="closeIcon"
		:close-icon-position="closeIconPosition"
		:before-close="beforeClose"
		:icon-prefix="iconPrefix"
		:transition="transition"
		:transition-appear="transitionAppear"
		:teleport="teleport"
		:safe-area-inset-bottom="safeAreaInsetBottom"
		:safe-area-inset-top="safeAreaInsetTop"
		@update:show="onUpdate"
		@click-overlay="onClickOverlay"
		@click-close-icon="onClickCloseIcon"
		@open="onOpen"
		@close="onClose"
		@opened="onOpened"
		@closed="onClosed"
		class="themed-popup"
		v-bind="attrs"
	>
		<slot />
	</van-popup>
</template>

<style>
.themed-popup {
	--van-popup-background: var(--color-surface);
	--van-popup-transition: transform var(--dur-3) var(--ease-std);
	--van-popup-round-border-radius: var(--radius-xl);
	--van-popup-close-icon-size: 24px;
	--van-popup-close-icon-color: var(--color-text-muted);
	--van-popup-close-icon-active-color: var(--color-text);
	--van-popup-close-icon-margin: var(--space-4);
	--van-popup-close-icon-z-index: 1;
}

/* Enhanced popup styling */
.themed-popup {
	background: var(--color-surface);
	border-radius: var(--radius-l);
	box-shadow: var(--shadow-lg);
	border: 1px solid var(--color-border);
	backdrop-filter: blur(8px);
}

/* Position-specific styling */
.themed-popup.van-popup--center {
	max-width: 90vw;
	max-height: 90vh;
	margin: var(--space-4);
}

.themed-popup.van-popup--top {
	border-top-left-radius: 0;
	border-top-right-radius: 0;
	border-bottom-left-radius: var(--radius-xl);
	border-bottom-right-radius: var(--radius-xl);
}

.themed-popup.van-popup--bottom {
	border-top-left-radius: var(--radius-xl);
	border-top-right-radius: var(--radius-xl);
	border-bottom-left-radius: 0;
	border-bottom-right-radius: 0;
	padding-bottom: calc(var(--safe-bottom) + var(--space-4));
}

.themed-popup.van-popup--left {
	border-top-left-radius: 0;
	border-bottom-left-radius: 0;
	border-top-right-radius: var(--radius-xl);
	border-bottom-right-radius: var(--radius-xl);
}

.themed-popup.van-popup--right {
	border-top-left-radius: var(--radius-xl);
	border-bottom-left-radius: var(--radius-xl);
	border-top-right-radius: 0;
	border-bottom-right-radius: 0;
}

/* Round variant */
.themed-popup.van-popup--round {
	border-radius: var(--radius-xl);
}

/* Close icon styling */
.themed-popup .van-popup__close-icon {
	color: var(--color-text-muted);
	font-size: 24px;
	transition: all var(--dur-2) var(--ease-std);
	padding: var(--space-2);
	border-radius: 50%;
	background: rgba(var(--color-text-muted-rgb, 107, 114, 128), 0.1);
}

.themed-popup .van-popup__close-icon:hover {
	color: var(--color-text);
	background: rgba(var(--color-text-rgb, 31, 41, 55), 0.1);
	transform: scale(1.1);
}

.themed-popup .van-popup__close-icon:active {
	transform: scale(0.95);
}

/* Enhanced backdrop blur effect */
@supports (backdrop-filter: blur(8px)) {
	.themed-popup {
		background: rgba(var(--color-surface-rgb, 255, 255, 255), 0.95);
		backdrop-filter: blur(8px);
	}
}

/* Content padding utilities */
.themed-popup.padded {
	padding: var(--space-6);
}

.themed-popup.padded-sm {
	padding: var(--space-4);
}

.themed-popup.padded-lg {
	padding: var(--space-8);
}

/* Safe area handling */
.themed-popup.van-popup--safe-area-inset-top {
	padding-top: calc(var(--safe-top, env(safe-area-inset-top)) + var(--space-4));
}

.themed-popup.van-popup--safe-area-inset-bottom {
	padding-bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + var(--space-4));
}

/* Content organization */
.themed-popup .popup-header {
	padding: var(--space-4) var(--space-6);
	border-bottom: 1px solid var(--color-border);
	border-radius: var(--radius-l) var(--radius-l) 0 0;
	background: var(--color-elevated);
}

.themed-popup .popup-content {
	padding: var(--space-6);
	max-height: 60vh;
	overflow-y: auto;
}

.themed-popup .popup-footer {
	padding: var(--space-4) var(--space-6);
	border-top: 1px solid var(--color-border);
	border-radius: 0 0 var(--radius-l) var(--radius-l);
	background: var(--color-elevated);
}

/* Animation improvements */
.themed-popup.van-popup--center.van-popup-slide-fade-enter-active,
.themed-popup.van-popup--center.van-popup-slide-fade-leave-active {
	transition: all var(--dur-3) var(--ease-std);
}

.themed-popup.van-popup--center.van-popup-slide-fade-enter-from,
.themed-popup.van-popup--center.van-popup-slide-fade-leave-to {
	opacity: 0;
	transform: scale(0.9) translateY(10px);
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
	.themed-popup {
		border-color: var(--color-border);
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
	}
	
	@supports (backdrop-filter: blur(8px)) {
		.themed-popup {
			background: rgba(var(--color-surface-rgb, 34, 38, 47), 0.95);
		}
	}
}

/* Responsive design */
@media (max-width: 640px) {
	.themed-popup.van-popup--center {
		margin: var(--space-2);
		max-width: calc(100vw - var(--space-4));
	}
	
	.themed-popup .popup-content {
		max-height: 50vh;
	}
}

/* Accessibility improvements */
.themed-popup[role="dialog"] {
	outline: none;
}

.themed-popup:focus-visible {
	outline: 2px solid var(--color-accent);
	outline-offset: 2px;
}
</style>