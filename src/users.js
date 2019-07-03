const qs = require('querystring')
const axios = require('axios')

const find = (slackUserId) => {
  var body = { token: process.env.SLACK_ACCESS_TOKEN, user: slackUserId }
  return axios.post('https://slack.com/api/users.info', qs.stringify(body))
}
module.exports = { find }
