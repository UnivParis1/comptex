import * as ldap from 'ldapjs';
// @ts-expect-error
import * as helpers from '../../node_modules/ldap-filter/lib/helpers';

/* workaround "Filters match on attribute values only case-sensitively" (ldapjs github issue #156) */
function escapeRegExp(str: string) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

// @ts-expect-error
ldap['SubstringFilter'].prototype.matches = function (target, strictAttrCase?: boolean) {
  var tv = helpers.getAttrValue(target, this.attribute, strictAttrCase);
  if (tv !== undefined && tv !== null) {
    var re = '';

    if (this.initial)
      re += '^' + escapeRegExp(this.initial) + '.*';
    this.any.forEach(function (s: string) {
      re += escapeRegExp(s) + '.*';
    });
    if (this.final)
      re += escapeRegExp(this.final) + '$';

    var matcher = new RegExp(re, 'i');
    return helpers.testValues(function (v: any) {
      return matcher.test(v);
    }, tv);
  }

  return false;
};


const doIt = (params: Dictionary<string>) => {
const host = '127.0.0.1';
const db = params.DNs;

const server = ldap.createServer();

let valid_bind = false;

// @ts-expect-error
function authorize(req, res, next) {
  valid_bind = req.dn.equals(params.dn) && req.credentials === params.password;
  if (!valid_bind) {
      //console.log(req.dn.toString(), '!==', params.dn, '||', req.credentials, '!==', params.password);
      return next(new ldap.InvalidCredentialsError());
  }
  res.end();
  return next();
}

function search(dn: any, filter: any, scope: string) {
    let dns;
    if (scope === 'base') {
        dns = [dn.toString()];
    } else {
        dns = Object.keys(db).filter(k => (
            dn.equals(k) || dn.parentOf(k)
        ));
    }
    filter = ldap.parseFilter(filter.toString());
    return dns.filter(dn => (
        filter.matches(db[dn])
    ));
}

// @ts-expect-error
server.search(params.base, (req, res, next) => {
  if (!valid_bind) return next(new ldap.InvalidCredentialsError());
  
  let dn = req.dn.toString();
  //console.log("ldap server.search", dn, req.filter.toString());
  if (db[dn]) {
      let dns = search(req.dn, req.filter, req.scope);
      dns.forEach(dn => {
          res.send({ dn, attributes: db[dn] });
      });
      res.end();
      return next();
  } else {
      console.log("ldap_server.search: unknown dn", dn);
      console.log(Object.keys(db));
      return next(new ldap.NoSuchObjectError(dn));
  }
});

server.bind(params.base, authorize);

return new Promise((resolve, reject) => {    
    server.on('error', (err: any) => {
        reject(err);
    }); 
    server.listen(params.port || 0, host, () => {
        //console.log('LDAP server up at: %s', server.url);
        resolve(server);
    });
});

};

export = doIt;
