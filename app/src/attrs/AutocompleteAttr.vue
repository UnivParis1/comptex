<template>
  <my-bootstrap-form-group :name="name" :opts="opts" :validity="validity">
    <div v-if="opts.readOnly">
      <component v-if="opts.uiOptions && opts.uiOptions.texts_are_vue_template"
            :is="formatting_vue(val)" :v="v"></component>
      <input v-else :disabled="true" class="form-control" :value="val ? val.title : ''">
    </div>
    <div :class="{ 'input-group': array_allowed_actions.any }" v-else>
      <typeahead :id="name" :name="name" v-model="val" :options="search" :minChars="3" :formatting="formatting" :formatting_html="formatting_html"
            :required="!opts.optional || array_allowed_actions.remove"
            :placeholder="opts.uiPlaceholder"
            :editable="false" :validity.sync="validity[name]"></typeahead>
      <array-actions @action="name => $emit('array_action', name)" :array_allowed_actions="array_allowed_actions" />
    </div>
  </my-bootstrap-form-group>
</template>

<script lang="ts">
import Vue from "vue";
import * as Ws from '../services/ws';

export default Vue.extend({
    props: ['value', 'name', 'real_name', 'opts', 'v', 'stepName', 'array_allowed_actions'],
    data() {
        return {
          validity: !this.opts.readOnly && { [this.name]: {} },
          val: undefined,
        };
    },
    asyncComputed: {
        valueS() {
            return this.value && Ws.search(this.stepName, this.real_name || this.name, this.value, 1).then(l => l && l[0])
        },
    },
    watch: {
        valueS(val) {
            this.val = val;
        },
        val(val) {
            console.log("val changed", val);
            if (val) {
                this.$emit('input', val.const);
                if (this.opts.onChange) this.opts.onChange(this.v, val.const, val);
            }
        },
    },
    methods: {
        search(token) {
            return Ws.search(this.stepName, this.real_name || this.name, token, 10 + 1); // NB: searching one more item to detect "moreResults" case
        },
        formatting(e) { 
            return this.opts.formatting ? this.opts.formatting(e) : e && e.title;
        },
        formatting_html(e) {
            return this.opts.formatting_html ? this.opts.formatting_html(e) : this.formatting(e);
        },
        formatting_vue(e) {
            return e?.title && Vue.extend({ props: ['v'], template: "<div>" + e.title + "</div>" });
        },
    },
});
</script>
