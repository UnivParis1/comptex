import { createApp } from 'vue';
import { router } from './router.ts';
import GlobalMixin from './GlobalMixin.ts';
import genericAttr from './attrs/genericAttr.vue';
import { htmlToText } from './services/helpers.ts'
import conf from './conf.ts';

document.title = htmlToText(conf.title);

import various from "./directives/various";
import validators from './directives/validators.ts'
import Bootstrap from './directives/Bootstrap.ts'
import typeahead from './directives/typeahead.ts'

// especially needed on MSIE to allow "includes" in step.labels.description Vue.js template
import array_includes from 'array-includes';
array_includes.shim()

let app = createApp({})
various(app)
Bootstrap(app)
validators(app)
app.component('typeahead', typeahead)

app.mixin(GlobalMixin);
app.use(router)
app.component('genericAttr', genericAttr); // make it global to break circular dependency

app.mount(".page");
