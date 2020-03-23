'use strict';

/**
 * Load Twilio configuration from .env config file - the following environment
 * variables should be set:
 * process.env.TWILIO_ACCOUNT_SID
 * process.env.TWILIO_API_KEY
 * process.env.TWILIO_API_SECRET
 */
require('dotenv').load();

var http = require('http');
var path = require('path');
var AccessToken = require('twilio').jwt.AccessToken;
var VideoGrant = AccessToken.VideoGrant;
var express = require('express');
var randomName = require('./randomname');

// Create Express webapp.
var app = express();

app.use(express.static(__dirname + '/public'));

app.get('/', function(_request, response) {
  response.sendFile(process.cwd() + '/public/index.html');
});

app.get('/twilio-video', function(request, response) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = require('twilio')(accountSid, authToken);

  const roomSid = request.query.roomSid;

  async function createComposition(audioSid, videoSid, res) {
    return client.video.compositions
      .create({
        roomSid: roomSid,
        audioSources: audioSid,
        format: 'mp4',
        videoLayout: { transcode: { video_sources: [videoSid] } },
      })
      .then(composition => {
        res.json({ sid: composition.sid, media: composition.links.media });
      })
      .catch(function(err) {
        res.status(500).send(err);
      });
  }

  let videoSid, audioSid;
  return client.video
    .rooms(roomSid)
    .recordings.list({ limit: 5 })
    .then(recordings => {
      videoSid = recordings.find(el => el.type === 'video').sid;
      audioSid = recordings.find(el => el.type === 'audio').sid;
      return createComposition(audioSid, videoSid, response);
    });
});

/**
 * Generate an Access Token for a chat application user - it generates a random
 * username for the client requesting a token, and takes a device ID as a query
 * parameter.
 */
app.get('/token', function(request, response) {
  var identity = randomName();

  // Create an access token which we will sign and return to the client,
  // containing the grant we just created.
  var token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET,
  );

  // Assign the generated identity to the token.
  token.identity = identity;

  // Grant the access token Twilio Video capabilities.
  var grant = new VideoGrant();
  token.addGrant(grant);

  // Serialize the token to a JWT string and include it in a JSON response.
  response.send({
    identity: identity,
    token: token.toJwt(),
  });
});

// Create http server and run it.
var server = http.createServer(app);
var port = process.env.PORT || 3000;
server.listen(port, function() {
  console.log(`Listening to requests on http://localhost:${port}`);
});
