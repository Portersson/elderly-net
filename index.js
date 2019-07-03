require('dotenv').config()

const verify = require('./src/verify')
const dataLayer = require('./src/data-layer')
const responses = require('./src/responses')
const users = require('./src/users')
const axios = require('axios')
const express = require('express')
const bodyParser = require('body-parser')
const debug = require('debug')('slash-command-template:index')
const request = require('request')
const urlMetadata = require('url-metadata')

const slackApi = 'https://slack.com/api'
const app = express()

const rawBodyBuffer = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8')
  }
}

app.use(bodyParser.urlencoded({ verify: rawBodyBuffer, extended: true }))
app.use(bodyParser.json({ verify: rawBodyBuffer }))
app.use(express.static('/app/public'))

/*
 * Parse application/x-www-form-urlencoded && application/json
 * Use body-parser's `verify` callback to export a parsed raw body
 * that you need to use to verify the signature
 */

app.get('/', (req, res) => {
  res.sendFile('/app/public/index.html')
})
 
app.get('/posts', async (req, res) => {
  let tags = ""
  if (req.query.tags != "null"){
    tags = decodeURIComponent(req.query.tags) //.replace(/\"/g, '')t
  }
  const tables = await dataLayer.getArticles(tags)
  res.send(tables)
})

app.post('/slack/lamppost', (req, res) => {
  const { text, trigger_id } = req.body
  const submissionDialog = responses.submissionDialog(text, trigger_id)
  if (verify.goodSignature(req)) {
    submitForm(`${slackApi}/dialog.open`, submissionDialog, res)
  } else {
    debug('Token mismatch')
    res.sendStatus(500)
  }
})


app.post('/slack/menu-options', async (req, res) => {
  // Parse user-entered tags and find matches in database
  const payload = JSON.parse(req.body.payload)
  const query = payload.value.split(',').map(Function.prototype.call, String.prototype.trim)  
  var dbQuery = query.slice(0)
  dbQuery[dbQuery.length-1] += "%" // Only the last tag in search should get autocompletion
  console.log("query:" + dbQuery.slice(-1)[0])
  const matches = await dataLayer.getTags(dbQuery) 
  const possibleCompletions = matches.slice(-1)[0]
  var selectedTags = {}; selectedTags["label"] = ""; selectedTags["value"] = ""
  query.slice(0, -1).forEach((tag, index) => {
    var newTagWarning = matches[index].includes(tag)? "": "+"
    selectedTags.label += newTagWarning + tag + ", "
    selectedTags.value += tag + ", "
  })
  const currentTag = query.slice(-1)[0]
  var autocompleteOptions = [], jsonForm = []
  if(!possibleCompletions.includes(currentTag) && currentTag.length > 0){
    autocompleteOptions.push({label: selectedTags.label + "+" + currentTag, value: selectedTags.value + currentTag})
  }
  possibleCompletions.forEach((completion) => {
    autocompleteOptions.push({label : selectedTags.label + completion, value: selectedTags.value + completion})
  })
  jsonForm.push({options : autocompleteOptions})
  console.log(JSON.stringify(jsonForm[0]))
  res.status(200).send(JSON.stringify(jsonForm[0]))
})


app.post('/slack/submit', async (req, res) => {
  var payload = JSON.parse(req.body.payload)
  if (verify.goodSignature(req)) {
    if (isVote(payload)) {
      res.sendStatus(200).end()
      var articleId = payload.message.text
      dataLayer.voteArticle(articleId)
      sendMessageToSlackResponseURL(payload.response_url, responses.voteReceived(payload))
    }
    else if (isSubmission(payload) && verify.goodSubmission(payload.submission)) {
      // Fetch more information for storage and save the article
      console.log(payload)
      var urlMeta = await urlMetadata(protocalUrl(payload.submission.url))
      var fullName = (await users.find(payload.user.id)).data.user.profile.real_name
      urlMeta.description = payload.submission.description ? payload.submission.description : urlMeta.description
      var tags = payload.submission.tags
      tags = removeDuplicates(tags.split(',').map(Function.prototype.call, String.prototype.trim))
      var dbEntryId = dataLayer.insertArticle(payload.channel.id, urlMeta.title, urlMeta.url, urlMeta.description, rootedUrl(urlMeta.image, urlMeta.url), fullName, tags=tags)
      var successForm = responses.submissionReceived(payload.user.id, urlMeta, fullName, dbEntryId)
      submitForm(`${slackApi}/chat.postMessage`, successForm)
      res.send('') // Green response
    } else {
      res.status(200).send(responses.badSubmission()) // 200 OK so we can send a payload listing errors 
    }
  } else {
    debug('Token mismatch')
    res.sendStatus(500)
  }
})

const server = app.listen(process.env.PORT || 5000, () => {
  console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env)
})

/*
 * Sub-methods
 */

function submitForm (url, form, res = null) {
  axios.post(url, form)
    .then((result) => {
      debug('axios post: %o', result.data)
      if (res) {
        res.send('')
      }
    }).catch((err) => {
      debug('axios post call failed: %o', err)
      if (res) {
        res.set('Content-Type', 'application/json')
        res.sendStatus(500)
      }
    })
}

function sendMessageToSlackResponseURL(responseURL, JSONmessage){
    var postOptions = {
        uri: responseURL,
        method: 'POST',
        headers: {
            'Content-type': 'application/json'
        },
        json: JSONmessage
    }
    console.log("Slack Response Sent.")
    request(postOptions, (error, response, body) => {
      if (error){
          console.log(error)
      }
    })
}

function protocalUrl (url) {
  return (url.indexOf('://') === -1) ? 'http://' + url : url
}

function rootedUrl (relative, root){
  return relative.startsWith('/') ? root + relative : relative
}

function isVote (payloadBody) {
  return true ? payloadBody.type == 'block_actions' : false
}

function isSubmission (payloadBody) {
  return true ? payloadBody.type == 'dialog_submission' : false
}

function removeDuplicates(arr){
  return arr.filter((v,i) => arr.indexOf(v) === i)
}
