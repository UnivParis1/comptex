import { createRouter, createWebHistory, RouterOptions, RouteRecordRaw, Router } from 'vue-router'
import conf from './conf.ts';
import * as Helpers from './services/helpers.ts'; 
import Step from './controllers/Step.vue';
import ModerateList from './controllers/ModerateList.vue';

import template_welcome from './templates/welcome.html?raw'
import { Component } from 'vue';

export let router: Router;

const _routes: Dictionary<Component> = {
    '/playground': () => import('./controllers/Playground.vue'),
    '/login/:kind?': { render(_h) { router.replace(this.$route.query.then) } }, // TODO, use vue-router redirect
    '/steps/:kind?': ModerateList,
    '/:stepName/:wanted_id?': Step,
    '/': { template: template_welcome },
};

const routes: RouteRecordRaw[] = [];
Helpers.eachObject(_routes, (path, component) => {
    routes.push({ path, component, props: true })
});

if (!conf.base_pathname.match(/\/$/)) alert("base_pathname in vue.config.js must have a trailing slash");

const opts: RouterOptions = {
    history: createWebHistory(conf.base_pathname),
    routes,
};

router = createRouter(opts);
