    var video = document.querySelector('#live');
    video.width = 640;
    video.height = 480;
    var canvas = document.querySelector('#canvas');
    var divCaras = document.querySelector('#corposActuales');
    var fps = 3;
    var noDetectadas = 0;
    var ctx = canvas.getContext('2d');
    var mainTimer;
    var corpos = [];
    var ultimoCorpo = undefined;

    var debug = document.querySelector('#debug');
    var debugBtn = document.querySelector('#debugBtn');

    navigator.getMedia = (navigator.getUserMedia ||
                           navigator.webkitGetUserMedia ||
                           navigator.mozGetUserMedia ||
                           navigator.msGetUserMedia);

    navigator.getMedia({ video: true, audio: false }, function(stream) {
      video.src = window.URL.createObjectURL(stream);
    }, function (err) { console.error(err); });

    debugBtn.onclick = function (e) {
      e.preventDefault();
      if (debugBtn.className != 'round alert') {
        debugBtn.innerHTML = 'Detener Debug';
        debugBtn.className = 'round alert';
        debug.style.display = 'block';
      } else {
        debug.style.display = 'none';
        debugBtn.className = 'round success';
        debugBtn.innerHTML = 'Iniciar Debug';
      }
    }

    var socket = io.connect(top.location.origin); // 'http://localhost');
    socket.on('corpos', function (_corpos) {
      // console.log(_corpos)
      if (!_corpos || _corpos.length === 0) {
        if (++noDetectadas > 10) {
          noDetectadas = 0;
          corpos = [];
        }
        return;
      }
      corpos = _corpos;
      if (debugBtn.className == 'round alert') {
        debug.innerHTML = JSON.stringify({fps:fps, corpos: { total: corpos.length, data: corpos}});
      }
      //// Intenta Quitar el tembeleque
      // corpos = _corpos.map(function (corpo) {
      //   corpo.x = Math.floor(corpo.x / 10) * 10;
      //   corpo.y = Math.floor(corpo.y / 10) * 10;
      //   corpo.width = Math.floor(corpo.width / 20) * 20;
      //   corpo.height = Math.floor(corpo.height / 20) * 20;
      //   return corpo;
      // });
    }).on('disconnect', function (data) {
      console.log("Disconnected!!!", data);
    });


    function putImageData(ctx, imageData, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight) {
      var data = imageData.data;
      var height = imageData.height;
      var width = imageData.width;
      dirtyX = dirtyX || 0;
      dirtyY = dirtyY || 0;
      dirtyWidth = dirtyWidth !== undefined? dirtyWidth: width;
      dirtyHeight = dirtyHeight !== undefined? dirtyHeight: height;
      var limitBottom = dirtyY + dirtyHeight;
      var limitRight = dirtyX + dirtyWidth;
      for (var y = dirtyY; y < limitBottom; y++) {
        for (var x = dirtyX; x < limitRight; x++) {
          var pos = y * width + x;
          ctx.fillStyle = 'rgba(' + data[pos*4+0]
              + ',' + data[pos*4+1]
              + ',' + data[pos*4+2]
              + ',' + (data[pos*4+3]/255) + ')';
          ctx.fillRect(x + dx, y + dy, 1, 1);
        }
      }
    }

    function equalize() {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      min = 10000;
      max = 0;
      for (i = 0; i < imageData.data.length; i+=4) {
        aux = 0.299*imageData.data[i]+0.587*imageData.data[i+1]+0.114*imageData.data[i+2];
        if (aux < min) min = aux;
        if (aux > max) max = aux;
      }
     
      for (i = 0; i < imageData.data.length; i+=4) {
        aux = 0.299*imageData.data[i]+0.587*imageData.data[i+1]+0.114*imageData.data[i+2];
        aux = (aux-min)*255/max;
        imageData.data[i] = aux;
        imageData.data[i+1] = aux;
        imageData.data[i+2] = aux;
        imageData.data[i+3] = 255;
      }
      putImageData(ctx, imageData, 0, 0);
    }

    function captura () {      
      mainTimer = setInterval(function () {
        ctx.drawImage(video, 0, 0, 640, 480);
	equalize();

        if (corpos && corpos.length) {
          divCaras.innerHTML = '';
          for (var i in corpos) {
            var corpo = corpos[i];
            var _corpo = document.createElement('canvas');
            // Fotica por individuo
            divCaras.appendChild(_corpo);
            _corpo.width = 64;
            _corpo.height = 64;
            _corpo.getContext('2d').drawImage(canvas, corpo.x, corpo.y, corpo.width, corpo.height, 0, 0, 64, 64);

            // Marco de Cara
	    if (ultimoCorpo != undefined) {
		    corpo.x = (ultimoCorpo.x + corpo.x) / 2;
		    corpo.y = (ultimoCorpo.y + corpo.y) / 2;
		    corpo.height = (ultimoCorpo.height + corpo.height) / 2;
		    corpo.width = (ultimoCorpo.width + corpo.width) / 2;
	    }
            ctx.beginPath();
            ctx.rect(corpo.x, corpo.y, corpo.width, corpo.height);
            ctx.fillStyle = 'rgba(46, 166, 203, 0.5)';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#2ba6cb';
            ctx.stroke();

	    ctx.font = "12px verdana";
	    ctx.textBaseline = "hanging";
            ctx.fillStyle = 'rgb(46, 166, 203)';
	    ctx.fillText("Corpo", corpo.x + 5, corpo.y + 5);
            // Marco de olhos
            if (corpo.faces && corpo.faces.length > 0) {
              face = corpo.faces[0];
              ctx.beginPath();
              ctx.rect(face.x, face.y, face.width, face.height);
              ctx.fillStyle = 'transparent';
              ctx.fill();
              ctx.lineWidth = 2;
              ctx.strokeStyle = '#cb2ba6';
              ctx.stroke();

              ctx.fillStyle = 'rgb(203, 46, 166)';
	      ctx.fillText("Face", face.x + 5, face.y + 5);

              if (corpo.faces[0].olhos) {
                for (var olho in corpo.faces[0].olhos) {
                  olho = corpo.faces[0].olhos[olho];
                  ctx.beginPath();
                  ctx.rect(olho.x, olho.y, olho.width, olho.height);
                  ctx.fillStyle = 'transparent';
                  ctx.fill();
                  ctx.lineWidth = 2;
                  ctx.strokeStyle = '#a6cb2b';
                  ctx.stroke();
                }
              }
            }
          }
        }
        socket.emit('frame', canvas.toDataURL("image/jpeg"));
      }, 1000 / fps);
    }
    captura();
