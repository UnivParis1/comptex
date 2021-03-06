import Vue from "vue";
import VueRouter from "vue-router";
import AsyncComputed from 'vue-async-computed';
import { router } from './router';
import GlobalMixin from './GlobalMixin';
import genericAttr from './attrs/genericAttr.vue';
import VueCompositionApi from '@vue/composition-api';
import conf from './conf';

document.title = conf.title;

import "./filters/various";
import "./directives/various";
import "./directives/validators";
import "./directives/Bootstrap";
import "./directives/typeahead";

// especially needed on MSIE to allow "includes" in step.labels.description Vue.js template
import array_includes from 'array-includes';
array_includes.shim()


Vue.mixin(GlobalMixin);
Vue.use(VueRouter)
Vue.use(AsyncComputed)
Vue.use(VueCompositionApi);
Vue.component('genericAttr', genericAttr); // make it global to break circular dependency

new Vue({ 
    router
}).$mount(".page");
