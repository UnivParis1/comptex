<template>
  <my-bootstrap-form-group :name="name" :opts="opts" :validity="validity">
    <span :class="{ inputWithButton: todayButton }">
      <input-with-validity :name="name" v-model="val" type="date"
         :disabled="opts.readOnly"
         :min="min" :max="max" :required="!opts.optional" v-model:validity="validity[name]"></input-with-validity>
      <button v-if="todayButton" class="btn btn-primary" type="button" @click="set_today">{{todayButton}}</button>
    </span>
    <CurrentLdapValue :modelValue="initial_val" :ldap_value="ldap_val" :opts="opts" @update:modelValue="v => val = (v as string)"></CurrentLdapValue>
    <span class="attr-description" v-html="opts.description"></span>
  </my-bootstrap-form-group>
</template>

<script lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { toYYYY_MM_DD, to_absolute_date } from "../services/helpers";
import CurrentLdapValue from './CurrentLdapValue.vue';

const init = toYYYY_MM_DD;

</script>
<script setup lang="ts">
const props = defineProps<{
    name: string,
    modelValue: Date | undefined,
    opts?: SharedStepAttrOption & CommonStepAttrOptionT<{}>,
    ldap_value: Date | undefined,
}>()
const emit = defineEmits<{
    'update:modelValue': [val: Date],
}>();

const val = ref(init(props.modelValue) as string)
const ldap_val = ref(init(props.ldap_value))
const validity = reactive({ [props.name]: {} as ValidityState })
const initial_val = val.value

const date = computed(() => val.value && new Date(val.value) || undefined)

watch(() => props.modelValue, (date_) => {
    if (date_ && date_ !== date.value) val.value = init(date_);
})
watch(date, (date) => {
    emit('update:modelValue', date);
})

const min = computed(() => toYYYY_MM_DD(to_absolute_date(props.opts.minDate)))
const max = computed(() => toYYYY_MM_DD(to_absolute_date(props.opts.maxDate)))
const todayButton = computed(() => props.opts?.uiOptions?.date_todayButton)
function set_today() {
    val.value = toYYYY_MM_DD(new Date())
}

// help typechecking tests, needed because of https://github.com/vuejs/language-tools/issues/3808
defineExpose({ validity })
</script>
