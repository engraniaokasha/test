
'use strict';

const 
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),  
  request = require('request'),
  strsplit=require('strsplit'),
  cheerio=require('cheerio'),
   BootBot = require('bootbot'),
 truncateUrl = require('truncate-url'),
  FBMessenger=require('fb-messenger')
 
 
 
    

  let Users= [  
   {  
      "id":"",
      "recipes":[
      ""  
        ,
        ""
      ],
      "lastRecipe":"",
      "lastResults": [  
         {  
            "title":"",
            "link":""
         }
      ]
   }
]
 
var app = express();
app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');
app.use(bodyParser.json({ verify: verifyRequestSignature }));

app.use(express.static('public'));


const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ? 
  process.env.MESSENGER_APP_SECRET :
  config.get('appSecret');


// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
  (process.env.MESSENGER_VALIDATION_TOKEN) :
  config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
  (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
  config.get('pageAccessToken');


const SERVER_URL = (process.env.SERVER_URL) ?
  (process.env.SERVER_URL) :
  config.get('serverURL');
 let messenger=new FBMessenger(PAGE_ACCESS_TOKEN)
if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  console.error("Missing config values");
  process.exit(1);
}


app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
   // res.status(200).send(req.query['hub.challenge']);
   res.send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
});



app.post('/webhook', function (req, res) {
  var data = req.body;
 // Make sure this is a page subscription
if (data.object == 'page') {
    // Iterate over each entry, // There may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;
entry.messaging.forEach(function(event) {
   let user=getCurrentUser(event.sender.id)
       if (event.optin) {
          receivedAuthentication(event,user);
       } else if (event.message) {
          receivedMessage(event,user);
        } else if (event.delivery) {
          receivedDeliveryConfirmation(event,user);
        } else if (event.postback) {
          receivedPostback(event,user);
        } else if (event.read) {
          receivedMessageRead(event,user);
        } else if (event.account_linking) {
          receivedAccountLink(eventt,user);
        } else {
          console.log("Webhook received unknown messagingEvent: ",event);
        }
      });
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  
  });
}});
app.get('/authorize', function(req, res) {
  var accountLinkingToken = req.query.account_linking_token;
  var redirectURI = req.query.redirect_uri;

  // Authorization Code should be generated per user by the developer. This will 
  // be passed to the Account Linking callback.
  var authCode = "1234567890";

  // Redirect users to this URI on successful login
  var redirectURISuccess = redirectURI + "&authorization_code=" + authCode;

  res.render('authorize', {
    accountLinkingToken: accountLinkingToken,
    redirectURI: redirectURI,
    redirectURISuccess: redirectURISuccess
  });
});


function persistentMenu(senderID){
 request({
    url: 'https://graph.facebook.com/v2.6/me/thread_settings',
    qs: {access_token:"EAAbIYNmPiuEBAIhGVvusTnEHD4s8omSjRXWQFpYVl1OBJsTGIT2KtbLEkGcMdSE3nn8yJW2FeZBM1QZAUq2KL5ARAB80S3rnKBNYmLmYFJmSNZCwYO5m7sbo80Jo8G0n9VhJTh513YNXDOT8jEaZCjzoj1Eox3bJGqnownswxMrhYW66T21F"},
    method: 'POST',
    json:{
        setting_type : "call_to_actions",
        thread_state : "existing_thread",
        call_to_actions:[
            {
              type:"postback",
              title:"مساعدة",
              payload:"restart bot"
            },
          
            {
              type:"web_url",
              title:"التواصل مع مدير الشركة",
              url:"https://www.facebook.com/Joe2050"
            }
          ]
    }

}, function(error, response, body) {
    console.log(response)
    if (error) {
        console.log('Error sending messages: ', error)
    } else if (response.body.error) {
        console.log('Error: ', response.body.error)
    }
})
}
function verifyRequestSignature(req, res, buf) {

  var signature = req.headers["x-hub-signature"];
 
  if (!signature) {
console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}


function receivedAuthentication(event,user) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfAuth = event.timestamp;
  var passThroughParam = event.optin.ref;

  console.log("Received authentication for user %d and page %d with pass " +
    "through param '%s' at %d", senderID, recipientID, passThroughParam, 
    timeOfAuth);
  sendTextMessage(senderID, "Authentication successful");
}

function receivedMessage(event,user) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;
if (quickReply) {
    var quickReplyPayload = quickReply.payload;
    console.log("Quick reply for message %s with payload %s",
      messageId, quickReplyPayload);
   recievedQuickReply (quickReplyPayload,user);//lesa m3mlt4 l function  d bthndl dwst button so8er;
   
   
  }

  if (messageText) {

    
    switch (messageText) {
      

      case 'Restart bot':
        sendGenericMessage(senderID);
        break;

      case 'receipt':
        sendReceiptMessage(senderID);
        break;

      case 'quick reply':
        sendQuickReply(senderID,user);
        break;        

      case 'read receipt':
        sendReadReceipt(senderID);
        break;        

      case 'typing on':
        sendTypingOn(senderID);
        break;        

      case 'typing off':
        sendTypingOff(senderID);
        break;        

  
      
       default:
      var str=messageText;
     var  res=strsplit(str,/\s+/)[0]; 
      if(res =="هاى" ||res =="hello" ||res =="hi"){
       sendTextMessage(senderID, str+" "+"ى فندم");
       sendGenericMessage(user.id);
break;
}
 else if(res =="شكرا"){
       sendTextMessage(senderID, "العفو <3");
       sendGenericMessage(user.id);
break;
}
else if(res=="السلام"){
       sendTextMessage(senderID, "و عليكم السلام :D");
       sendGenericMessage(user.id);
break;
}
  
 
       else{
      
      defualtMessage(user.id);
          } 
   }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "مش بقدر افهم الفايلات او الصور");
  }
}



function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s", 
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}



function receivedPostback(event,user) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);

 
 if(payload.match(new RegExp("get started","i")) || payload=="restart bot"){
     sendGenericMessage(senderID)
  }
  
 else if(payload=="مواعيد الشركة"){
     sendTextMessage(senderID, "كل يوم من الساعه 10صباحا للساعه 10 مساءا تقدر تنورنا ى فندم :D");
  }
  else if(payload=="الكورسات المتاحة"){
     sendTextMessage(senderID, "حاليا كورسات عمارة و الامبيديد سيستم المتاحين لكن حضرتك ممكن تتابع بوستات البيدج وفيهكذا كورس هيتوفر قريب  ")
  }
  else {
 sendTextMessage(senderID,"دا لينك البيدج https://www.facebook.com/infinitytech100/ ممكن حضرتك تشيرها عندك بحيث تكون ع تواصل معانا و تفيد غيرك انه يستفيد معانا و لو فيه خصومات بيكون ليك الاولويه كمان :D <3 ")
  }

 
}


function receivedMessageRead(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  // All messages before watermark (a timestamp) or sequence have been seen.
  var watermark = event.read.watermark;
  var sequenceNumber = event.read.seq;

  console.log("Received message read event for watermark %d and sequence " +
    "number %d", watermark, sequenceNumber);
}


function receivedAccountLink(event,user) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  var status = event.account_linking.status;
  var authCode = event.account_linking.authorization_code;

  console.log("Received account link event with for user %d with status %s " +
    "and auth code %s ", senderID, status, authCode);
}


function sendImageMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",

        payload: {
          url: SERVER_URL + "/assets/rift.png"
        }
      }
    }
  };

  callSendAPI(messageData);
}


function sendGifMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL + "/assets/instagram_logo.gif"
        }
      }
    }
  };

  callSendAPI(messageData);
}


function sendAudioMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "audio",
        payload: {
          url: SERVER_URL + "/assets/sample.mp3"
        }
      }
    }
  };

  callSendAPI(messageData);
}







function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText,
      metadata: "DEVELOPER_DEFINED_METADATA"
    }
  };

  callSendAPI(messageData);
}


function sendButtonMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "This is test text",
          "buttons": [
              {
                "type": "element_share",
                "share_contents": { 
                  "attachment": {
                    "type": "template",
                    "payload": {
                      "template_type": "generic",
                      "elements": [
                        {
                          "title": "I took the hat quiz",
                          "subtitle": "My result: Fez",
                          "image_url": "https://bot.peters-hats.com/img/hats/fez.jpg",
                          "default_action": {
                            "type": "web_url",
                            "url": "http://m.me/petershats?ref=invited_by_24601"
                          }}]}}}}]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "hello in infinty tech <3 ",
            subtitle: "هنساعدكم لو بدوروا على كورسات ف جميع المجالات الهندسية  ",             
            image_url: "https://afrotourism.com/wp-content/uploads/2015/01/infinitylounge11.png",
            buttons: [{
              type: "postback",
             payload:"مواعيد الشركة",
              title: "مواعيد الشركة"
            }, {
              type: "postback",
              title: "الكورسات المتاحة",
              payload: "الكورسات المتاحة",
            },
            {
              type: "postback",
              title: "شير البيدج",
              payload: "شير البيدج",
            }
           
            ]
          }]
          }
        }
      }
    }
    

  callSendAPI(messageData);

}
function defualtMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "hello in infinty tech <3 ",
            subtitle: "ممكن تختار احد الاختيارت عشان اقدر اساعدك  ",             
            image_url: "https://intelligentwomenreadromance.files.wordpress.com/2009/12/confused-man.jpg",
            buttons: [{
              type: "postback",
             payload:"مواعيد الشركة",
              title: "مواعيد الشركة"
            }, {
              type: "postback",
              title: "الكورسات المتاحة",
              payload: "الكورسات المتاحة"
            },
             {
              type: "postback",
              title: "شير البيدج",
              payload: "شير البيدج"
            }]
          }]
          }
        }
      }
    }
    

  callSendAPI(messageData);

}

function sendReceiptMessage(recipientId) {

  var receiptId = "order" + Math.floor(Math.random()*1000);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message:{
      attachment: {
        type: "template",
        payload: {
          template_type: "receipt",
          recipient_name: "Peter Chang",
          order_number: receiptId,
          currency: "USD",
          payment_method: "Visa 1234",        
          timestamp: "1428444852", 
          elements: [{
            title: "Oculus Rift",
            subtitle: "Includes: headset, sensor, remote",
            quantity: 1,
            price: 599.00,
            currency: "USD",
            image_url: SERVER_URL + "/assets/riftsq.png"
          }, {
            title: "Samsung Gear VR",
            subtitle: "Frost White",
            quantity: 1,
            price: 99.99,
            currency: "USD",
            image_url: SERVER_URL + "/assets/gearvrsq.png"
          }],
          address: {
            street_1: "1 Hacker Way",
            street_2: "",
            city: "Menlo Park",
            postal_code: "94025",
            state: "CA",
            country: "US"
          },
          summary: {
            subtotal: 698.99,
            shipping_cost: 20.00,
            total_tax: 57.67,
            total_cost: 626.66
          },
          adjustments: [{
            name: "New Customer Discount",
            amount: -50
          }, {
            name: "$100 Off Coupon",
            amount: -100
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}


function sendQuickReply(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "What's your favorite movie genre?",
      quick_replies: [
        {
          "content_type":"text",
          "title":"Action",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_ACTION"
        },
        {
          "content_type":"text",
          "title":"Comedy",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_COMEDY"
        },
        {
          "content_type":"text",
          "title":"Drama",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_DRAMA"
        }
      ]
    }
  };

  callSendAPI(messageData);
}


function sendReadReceipt(recipientId) {
  console.log("Sending a read receipt to mark message as seen");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "mark_seen"
  };

  callSendAPI(messageData);
}


function sendTypingOn(recipientId) {
  console.log("Turning typing indicator on");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_on"
  };

  callSendAPI(messageData);
}


function sendTypingOff(recipientId) {
  console.log("Turning typing indicator off");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_off"
  };

  callSendAPI(messageData);
}


function sendAccountLinking(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Welcome. Link your account.",
          buttons:[{
            type: "account_link",
            url: SERVER_URL + "/authorize"
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}


function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;
      const sendRequest = (req, cb) => {
 request(req, (err, res, body) => {
    if (!cb) return
    if (err) return cb(err)
    if (body.error) return cb(body.error)
    cb(null, body)
  })
}
 if (messageId) {
      console.log("Successfully sent message with id %s to recipient %s", 
          messageId, recipientId);
      } else {
      console.log("Successfully called Send API for recipient %s", 
        recipientId);
      }
    } else {
   console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
 
  }
  });  
}

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;



function getCurrentUser(senderID){
let exist=false;
let currentUser=JSON.parse(JSON.stringify(Users[0]))
for(let i=0;i<Users.length;i++)
{
  let user=Users[i];
  let first=Users[0];
  if(user.id==senderID){
exist=true;
return user;
  }
}
if(!exist)
{currentUser.id=senderID;
  Users.push(currentUser);
  return currentUser;
}
}
    
    

     



