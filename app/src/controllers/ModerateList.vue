<template>
<div>

<div v-for="step in initialSteps" v-if="initialSteps">
    <InitialStep :step="step"></InitialStep>
</div>

<div v-for="(svs_,step) in svsGroupedByStep">      
 <h2 v-if="svs_[0].step.labels" v-html="svs_[0].step.labels.title_in_list || svs_[0].step.labels.title"></h2>
 <template v-for="description in [svs_[0].step.labels.description_in_list]">
   <div style="margin-bottom: 0.7rem;" v-html="description"></div>
 </template>
 <ul>
  <li v-for="sv in svs_">
  le {{formatDate(sv.modifyTimestamp, 'dd/MM/yyyy à HH:mm')}} : 
   <router-link :to="'/' + sv.stepName + '/' + sv.id">
     {{sv.v.sn || 'inconnu'}}
     {{sv.v.givenName || 'inconnu'}}
   </router-link>
   <span v-if="sv.additional_public_info" v-html="sv.additional_public_info.title_in_list"></span>
</li>
</ul>
</div>

<div v-if="svs && svs.length === 0">
  Rien à modérer
</div>

</div>
</template>

<script lang="ts">
import Vue from 'vue';
import axios from 'axios';
import * as Helpers from '../services/helpers';
import * as Ws from '../services/ws';
import InitialStep from './InitialStep.vue';

export default Vue.extend({
  name: 'ModerateList',
  components: { InitialStep },
  data: () => ({
    svs: null,
    initialSteps: undefined,
  }),
  mounted() {
      this.listRec({});
      Ws.loggedUserInitialSteps().then(val => this.initialSteps = val);
  },
  beforeDestroy() {
    if (this.cancelP) this.cancelP.cancel("");
  },
  computed: { 
      svsGroupedByStep() {
         return this.svs ? Helpers.groupBy(this.svs as ClientSideSVA[], sv => sv.stepName) : undefined;
      },
  },
  methods: {
    formatDate: Helpers.formatDate,
    listRec(params) {
        this.cancelP = axios.CancelToken.source();

        Ws.listInScope(this, params, this.cancelP.token).then(rc => {
            if (rc !== "cancel") {
                this.listRec({ poll: true });
            }
        });
    },
  },
});
</script>