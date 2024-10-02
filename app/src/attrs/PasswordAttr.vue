<template>
<div>
  <my-bootstrap-form-group name="userPassword" :opts="opts" :validity="validity" hideErrors=1>
    <input-with-validity name="userPassword" v-model="val" type="password" autocomplete="new-password" :pattern="passwordPattern" :required="!opts.optional" :validity.sync="validity.userPassword"></input-with-validity>
    <span class="help-block" v-if="!validity.userPassword.valid">{{
        opts.labels && opts.labels.custom_error_message
    }}</span>
    <PasswordStrength v-if="!passwordPattern" :passwd="val"></PasswordStrength>
  </my-bootstrap-form-group>

  <my-bootstrap-form-group name="userPassword2" :required="!opts.optional" :label="default_attrs_title.userPassword2" :validity="validity" hideErrors=1>
    <input-with-validity name="userPassword2" v-model="userPassword2" type="password" autocomplete="new-password" :same-as="val" :required="!opts.optional" :validity.sync="validity.userPassword2"></input-with-validity>
    <span class="help-block" v-if="validity.userPassword2.patternMismatch && !validity.userPassword.patternMismatch">Les mots de passe ne sont pas identiques</span>
    <span class="attr-description" v-html="opts.description"></span>
  </my-bootstrap-form-group>
</div>  
</template>

<script lang="ts">
import Vue from "vue";
import conf from '../conf';

export default Vue.extend({
    props: ['value', 'opts', 'submitted'],
    components: { PasswordStrength: () => import("@/directives/PasswordStrength.vue") },
    data() {
        return {
          validity: { userPassword: {} as ValidityState, userPassword2: {} as ValidityState, submitted: false },
          val: this.value,
          userPassword2: null,
        };
    },
    computed: {
      passwordPattern() {
          return this.opts?.pattern || '' // if empty, it will use https://zxcvbn-ts.github.io/zxcvbn/ to display warnings/suggestions about password strength
      },
      error_msg() {
          return conf.error_msg;
      },
    },
    watch: {
        value(val) {
            this.val = val;
        },
        val(val) {
            this.$emit('input', val);
        },
        submitted(b) {
            this.validity.submitted = b;
        },
    },
});
</script>
