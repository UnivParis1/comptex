'use strict';

import * as _ from 'lodash';
import * as actions from './actions';
import * as acl from './acl';
import * as utils from '../utils';
import * as conf from '../conf';


const attrs: StepAttrsOption = {
    status: {},
    barcode: {},
    supannCivilite: { choices: conf.ldap.people.supannCiviliteChoices },
    sn: {},
    givenName: {},
    birthName: { optional: true },
    birthDay: {},
    homePostalAddress: {},   
    homePhone: {},
    supannMailPerso: {},
    structureParrain: {},
};

const moderator_attrs = _.defaults(<StepAttrsOption> {
    uid: {},
    supannAliasLogin: {},
}, attrs);

const initialSteps: steps = {
    extern: {
        labels: {
            okButton: "Demander la création",
        },      
        attrs,
        next: 'moderate',
    },       
};

const nextSteps: steps = {
    moderate: {
        acls: [ acl.user_id('xxx') ],
        labels: {
            added: "La création de votre compte attend maintenant la modération. Vous serez prévenu par mail.",
            title: "Modérer la création du compte",
            okButton: "Approuver",
            cancelButton: "Rejeter",
        },
        notify: {
            added: 'moderation_needed.html',
            accepted: 'moderation_accepted.html',
            rejected: 'moderation_rejected.html',
        },
        attrs: moderator_attrs,
        action_post: actions.createCompte
    },
};

export const steps = utils.mergeSteps(initialSteps, nextSteps);
