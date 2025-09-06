<template>
    <div class="field-wrapper">
        <div class="field-label">

            <slot name="label">
                {{ label || title }}
            </slot>
        </div>
        <div class="field-content">
            <slot name="input">
                <van-field
                    v-model="modelValue"
                    :placeholder="placeholder"
                    :type="type"
                    :disabled="disabled"
                    :readonly="readonly"
                    :maxlength="maxlength"
                    :rules="rules"
                    :error-message="errorMessage"
                    :clearable="clearable"
                    input-align="right"
                    :formatter="formatter"
                    :autosize="autosize"
                    @focus="onFocus"
                    @blur="onBlur"
                    @input="onInput"
                    @change="onChange"
                >
                    <template #left-icon>
                        <slot name="left-icon" />
                    </template>
                    <template #right-icon>
                        <slot name="right-icon" />
                    </template>
                    <template #button>
                        <slot name="button" />
                    </template>
                </van-field>
            </slot>
        </div>
    </div>
</template>
<style scoped>
.field-wrapper {
    display: flex;
    flex-direction: row;
    align-items: center;
    width: 100%;
    padding-left: var(--space-1);
   
}
.field-label {
    flex: 1;
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
    padding-right: 8px;
    white-space: nowrap;

}
.field-content {
    flex: 4;
    display: flex;
    align-items: center;
    justify-content: flex-end;
}
.field-content .van-field__control {
    text-align: right;
}
</style>

<script setup lang="ts">
import { ref, watch, defineEmits } from 'vue';

import type { FieldProps } from 'vant';

type FieldType = FieldProps['type'];

interface Props {
    modelValue: string | number;
    label?: string;
    title?: string;
    placeholder?: string;
    type?: FieldType;
    disabled?: boolean;
    readonly?: boolean;
    maxlength?: number;
    rules?: any[];
    errorMessage?: string;
    clearable?: boolean;
    inputAlign?: string;
    formatter?: (val: string) => string;
    autosize?: boolean | object;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:modelValue', 'focus', 'blur', 'input', 'change']);

const modelValue = ref(props.modelValue);

watch(() => props.modelValue, (val) => {
    modelValue.value = val;
});

function onInput(val: string | number | InputEvent) {
    let value = val;
    // Если пришёл InputEvent, достаём value
    if (val instanceof InputEvent && val.target) {
        // @ts-ignore
        value = val.target.value;
    }
    emit('update:modelValue', value);
    emit('input', value);
}
function onChange(val: string | number) {
    emit('change', val);
}
function onFocus(e: FocusEvent) {
    emit('focus', e);
}
function onBlur(e: FocusEvent) {
    emit('blur', e);
}
</script>
