import conf from './conf'

export const sv_to_url = (sv: sv) => (
    conf.mainUrl + "/" + sv.step + "/" + sv.id
)

