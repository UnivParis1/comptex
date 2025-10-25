<template>
  <my-bootstrap-form-group name="jpegPhoto" :opts="opts" :validity="validity" v-if="!opts.readOnly || val">
      <!-- for validation: -->
      <input-with-validity name="jpegPhoto" :modelValue="val" type="text" style="display: none" :required="!opts.optional" v-model:validity="validity.jpegPhoto"></input-with-validity>

      <div v-if="val">
          <img :src="val">
          <button type="button" class="btn btn-default" @click="val = ''" v-if="!opts.readOnly">
              Changer la photo
          </button>
      </div>
      <div v-else-if="opts.readOnly">
          aucune
      </div>
      <div v-else>
          <webcam-live-portrait :width="240" :height="300" :doget="doGet" @image="val = $event" style="vertical-align: middle"></webcam-live-portrait>
          <button type="button" class="btn btn-default" @click="doGet = [0]">Prendre une photo</button>
      </div>
      <p><div v-html="opts.description"></div></p>
  </my-bootstrap-form-group> 
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { toRwRef } from '@/services/helpers';

import webcamLivePortrait from '@/directives/webcamLivePortrait.vue';

const props = defineProps<{
    modelValue: string | undefined,
    opts: SharedStepAttrOption & CommonStepAttrOptionT<{}>,
}>()

const emit = defineEmits<{
    'update:modelValue': [val: string],
}>();

const validity = reactive({ jpegPhoto: {} })
const val = toRwRef(() => props.modelValue)
const doGet = ref(null)

watch(val, (val) => {
    emit('update:modelValue', val);
})
</script>
