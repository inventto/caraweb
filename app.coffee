cv = require('opencv')
fs = require('fs')
app = require('http').createServer (req, res) ->
  file = if req.url is '/' then '/index.html' else req.url
  console.log "#{req.method} #{file}"
  fs.readFile "./static#{file}", (err, data) ->
    if err?
      res.write(404)
      return res.end "<h1>HTTP 404 - Not Found</h1>"
    res.writeHead(200)
    res.end data

io = require('socket.io').listen(app).on 'connection', (socket) ->
  socket.on 'frame', (data) ->
    return unless typeof(data) is 'string'
    data = data?.split(',')?[1]
    cv.readImage (new Buffer data, 'base64'), (err, im) ->
      im.detectObject "./node_modules/opencv/data/haarcascade_frontalface_alt2.xml", {}, (err, caras) ->
        return socket.emit('corpos', []) unless caras?.length > 0
        im.detectObject "./node_modules/opencv/data/haarcascade_eye.xml", {}, (err, olhos) ->
          return socket.emit('corpos', []) if err?
          faces = (caras or []).map (cara) ->
            cara.olhos = (olhos or []).filter (olho) ->
              olho.x > cara.x and olho.y > cara.y and (olho.x + olho.width) < (cara.x + cara.width) and (olho.y + olho.height) < (cara.y + cara.height)
            cara
          # console.log JSON.stringify faces
	  #im.convertGrayscale()
          im.detectObject "./node_modules/opencv/data/haarcascade_mcs_upperbody.xml", {}, (err, uppers) ->
            return socket.emit('corpos', []) unless uppers?.length > 0
            max_height = 0;
            rects = (uppers or []).map (corpo) ->
              corpo.faces = (faces or []).filter (face) ->
                face.x > corpo.x and face.y > corpo.y and (face.x + face.width) < (corpo.x + corpo.width) and (face.y + face.height) < (corpo.y + corpo.height)
              if corpo.height > max_height and corpo.faces.length > 0
                max_height = corpo.height
              corpo
            .filter (corpo) ->
              corpo.height == max_height

            socket.volatile.emit('corpos', rects)

io.disable('sync disconnect on unload')
io.enable('browser client minification')
io.enable('browser client etag')
io.enable('browser client gzip')
# io.enable('log');
io.set('log level', 1)
io.set('transports', [
    'websocket'
  # 'flashsocket'
  # 'htmlfile'
  'xhr-polling'
  'jsonp-polling'
])
      
app.listen(9272)

process.on 'uncaughtException', (err) ->
  console.error(err)
  socket?.emit('corpos', []) 
