import VueRouter from "vue-router";
import conf from './conf';
import * as Helpers from './services/helpers'; 
import Step from './controllers/Step.vue';
import ModerateList from './controllers/ModerateList.vue';

import template_welcome from './templates/welcome.html?raw'

export let router;

const _routes = {
    '/playground': () => import('./controllers/Playground.vue'),
    '/login/:kind?': { render(_h) {
        const then = this.$route.query.then;
        if ("reload_to_test" in this.$route.query)
            document.location.href = conf.base_pathname + "test/#" + then;
        else
            router.replace(then) // TODO, use vue-router redirect
    } },
    '/steps/:kind?': ModerateList,
    '/:stepName/:wanted_id?': Step,
    '/': { template: template_welcome },
};

const routes = [];
Helpers.eachObject(_routes, (path, component) => {
    routes.push({ path, component, props: true })
});

if (!conf.base_pathname.match(/\/$/)) alert("base_pathname in vue.config.js must have a trailing slash");

const opts = {
    mode: undefined,
    base: conf.base_pathname,
    routes,
};

if (!conf.base_pathname.match(/\/test\/$/)) {
    opts.mode = 'history';
}

router = new VueRouter(opts);
