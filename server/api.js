'use strict';

var _ = require('lodash');
var express = require('express');
var acl_checker = require('./acl_checker');
var db = require('./db');
var utils = require('./utils');
var search_ldap = require('./search_ldap');
var mail = require('./mail');
var conf = require('./conf');
var conf_steps = require('./steps/conf');
require('./helpers');

var router = express.Router();

var bus = utils.eventBus();


function step(sv) {
    return conf_steps.steps[sv.step];
}

function action_pre(req, sv) {
    return action(req, sv, 'action_pre').then(function (v) {
	//console.log("action returned " + v);
	sv.v = v;
	return sv;
    });
}
function action_post(req, sv) {
    return action(req, sv, 'action_post').then(function (v) {
	// for notification to other moderators,
	// either use the new "v" returned by the action
	// or use the old "v" in case the action returned null, aka remove "v" from DB
	if (v) sv.v = v;
	mayNotifyModerators(req, sv, 'accepted');

	sv.v = v;
	return sv;
    });
}
function action(req, sv, action_name) {
    var f = step(sv)[action_name];
    if (!f) return Promise.resolve(sv.v); // nothing to do
    //console.log("calling " + action_name + " for step " + sv.step);
    return f(req, sv);
}

function mergeAttrs(attrs, prev, v) {
    return _.assign(prev, removeHiddenAttrs(attrs, v));
}

function removeHiddenAttrs(attrs, v) {
    return _.omit(v, function (val, key) { 
	return !attrs[key] || attrs[key].hidden;
    });
}

function sv_removeHiddenAttrs(sv) {
    sv = _.clone(sv);
    sv.v = removeHiddenAttrs(step(sv).attrs, sv.v);
    return sv;
}

function mayNotifyModerators(req, sv, notifyKind) {
    var notify = step(sv).notify;
    if (!notify) return;
    acl_checker.moderators(step(sv)).then(function (mails) {
	if (mails.length) {
	    var params = _.merge({ to: mails.join(', '), moderator: req.user, conf: conf }, sv);
	    mail.sendWithTemplate(notify[notifyKind], params);
	}
    });
}

function checkAcls(req, sv) {
    return acl_checker.isAuthorized(step(sv), req.user).then(function (ok) {
	if (ok) {
	    console.log("authorizing", req.user, "for step", sv.step);
	} else {
	    throw "unauthorised";
	}
    });
}

function first_sv(req) {
    var step = conf_steps.firstStep(req);
    var empty_sv = { step: step, v: {} };
    return action_pre(req, empty_sv);
}

function getRaw(req, id) {
    if (id === 'new') {
	return first_sv(req);
    } else {
	return db.get(id).tap(function (sv) {
	    if (!sv) throw "invalid id " + id;
	    if (!sv.step) throw "internal error: missing step for id " + id;
	    return checkAcls(req, sv);
	});
    }
}

function get(req, id) {
    return getRaw(req, id).then(sv_removeHiddenAttrs).then(function (sv) {
	sv.attrs = _.omit(step(sv).attrs, function (val) {
	    return val.hidden;
	});
	return sv;
    });
}

function set(req, id, v) {
    return getRaw(req, id).then(function (sv) {
	return setRaw(req, sv, v);
    });
}

// 1. merge allow new v attrs into sv
// 2. call action_post
// 3. advance to new step
// 4. call action_pre
// 5. save to DB or remove from DB if one action returned null
function setRaw(req, sv, v) {
    if (!sv.id) {
	// do not really on id auto-created by mongodb on insertion in DB since we need the ID in action_pre for sendValidationEmail
	sv.id = db.new_id();
    }
    sv.v = mergeAttrs(step(sv).attrs, sv.v, v);
    return action_post(req, sv).then(function (sv) {
	if (sv.v) {
	    sv.step = step(sv).next;
	    return action_pre(req, sv);
	} else {
	    return Promise.resolve(sv);
	}
    }).then(function (sv) {
	if (sv.v) {
	    return saveRaw(req, sv);
	} else {
	    return removeRaw(sv.id);
	}
    });
}

function saveRaw(req, sv) {
    return db.save(sv).then(function (sv) {
	bus.emit('changed');
	mayNotifyModerators(req, sv, 'added');
	return {success: true, step: sv.step};
    });
}

function removeRaw(id) {
    return db.remove(id).then(function () {
	bus.emit('changed');
	return {success: true};
    });
}

function remove(req, id) {
    return getRaw(req, id).then(function (sv) {
	// acls are checked => removing is allowed
	mayNotifyModerators(req, sv, 'rejected');
	return removeRaw(sv.id);
    });
}

function listAuthorized(req) {
    return acl_checker.authorizedSteps(req.user).then(function (steps) {
	console.log("authorizedSteps for", req.user, ":", steps);

	// remove steps with no acls: those steps are accessible when one already knows the id
	steps = steps.filter(function (name) { return conf_steps.steps[name].acls; });
	
	console.log("listing comptes for steps:", steps);
	return db.listBySteps(steps).then(function (svs) {
	    return _.map(svs, sv_removeHiddenAttrs);
	});
    });
}

function homonymes(req, id) {
    return getRaw(req, id).then(function (sv) {
	// acls are checked => removing is allowed
	console.log("sns", _.merge(_.at(sv.v, conf.ldap.people.sns)));
	return search_ldap.homonymes(
	    _.merge(_.at(sv.v, conf.ldap.people.sns)),
	    _.merge(_.at(sv.v, conf.ldap.people.givenNames)),
	    new Date(sv.v.birthDay),
	    _.keys(step(sv).attrs));
    });
}

function respondJson(req, res, p) {
    var logPrefix = req.method + " " + req.path + ":";
    p.then(function (r) {
	console.log(logPrefix, r);
	res.json(r || {});
    }, function (err) {
	console.error(logPrefix, err + err.stack);
	res.json({error: ""+err, stack: err.stack});
    });
}

router.get('/comptes', function(req, res) {
    if (req.query.poll) {
	bus.once('changed', function () {
	    respondJson(req, res, listAuthorized(req));
	});
    } else {
	respondJson(req, res, listAuthorized(req));
    }
});

router.get('/comptes/new/:step', function(req, res) {
    respondJson(req, res, get(req, 'new'));
});

router.get('/comptes/:id', function(req, res) {
    respondJson(req, res, get(req, req.params.id));
});

router.put('/comptes/new/:step', function(req, res) {
    respondJson(req, res, set(req, 'new', req.body));
});

router.put('/comptes/:id', function(req, res) {
    respondJson(req, res, set(req, req.params.id, req.body));
});

router.delete('/comptes/:id', function(req, res) {
    respondJson(req, res, remove(req, req.params.id));
});

router.get('/homonymes/:id', function(req, res) {
    respondJson(req, res, homonymes(req, req.params.id));
});

function search_structures(req) {
    var token = req.query.token;
    if (!token) throw "missing token parameter";
    var sizeLimit = parseInt(req.query.maxRows) || 10;
    return search_ldap.structures(token, sizeLimit);
}
router.get('/structures', function(req, res) {
    respondJson(req, res, search_structures(req));
});

module.exports = router;
