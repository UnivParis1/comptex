<template>
  <div class="current-ldap-value" v-if="shown">
      actuellement : {{formattedLdapValue}} 
      <span v-if="!opts_.readOnly" @click="revert" title="Utiliser la valeur actuelle du compte" class="glyphicon glyphicon-circle-arrow-up"></span>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { formatValue } from '../../../shared/v_utils.ts';

const props = defineProps<{
    modelValue: string | string[] | Date | undefined,
    ldap_value: string | string[] | Date | undefined,
    opts?: SharedStepAttrOption & CommonStepAttrOptionT<{}>,
}>()
const emit = defineEmits<{
    'update:modelValue': [val: string | string[] | Date],
    shown: [val: boolean],
}>();

const hide = ref(false)

const opts_ = computed(() => props.opts || {})
const formattedLdapValue = computed(() => formatValue(props.ldap_value, opts_.value))
const shown = computed(() => {
          return !hide.value 
            && (props.ldap_value || props.ldap_value === ''/* for checkboxes */) // do we have the LDAP value ?
            && ("" + (props.ldap_value || '')) !== ("" + (props.modelValue || '')) // "true" and true are considered equal
})
watch(shown, () => emit('shown', shown.value), { immediate: true })

function revert() {
    emit('update:modelValue', props.ldap_value);
    hide.value = true;
}
</script>
