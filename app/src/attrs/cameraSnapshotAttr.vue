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

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
    props: ['modelValue', 'opts'],
    emits: ['update:modelValue'],
    data() {
        return {
            validity: { jpegPhoto: {} },
            val: this.modelValue,
            doGet: null,
        };
    },
    watch: {
        modelValue(val) {
            this.val = val;
        },
        val(val) {
            this.$emit('update:modelValue', val);
        },
    },
});
</script>
