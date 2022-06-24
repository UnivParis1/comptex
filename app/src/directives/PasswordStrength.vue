<template>
<div v-if="passwd">
    <span :style="{color: cc.color}">{{cc.msg}}</span>
    <div style="font-size: 1px; height: 3px; margin-bottom: 1rem" :style="{width: cc.width, background: cc.color}"></div>
    <div v-if="cc.feedback.warning" style="font-weight: bold;">⚠ {{cc.feedback.warning}}</div>
    <div v-for="suggestion in cc.feedback.suggestions"> {{suggestion}}</div>
</div>
</template>

<script lang="ts">
import Vue from "vue";

import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core'
import zxcvbnCommonPackage from '@zxcvbn-ts/language-common'
import zxcvbnFrPackage from '@zxcvbn-ts/language-fr'

const options = {
  translations: zxcvbnFrPackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnFrPackage.dictionary,
  },
}

zxcvbnOptions.setOptions(options)

const colors = [ "red", "#ffd801", "orange", "#3bce08", "#3bce08" ];
const msgs = [ "Très faible", "Faible", "Moyen", "Fort", "Très fort" ];

export default Vue.extend({
    props: ['passwd'],
    computed: {
        cc() {
            const analysis = zxcvbn(this.passwd);
            const level = analysis.score;
            return { width: ((level + 1) * 60) + "px", color: colors[level], msg: msgs[level], feedback: analysis.feedback }
        },
    },
});
</script>
