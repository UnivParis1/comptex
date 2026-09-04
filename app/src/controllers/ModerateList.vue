<template>
<div>

<div v-for="step in initialSteps" v-if="initialSteps">
    <InitialStep :step="step"></InitialStep>
</div>

<template v-for="(step_and_svs,stepName) in filtered_steps_svs">
<div :class="`ModerateStep-${stepName}`">
 <h2 v-if="step_and_svs.step.labels" v-html="step_and_svs.step.labels.title_in_list || step_and_svs.step.labels.title"></h2>
 <template v-for="description in [step_and_svs.step.labels.description_in_list]">
   <div style="margin-bottom: 0.7rem;" v-html="description"></div>
 </template>
 <label>Filtre : <input v-model="filter" placeholder="nom et/ou prénom"></label>
 <ul>
  <li v-for="sv in step_and_svs.svs">
  le {{formatDate(sv.modifyTimestamp, 'dd/MM/yyyy à HH:mm')}} : 
   <router-link :to="'/' + stepName + '/' + sv.id">
     {{sv.v.sn || 'inconnu'}}
     {{sv.v.givenName || 'inconnu'}}
   </router-link>
   <span v-if="sv.additional_public_info" v-html="sv.additional_public_info.title_in_list"></span>
</li>
</ul>
</div>
</template>

<div v-if="isEmpty_steps_svs">
  Rien à modérer
</div>

</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import * as Helpers from '../services/helpers.ts';
import * as Ws from '../services/ws.ts';
import InitialStep from './InitialStep.vue';
import { prepare_for_compare } from '../../../shared/validators/displayName.ts';
import { at, isEmpty, mapValues } from 'lodash-es';

export default defineComponent({
  name: 'ModerateList',
  components: { InitialStep },
  data: () => ({
    steps_svs: null as Dictionary<{ svs: ClientSideMinimalSV[], step: ClientSideStep }>,
    initialSteps: undefined,
    filter: undefined,
    cancelP: undefined as AbortController | undefined,
  }),
  mounted() {
      this.listRec({});
      Ws.loggedUserInitialSteps().then(val => this.initialSteps = val);
  },
  beforeUnmount() {
    if (this.cancelP) this.cancelP.abort()
  },
  computed: { 
      isEmpty_steps_svs() {
        return this.steps_svs && isEmpty(this.steps_svs)
      },
      filtered_steps_svs() {
        if (!this.steps_svs) return undefined
         if (this.filter) {
            const wanted_words = prepare_for_compare(this.filter).split(/\s+/)
            return mapValues(this.steps_svs, ({ svs, ...rest }, _) => {
                for (const sv of svs) {
                    sv.v.for_compare ||= prepare_for_compare(at(sv.v, 'sn', 'givenName').join("  "))
                }
                svs = svs.filter(sv => wanted_words.every(word => sv.v.for_compare.includes(word)))
                return { svs, ...rest }
            })
         }
         return this.steps_svs;
      },
  },
  methods: {
    formatDate: Helpers.formatDate,
    listRec(params) {
        this.cancelP = new AbortController();

        Ws.listInScope(this, params, this.cancelP.signal).then(rc => {
            if (rc !== "cancel") {
                this.listRec({ poll: true });
            }
        });
    },
  },
});
</script>