'use strict';

import Video from 'twilio-video';

var activeRoom;
var lastRoom;
var previewTracks;
var identity;
var roomName;

const testRoomName = 'TestRoom';

// Attach to the video and audio read
var myvideo = document.getElementById('twiltio-video');
var myaudio = document.getElementById('twilio-audio');
myvideo.onplay = function() {
  myaudio.play();
};
myvideo.onpause = function() {
  myaudio.pause();
};

// Attach the Tracks to the DOM.
function attachTracks(tracks, container) {
  tracks.forEach(function(track) {
    container.appendChild(track.attach());
  });
}

// Attach the Participant's Tracks to the DOM.
function attachParticipantTracks(participant, container) {
  var tracks = Array.from(participant.tracks.values());
  attachTracks(tracks, container);
}

// Detach the Tracks from the DOM.
function detachTracks(tracks) {
  tracks.forEach(function(track) {
    track.detach().forEach(function(detachedElement) {
      detachedElement.remove();
    });
  });
}

// Detach the Participant's Tracks from the DOM.
function detachParticipantTracks(participant) {
  var tracks = Array.from(participant.tracks.values());
  detachTracks(tracks);
}

// When we are about to transition away from this page, disconnect
// from the room, if joined.
window.addEventListener('beforeunload', leaveRoomIfJoined);

// Obtain a token from the server in order to connect to the Room.

var tokenUrl =
  'https://68eitjr1kj.execute-api.us-east-1.amazonaws.com/dev/videointerviewtoken';

var token;
$.post(tokenUrl, function(data) {
  identity = data.identity;
  token = data.token;

  document.getElementById('room-controls').style.display = 'block';

  // Bind recordings button
  document.getElementById('button-recordings').onclick = function() {
    console.log('Start Recordings');
    console.log(window.room);

    fetch(`https://video.twilio.com/v1/Rooms/${window.room.sid}/Recordings/`, {
      headers: {
        Authorization:
          'Basic QUM1MjI4YWExN2E1YmM4MmI2NDJmOTcxOTRiZGFmN2FhNzo0MTQzNzAwZGZlM2RmNzQ0ZTY3YzZmNzhjOGY5NDlhNw==',
      },
    })
      .then(res => res.json())
      .then(jsonResponse => {
        const mediaLinks = jsonResponse.recordings.map(record => ({
          [record.type]: record.links.media,
        }));
        console.log(mediaLinks);
        console.log(jsonResponse);
      });
  };

  // Bind button to join Room.
  document.getElementById('button-join').onclick = function() {
    log("Joining room '" + testRoomName + "'...");
    var connectOptions = {
      name: testRoomName,
      logLevel: 'debug',
      // recordParticipantsOnConnect: true,
    };

    if (previewTracks) {
      connectOptions.tracks = previewTracks;
    }

    // Join the Room with the token from the server and the
    // LocalParticipant's Tracks.
    let localVideoPromise = Video.connect(data.token, connectOptions);

    localVideoPromise.then(roomJoined, function(error) {
      log('Could not connect to Twilio: ' + error.message);
    });
  };

  // Bind button to leave Room.
  document.getElementById('button-leave').onclick = function() {
    log('Leaving room...');
    activeRoom.disconnect();
  };
});

// Successfully connected!
function roomJoined(room) {
  window.room = lastRoom = activeRoom = room;

  console.warn(room);
  log("Joined as '" + identity + "'");
  document.getElementById('button-join').style.display = 'none';
  document.getElementById('button-leave').style.display = 'inline';

  // Attach LocalParticipant's Tracks, if not already attached.
  var previewContainer = document.getElementById('local-media');
  if (!previewContainer.querySelector('video')) {
    attachParticipantTracks(room.localParticipant, previewContainer);
  }

  // Attach the Tracks of the Room's Participants.
  room.participants.forEach(function(participant) {
    log("Already in Room: '" + participant.identity + "'");
    var previewContainer = document.getElementById('remote-media');
    attachParticipantTracks(participant, previewContainer);
  });

  // When a Participant joins the Room, log the event.
  room.on('participantConnected', function(participant) {
    log("Joining: '" + participant.identity + "'");
  });

  // When a Participant adds a Track, attach it to the DOM.
  room.on('trackAdded', function(track, participant) {
    log(participant.identity + ' added track: ' + track.kind);
    var previewContainer = document.getElementById('remote-media');
    attachTracks([track], previewContainer);
  });

  // When a Participant removes a Track, detach it from the DOM.
  room.on('trackRemoved', function(track, participant) {
    log(participant.identity + ' removed track: ' + track.kind);
    detachTracks([track]);
  });

  // When a Participant leaves the Room, detach its Tracks.
  room.on('participantDisconnected', function(participant) {
    log("Participant '" + participant.identity + "' left the room");
    detachParticipantTracks(participant);
  });

  // Once the LocalParticipant leaves the room, detach the Tracks
  // of all Participants, including that of the LocalParticipant.
  room.on('disconnected', function() {
    log('Left');
    if (previewTracks) {
      previewTracks.forEach(function(track) {
        track.stop();
      });
      previewTracks = null;
    }
    detachParticipantTracks(room.localParticipant);
    room.participants.forEach(detachParticipantTracks);
    activeRoom = null;
    document.getElementById('button-join').style.display = 'inline';
    document.getElementById('button-leave').style.display = 'none';
  });
}

// Preview LocalParticipant's Tracks.
document.getElementById('button-preview').onclick = function() {
  var localTracksPromise = previewTracks
    ? Promise.resolve(previewTracks)
    : Video.createLocalTracks();

  localTracksPromise.then(
    function(tracks) {
      window.previewTracks = previewTracks = tracks;
      var previewContainer = document.getElementById('local-media');
      if (!previewContainer.querySelector('video')) {
        attachTracks(tracks, previewContainer);
      }
    },
    function(error) {
      console.error('Unable to access local media', error);
      log('Unable to access Camera and Microphone');
    },
  );
};

// Activity log.
function log(message) {
  var logDiv = document.getElementById('log');
  logDiv.innerHTML += '<p>&gt;&nbsp;' + message + '</p>';
  logDiv.scrollTop = logDiv.scrollHeight;
}

// Leave Room.
function leaveRoomIfJoined() {
  if (activeRoom) {
    activeRoom.disconnect();
  }
}
