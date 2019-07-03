const qs = require('querystring')

const submissionDialog = (url, trigger_id) => {
  // create the dialog payload - includes the dialog structure, Slack API token,
  // and trigger ID
  const payload = {
    token: process.env.SLACK_ACCESS_TOKEN,
    trigger_id,
    dialog: JSON.stringify({
      title: 'Submit a new article',
      callback_id: 'submit-article',
      submit_label: 'Submit',
      elements: [
        {
          label: 'Link address',
          type: 'text',
          subtype: 'url',
          name: 'url',
          placeholder: 'https://www.my-article.example',
          value: url
        },
        {
          label: 'Tags',
          type: 'select', // make select if exernal source
          name: 'tags',
          optional: true,
          data_source: "external"
        },
        {
          label: 'Description',
          type: 'text',
          name: 'description',
          optional:true,
        },
      ],
    }),
  }
  return qs.stringify(payload)
}

const submissionReceived = (channelId, urlMetadata, fullName, articleId) => {
  const description = urlMetadata.description || "No description found."
  const title = urlMetadata.title
  const imageUrl = urlMetadata.description ? urlMetadata.image : ""
  const imageBlock = imageUrl ? `
        "accessory": {
          "type": "image",
          "image_url": "${urlMetadata.image}",
          "alt_text": " "
        }` : ""
  const payload = {
    token: process.env.SLACK_ACCESS_TOKEN,
    channel: channelId,
    // callback_id: "pick_channel_for_fun",
    //as_user: true,
    text: articleId,
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*${fullName} just posted an article*`
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `:newspaper: <${urlMetadata.url} | ${urlMetadata.title}>\n${truncate(urlMetadata.description || "No description found.")}`
        },
      },
      {
        "type": "section",
        "text":{
            "type":"mrkdwn",
            "text": "<https://elderly-net.glitch.me|View on lamp>"
        },
        "accessory": {
          "type": "button",
          "value": "vote",
          "text": {
            "type": "plain_text",
            "emoji": true,
            "text": ":thumbsup:"
          }
        }
      }
    ]
  }
  console.log(payload.blocks[0]) // TODO: paste in image block if one is found 
  payload.blocks = JSON.stringify(payload.blocks)
  return qs.stringify(payload)
}

const badSubmission = () => {
  const payload = JSON.stringify({
    "errors": [
      {
        "name": "url",
        "error": "Sorry, that's not a valid link!"
      }
    ]
  })
  return payload
}

const voteReceived = (pay) => {
  var payload = {
    "response_type": "ephemeral",
    "replace_original": "true",
  }
  pay.message.blocks[3].accessory.text.text = "voted" //TODO: fix this so it *finds* where to replace
  payload.blocks = pay.message.blocks
  
  return payload
}

/*
 *
 */

function truncate (input) {
  var maxLength = 255
  if (input.length > maxLength)
      return input.substring(0,maxLength) + '...'
  else
      return input
}

// function findNodeOfValue(value, currentNode) {
//   if (value == currentNode.value) {
//       return currentNode;
//   } else {
//       for(var index in currentNode.children){
//           var node = currentNode.children[index];
//           if(node.value == value)
//               return node;
//           findNodeOfValue(value, node);
//       }
//       return "No Node Present";
//   }
// }

module.exports = { submissionDialog, badSubmission, submissionReceived, voteReceived}