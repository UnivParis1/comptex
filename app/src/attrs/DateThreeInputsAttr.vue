<template>
  <my-bootstrap-form-group name="date" :opts="opts" :validity="currentValue_validity">
   <div class="row">
    <div class="col-xs-2" :class="{'my-has-error': !validity.day.valid }">
        <div>
        <input-with-validity name="day" v-model="d.day" type="number" min="1" :max="maxDay" placeholder="Jour" :required="!opts.optional" v-model:validity="validity.day"></input-with-validity>
        <validation-errors name="day" :validity="validity"></validation-errors>
        </div>
    </div>
    <div class="col-xs-2" :class="{'my-has-error': !validity.month.valid }">
        <div>
        <input-with-validity name="month" v-model="d.month" type="number" min="1" max="12" placeholder="Mois" :required="!opts.optional" v-model:validity="validity.month"></input-with-validity>
        <validation-errors name="month" :validity="validity"></validation-errors>
        </div>
    </div>
    <div class="col-xs-5" :class="{'my-has-error': !validity.year.valid }">
        <div>
        <input-with-validity name="year" v-model="d.year" type="number" :min="minYear" :max="maxYear" placeholder="Année" :required="!opts.optional" v-model:validity="validity.year"></input-with-validity>
        <validation-errors name="year" :validity="validity"></validation-errors>
        </div>
    </div>
   </div>
   <span class="attr-description" v-html="opts.description"></span>
  </my-bootstrap-form-group>
</template>

<script lang="ts">
import { computed, reactive, watch } from "vue";
import * as _ from 'lodash-es'
import * as Helpers from '../services/helpers';
import { object_replace } from "@/services/helpers"

function init(date?: Date) {
    return {
        year: date && date.getUTCFullYear() || '',
        month: date && (date.getUTCMonth() + 1) || '',
        day: date && date.getUTCDate() || '',
    };
}

const month2maxDay = [undefined,
        31, 29, 31, 30, 31, 30,
        31, // july
        31, 30, 31, 30, 31];


</script>
<script setup lang="ts">

const props = defineProps<{
    modelValue: Date | undefined,
    opts: SharedStepAttrOption & CommonStepAttrOptionT<{}>,
}>()

const emit = defineEmits<{
    'update:modelValue': [val: Date],
}>();


const d = reactive(init(props.modelValue))

const maxDay = computed(() => d.month && month2maxDay[d.month] || 31)
const minDate = computed(() => Helpers.to_absolute_date(props.opts.minDate))
const maxDate = computed(() => Helpers.to_absolute_date(props.opts.maxDate))
const minYear = computed(() => minDate.value?.getUTCFullYear())
const maxYear = computed(() => maxDate.value?.getUTCFullYear())

const currentValue = computed(() => {
    const [ year, month, day ] = [ 'year', 'month', 'day' ].map(n => parseInt(d[n]));
    return year && month && day && 
            day <= maxDay.value &&
        new Date(Date.UTC(year, month - 1, day)) || undefined;
})
watch(currentValue, (val) => {
    if (+val !== +props.modelValue) {
        emit('update:modelValue', val);
    }
})
watch(() => props.modelValue, (val) => {
    if (val && val !== currentValue.value) object_replace(d, init(val));
})

const validity = reactive({ year: {} as ValidityState, month: {} as ValidityState, day: {} as ValidityState })

const currentValue_validity = computed(() => {
    const val = currentValue.value
    const valid = val ? (!minDate.value || +minDate.value <= +val) && (!maxDate.value || +val <= +maxDate.value) : props.opts.optional
    const message = !valid && _.every(validity, (validity_ => validity_.valid)) && "Date manquante ou invalide" || undefined
    return { date: { valid, message } }
})

</script>
