module.exports = WebSocketMirror

var ws = require('ws')
var inherits = require('inherits')
var cp = require('child_process')
var wsstream = require('websocket-stream')

inherits(WebSocketMirror, ws.Server)

function WebSocketMirror (httpServer) {
  if (!(this instanceof WebSocketMirror)) {
    return new WebSocketMirror(httpServer)
  }

  ws.Server.call(this, { server: httpServer })
  this.channels = {}
  this.on('connection', this._onconnection.bind(this))
}

WebSocketMirror.prototype._onconnection = function (socket) {
  var path = socket.upgradeReq.url.slice(1).split('/')
  if (path.length < 2) return socket.close()
  var channel = path[0]
  var action = path[1]
  if (action === 'publish') {
    this._startRecording(channel, socket)
    socket.on('message', this._onmessage.bind(this, channel))
  } else if (action === 'subscribe') {
    this.channels[channel] = this.channels[channel] || []
    this.channels[channel].push(socket)
    socket.on('close', this._onsubscriberclose.bind(this, channel, socket))
  }
}

WebSocketMirror.prototype._startRecording = function (channel, socket) {
  var ffmpegProc = cp.spawn("ffmpeg",[
      "-re",
      "-i", "pipe:0", // input from STDIN
      //"-i", "A.wav",
      "-map", "0:0",
      "-f", "segment",
      "-segment_time", "10",
      "-segment_list", './' + channel + ".m3u8",
      "-segment_format", "mpgets", './' + channel + "-output%3d.wav"
  ])

  ffmpegProc.stderr.pipe(process.stderr)

  ffmpegProc.on('error', function (err) {
    console.error(err)
  })

  var stream = wsstream(socket)
  stream.pipe(ffmpegProc.stdin)
}

WebSocketMirror.prototype._onmessage = function (channel, message) {
  var subscribers = this.channels[channel]
  for (var i in subscribers) {
    try {
      subscribers[i].send(message)
    } catch (err) {}
  }
}

WebSocketMirror.prototype._onsubscriberclose = function (channel, socket) {
  this.channels[channel] = this.channels[channel].filter(function (s) {
    return s !== socket
  })
  console.log('subscriber closed, num left: ' + Object.keys(this.channels[channel]).length)
  if (Object.keys(this.channels[channel]).length === 0) {
    delete this.channels[channel]
  }
}
