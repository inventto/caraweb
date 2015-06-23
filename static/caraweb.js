    var video = document.querySelector('#live');
    video.width = 640;
    video.height = 480;
    var canvas = document.querySelector('#canvas');
    var divCaras = document.querySelector('#corposActuales');
    var fps = 1;
    var noDetectadas = 0;
    var ctx = canvas.getContext('2d');
    var mainTimer;
    var corpos = [];
    var ultimoCorpo = undefined;
    var bgPixels = undefined;
    var bgGray = undefined;
    var threshold = 30;
    var adjust = 0;

    var debug = document.querySelector('#debug');
    var debugBtn = document.querySelector('#debugBtn');
    var bgBtn = document.querySelector('#bgBtn');

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

    bgBtn.onclick = function (e) {
      ctx.drawImage(video, 0, 0, 640, 480);
      bg = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      bgPixels = bg;
      bgBlur = tracking.Image.blur(bg, canvas.width, canvas.height, 10);
      bgGray = tracking.Image.grayscale(bgBlur, canvas.width, canvas.height, false);
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
    function calcAdjust(imageLength, imageGray) {
      adjust = 0;
      adjustCounter = 0;
      //*
      for (i = 0; i < imageLength; i++) {
        aux = imageGray[i];
	auxBg = bgGray[i];
	if (aux > 200 && Math.abs(aux - auxBg) < threshold) {
		adjust += (aux - auxBg) / 1000.0;
		adjustCounter++;
	}
      }
      adjust = -adjust / adjustCounter * 2000;
      return adjust;
    }
    function equalize() {
      if (!bgGray) return;
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      w = imageData.width;
      h = imageData.height;

      imagePixels = imageData.data;
      imageBlur = tracking.Image.blur(imagePixels, w, h, 10);
      imageGray = tracking.Image.grayscale(imageBlur, w, h, false); // data
      imageLength = imageGray.length;

      min = 10000;
      max = 0;
      pos = 20;
      wPos = w * pos;
      for (i = 0; i < imageLength; i++) {
        aux = imageGray[i];
        if (aux < min) min = aux;
	else if (aux > max) max = aux;
      }

      adjust = calcAdjust(imageLength, imageGray);
      console.log("Adjust brigth defference: " + adjust);
      //*/

      for (i = 1; i < imageLength; i++) {
        d = (imageGray[i]-min)*255/max;
        //imageGray[i] = d;

        bg = (bgGray[i]-min)*255/max;
        diff = Math.abs(bg - d - adjust) > threshold;
        diffR = Math.abs(bgPixels[i*4] - imagePixels[i*4]) > threshold * 2.5;
        diffG = Math.abs(bgPixels[i*4+1] - imagePixels[i*4+1]) > threshold * 2.5;
        diffB = Math.abs(bgPixels[i*4+2] - imagePixels[i*4+2]) > threshold * 2.5;
        imageGray[i] = (diff || (diffR || diffG || diffB)) ? 255 : 0;

      }
      //*
      for (i = 0; i < imageLength; i++) {
        if (i > 2 && i < imageLength - 2 && 
           (imageGray[i] == 255 && imageGray[i - 1] == 0 && (imageGray[i + 1] == 0 || imageGray[i + 2] == 0)) || 
           (imageGray[i] == 255 && imageGray[i - 2] == 0 && (imageGray[i + 1] == 0 || imageGray[i + 2] == 0)) 
        ) {
          imageGray[i] = 0;
        } else
        if (i > w * 2 && i < imageLength - w * 2 && imageGray[i] == 255 && 
           (imageGray[i - w] == 0 && (imageGray[i + w] == 0 || imageGray[i + w * 2] == 0)) ||
           (imageGray[i - w * 2] == 0 && (imageGray[i + w] == 0 || imageGray[i + w * 2] == 0))
        ) {
            imageGray[i] = 0;
        }
        if (i > 2 && i < imageLength - 2 && 
           (imageGray[i] == 0 && imageGray[i - 1] == 255 && (imageGray[i + 1] == 255 || imageGray[i + 2] == 255)) || 
           (imageGray[i] == 0 && imageGray[i - 2] == 255 && (imageGray[i + 1] == 255 || imageGray[i + 2] == 255)) 
        ) {
            imageGray[i] = 255;
        } else
        if (i > w * 2 && i < imageLength - w * 2 && imageGray[i] == 0 && 
           (imageGray[i - w] == 255 && (imageGray[i + w] == 255 || imageGray[i + w * 2] == 255)) ||
           (imageGray[i - w * 2] == 255 && (imageGray[i + w] == 255 || imageGray[i + w * 2] == 255))
        ) {
         imageGray[i] = 255;
        }

      }
      /*
      for (i = 0; i < imageLength; i+=4) {
        x = imageGray[i / 4] / 255.0;
        imageData.data[i] *= x;
        imageData.data[i+1] *= x;
        imageData.data[i+2] *= x;
      }
      //*/
      //*
      for (i = 0; i < imageData.data.length; i+=4) {
        x = 255.0 - imageGray[i / 4];
        imageData.data[i] += x;
        imageData.data[i+1] += x;
        imageData.data[i+2] += x;
      }
      //*/
      /*
      for (i = 0; i < imageLength; i+=4) {
        x = imageGray[i / 4];
        imageData.data[i] = x;
        imageData.data[i+1] = x;
        imageData.data[i+2] = x;
      }//*/
      ctx.putImageData(imageData, 0, 0);
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
	    /*if (ultimoCorpo != undefined) {
		    corpo.x = (ultimoCorpo.x + corpo.x) / 2;
		    corpo.y = (ultimoCorpo.y + corpo.y) / 2;
		    corpo.height = (ultimoCorpo.height + corpo.height) / 2;
		    corpo.width = (ultimoCorpo.width + corpo.width) / 2;
	    }*/
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
