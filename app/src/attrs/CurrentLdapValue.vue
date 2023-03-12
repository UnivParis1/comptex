<template>
  <div class="current-ldap-value" v-if="shown">
      actuellement : {{ldap_value}} 
      <span @click="revert" title="Utiliser la valeur actuelle du compte" class="glyphicon glyphicon-circle-arrow-up"></span>
    </div>
</template>

<script lang="ts">
import Vue from 'vue'
export default Vue.extend({
  props: ["ldap_value", "value"],
  data() {
        return { hide: false };  
  },
  computed: {
      shown() {
          return !this.hide 
            && (this.ldap_value || this.ldap_value === ''/* for checkboxes */) // do we have the LDAP value ?
            && ("" + (this.ldap_value || '')) !== ("" + (this.value || '')) // "true" and true are considered equal
      },
  },
  watch: {
      shown: {
          handler() { this.$emit('shown', this.shown) },
          immediate: true,
      },
  },
  methods: {
      revert() {
          this.$emit('input', this.ldap_value);
          this.hide = true;
      }
  }
})
</script>
