var http = require('http')
var wsMirror = require('../')

var server = http.createServer(function (req, res) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(req.method + ' ' + req.url)
  }
})

server.listen(process.env.PORT, '::', function (err) {
  if (err) {
    err.message = 'error starting server: ' + err.message
    return
  }

  console.log('listening on port ' + process.env.PORT)

  wsMirror(server)
})
