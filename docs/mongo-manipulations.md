### Remove old non-handled requests

```javascript
db.sv.update({ modifyTimestamp: { $lte: new Date('2021-03-01') } }, { $unset: { v: "", step: "" } }, { multi: true })
```

For session-like requests (until we add a TTL), a complete removal may be better:

```javascript
db.sv.remove({ step: 'migration_', modifyTimestamp: { $lt: new Date(Date.now() - 1 /*day*/ * 24*60*60*1000) } })
```

### Rename profiles in requests

If you want to rename the profile IDs, you must do it in server/steps/conf_profiles.ts, but also in database:

```javascript
db.sv.update({ "v.profilename": "guest" }, { $set: { "v.profilename": "{COMPTEX}guest" } }, { multi: true })
db.sv.update({ "v.profilename_to_modify": "guest" }, { $set: { "v.profilename_to_modify": "{COMPTEX}guest" } }, { multi: true })
```
